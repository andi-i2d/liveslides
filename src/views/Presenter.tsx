import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Msg, Resp } from '../lib/types';
import { getDeck, joinCode } from '../lib/store';
import { openChannel, type Channel } from '../lib/realtime';
import { types } from '../slides';
import { Qr } from '../slides/static';
import { createGuard } from '../lib/guard';
import { createNameRegistry } from '../lib/names';
import { createCoalescer, liveDelay } from '../lib/pacing';
import { phoneAssets, stripImages } from '../lib/assets';
import { t, useLang } from '../lib/i18n';
import { cloudReady, cloudSavePhoto, cloudSaveResults, useCloudStatus } from '../lib/cloud';
import { dataUrlToBlob, pendingDrops, photoFileName } from '../lib/drops';
import { hasAnyResponse } from '../lib/results';

export function Presenter({ id }: { id: string }) {
  useLang();
  const deck = useMemo(() => getDeck(id), [id]);
  const code = useMemo(() => joinCode(), []);
  const startedAt = useMemo(() => Date.now(), []);
  const [index, setIndex] = useState(0);
  const [all, setAll] = useState<Record<string, Resp[]>>({});
  const [players, setPlayers] = useState(0);
  const [reveal, setReveal] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const cloud = useCloudStatus();
  /** Etappe innerhalb einer Folie (Turnier-Duell, Retro-Phase …); wird an die Handys gesendet. */
  const [step, setStep] = useState(0);
  useEffect(() => {
    setReveal(false);
    setStep(0);
  }, [index]);
  const ch = useRef<Channel | undefined>(undefined);
  const seen = useRef(new Set<string>());
  const guard = useRef(createGuard());
  const names = useRef(createNameRegistry());
  const liveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const allRef = useRef(all);
  allRef.current = all;
  const stateRef = useRef({ index, step });
  stateRef.current.index = index;
  stateRef.current.step = step;

  useEffect(() => {
    if (!deck) return;
    // Das komplette Deck geht nur als Antwort auf „hello“ raus. Viele gleichzeitige Hallos (Beitritts-Ansturm)
    // werden zu einer einzigen Antwort gebündelt; bei kleinen Gruppen kommt sie fast sofort.
    // Eingebettete Bilder gehen nicht im Deck mit (Nachrichten bleiben klein), sondern als „asset“ der aktuellen Folie.
    const lite = stripImages(deck);
    const reply = () => {
      const i = stateRef.current.index;
      ch.current?.send({ t: 'state', deck: lite, index: i, step: stateRef.current.step, code });
      const assets = phoneAssets(deck.slides[i]);
      if (assets) ch.current?.send({ t: 'asset', slideId: deck.slides[i].id, fields: assets });
    };
    const helloFast = createCoalescer(reply, 100);
    const helloSlow = createCoalescer(reply, 1000);
    ch.current = openChannel(code, (m: Msg) => {
      if (m.t === 'hello') {
        seen.current.add(m.pid);
        setPlayers(seen.current.size);
        (seen.current.size < 20 ? helloFast : helloSlow).trigger();
      } else if (m.t === 'resp') {
        const slide = deck.slides.find((s) => s.id === m.slideId);
        const accepted = slide && guard.current.accept(m.slideId, m.resp);
        if (!slide || !accepted) return;
        // Namen eindeutig halten („Lustiger Luchs“ → „Lustiger Luchs 2“) und der Person den neuen Namen mitteilen
        const finalName = names.current.assign(accepted.pid, accepted.name);
        if (finalName !== accepted.name) ch.current?.send({ t: 'rename', pid: accepted.pid, name: finalName });
        const resp = { ...accepted, name: finalName };
        seen.current.add(resp.pid);
        setPlayers(seen.current.size);
        const multi = types[slide.type].multi;
        setAll((a) => {
          const cur = a[m.slideId] ?? [];
          const next = multi ? [...cur, resp] : [...cur.filter((r) => r.pid !== resp.pid), resp];
          return { ...a, [m.slideId]: next };
        });
      }
    });
    return () => {
      helloFast.cancel();
      helloSlow.cancel();
      ch.current?.close();
    };
  }, [deck, code]);

  useEffect(() => {
    if (!deck) return;
    ch.current?.send({ t: 'state', index, step, code }); // ohne Deck: spart Daten bei vielen Teilnehmenden
  }, [index, step]);

  // Neue Folie mit eingebetteten Bildern, die das Handy zeigt: Bilder einmal an alle senden (nicht bei jedem Schritt)
  useEffect(() => {
    const assets = deck && phoneAssets(deck.slides[index]);
    if (deck && assets) ch.current?.send({ t: 'asset', slideId: deck.slides[index].id, fields: assets });
  }, [index]);

  // Live-Antworten der aktuellen Folie an die Handys (gedrosselt), z. B. für Abstimmungen über Ideen
  useEffect(() => {
    if (!deck) return;
    const s = deck.slides[index];
    if (!types[s.type].live) return;
    // Drosselung: höchstens eine Spiegelung je Zeitfenster; es wird immer der neueste Stand gesendet.
    if (liveTimer.current) return;
    liveTimer.current = setTimeout(() => {
      liveTimer.current = null;
      const cur = deck.slides[stateRef.current.index];
      if (cur && types[cur.type].live)
        ch.current?.send({ t: 'live', slideId: cur.id, responses: (allRef.current[cur.id] ?? []).slice(-300) });
    }, liveDelay(seen.current.size));
  }, [all, index]);
  useEffect(() => () => { if (liveTimer.current) clearTimeout(liveTimer.current); }, []);

  // Foto-Drop: neue Fotos der Teilnehmenden automatisch im Ordner „Fotos“ der Präsentation in Drive ablegen.
  // Fehlgeschlagene werden beim nächsten Eingang oder per ☁-Knopf erneut versucht (höchstens 3 Versuche je Foto).
  const dropped = useRef(new Set<string>());
  const dropTries = useRef(new Map<string, number>());
  const dropN = useRef(0);
  const flushDrops = () => {
    if (!deck || !cloudReady()) return;
    for (const d of pendingDrops(deck, allRef.current, dropped.current, types)) {
      if ((dropTries.current.get(d.key) ?? 0) >= 3) continue;
      dropped.current.add(d.key); // in Arbeit
      const blob = dataUrlToBlob(d.img);
      cloudSavePhoto(deck, photoFileName(d.resp.at, d.resp.name, ++dropN.current, blob.type), blob).then((ok) => {
        if (ok) return;
        dropped.current.delete(d.key);
        dropTries.current.set(d.key, (dropTries.current.get(d.key) ?? 0) + 1);
      });
    }
  };
  useEffect(() => flushDrops(), [all]);

  // Ergebnisse in Google Drive sichern: kurz nach der letzten Antwort und beim Folienwechsel.
  const saveNow = () => {
    flushDrops();
    if (deck && cloudReady() && hasAnyResponse(all))
      cloudSaveResults(deck, all, { sessionId: `${deck.id}-${code}`, code, startedAt, participants: seen.current.size });
  };
  const saveRef = useRef(saveNow);
  saveRef.current = saveNow;
  useEffect(() => {
    if (!hasAnyResponse(all)) return;
    const timer = setTimeout(() => saveRef.current(), 5000);
    return () => clearTimeout(timer);
  }, [all, index]);
  // Beim Verlassen der Präsentation ein letztes Mal speichern
  useEffect(() => () => saveRef.current(), []);

  useEffect(() => {
    if (!deck) return;
    const k = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'n') setStep((s) => s + 1);
      if (e.key === 'N') setStep((s) => Math.max(0, s - 1));
      if (['ArrowRight', 'PageDown', ' '].includes(e.key)) setIndex((i) => Math.min(deck.slides.length - 1, i + 1));
      if (['ArrowLeft', 'PageUp'].includes(e.key)) setIndex((i) => Math.max(0, i - 1));
      if (e.key === 'f') document.documentElement.requestFullscreen?.();
      if (e.key === 'r') setReveal((v) => !v);
      if (e.key === 'q' || e.key === 'Q') setShowQr((v) => !v);
      if (e.key === 'Escape') setShowQr(false);
    };
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, [deck]);

  if (!deck) return <div class="page">{t('editor.notFound')} <a href="#/">{t('editor.back')}</a></div>;
  const slide = deck.slides[index];
  const type = types[slide.type];
  const joinUrl = `${location.origin}${location.pathname}#/join/${code}`;

  return (
    <div class="present">
      <div class="stage" role="main">
        <type.Stage
          data={slide.data}
          ctx={{ responses: all[slide.id] ?? [], all, deck, joinUrl, code, reveal, step, next: () => setStep((s) => s + 1) }}
        />
      </div>
      {showQr && (
        <div class="qroverlay" role="dialog" aria-label={t('qr.show')} onClick={() => setShowQr(false)}>
          <Qr url={joinUrl} />
          <p class="huge-code"><b class="code">{code}</b></p>
          <p class="hint">{joinUrl.replace(/^https?:\/\//, '')}</p>
          <p class="hint">{t('qr.close')}</p>
        </div>
      )}
      <footer class="bar">
        <a href={`#/edit/${deck.id}`} aria-label={t('a11y.close')}>✕</a>
        <button aria-label={t('a11y.prev')} onClick={() => setIndex(Math.max(0, index - 1))}>◀</button>
        <span aria-live="polite">{index + 1} / {deck.slides.length}</span>
        <button aria-label={t('a11y.next')} onClick={() => setIndex(Math.min(deck.slides.length - 1, index + 1))}>▶</button>
        <button onClick={() => setReveal((v) => !v)} title="R">{reveal ? t('present.hide') : t('present.reveal')}</button>
        {type.steps && <button onClick={() => setStep((s) => s + 1)} title="N">{t('present.step')} {step + 1}</button>}
        <span class="grow" />
        {type.driveDrop && !cloudReady() && <span class="warnchip">{t('present.dropWarn')}</span>}
        {cloudReady() && (
          <button onClick={saveNow} title={t('cloud.saveNow')}>
            {cloud.state === 'saving' ? t('cloud.saving') : cloud.state === 'error' ? t('cloud.error') : cloud.state === 'saved' ? t('cloud.saved') : '☁'}
          </button>
        )}
        <span title="Teilnehmer">👥 {players}</span>
        <button class={showQr ? 'on' : ''} title="Q" aria-pressed={showQr} onClick={() => setShowQr((v) => !v)}>▦ {t('qr.show')}</button>
        <span>{t('present.code')} <b class="code">{code}</b></span>
        <button aria-label={t('a11y.fullscreen')} onClick={() => document.documentElement.requestFullscreen?.()}>⛶</button>
      </footer>
    </div>
  );
}
