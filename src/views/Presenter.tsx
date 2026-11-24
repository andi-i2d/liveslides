import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Msg, Resp } from '../lib/types';
import { getDeck, joinCode } from '../lib/store';
import { openChannel, type Channel } from '../lib/realtime';
import { types } from '../slides';
import { createGuard } from '../lib/guard';
import { t, useLang } from '../lib/i18n';

export function Presenter({ id }: { id: string }) {
  useLang();
  const deck = useMemo(() => getDeck(id), [id]);
  const code = useMemo(() => joinCode(), []);
  const [index, setIndex] = useState(0);
  const [all, setAll] = useState<Record<string, Resp[]>>({});
  const [players, setPlayers] = useState(0);
  const [reveal, setReveal] = useState(false);
  /** Etappe innerhalb einer Folie (Turnier-Duell, Retro-Phase …); wird an die Handys gesendet. */
  const [step, setStep] = useState(0);
  useEffect(() => {
    setReveal(false);
    setStep(0);
  }, [index]);
  const ch = useRef<Channel | undefined>(undefined);
  const seen = useRef(new Set<string>());
  const guard = useRef(createGuard());
  const stateRef = useRef({ index, step });
  stateRef.current.index = index;
  stateRef.current.step = step;

  useEffect(() => {
    if (!deck) return;
    const send = () =>
      ch.current?.send({ t: 'state', deck, index: stateRef.current.index, step: stateRef.current.step, code });
    ch.current = openChannel(code, (m: Msg) => {
      if (m.t === 'hello') {
        seen.current.add(m.pid);
        setPlayers(seen.current.size);
        send();
      } else if (m.t === 'resp') {
        const slide = deck.slides.find((s) => s.id === m.slideId);
        const resp = slide && guard.current.accept(m.slideId, m.resp);
        if (!slide || !resp) return;
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
    return () => ch.current?.close();
  }, [deck, code]);

  useEffect(() => {
    if (deck) ch.current?.send({ t: 'state', deck, index, step, code });
  }, [index, step]);

  // Live-Antworten der aktuellen Folie an die Handys (gedrosselt), z. B. für Abstimmungen über Ideen
  useEffect(() => {
    if (!deck) return;
    const s = deck.slides[index];
    if (!types[s.type].live) return;
    const t = setTimeout(
      () => ch.current?.send({ t: 'live', slideId: s.id, responses: (all[s.id] ?? []).slice(-300) }),
      300,
    );
    return () => clearTimeout(t);
  }, [all, index]);

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
      <footer class="bar">
        <a href={`#/edit/${deck.id}`} aria-label={t('a11y.close')}>✕</a>
        <button aria-label={t('a11y.prev')} onClick={() => setIndex(Math.max(0, index - 1))}>◀</button>
        <span aria-live="polite">{index + 1} / {deck.slides.length}</span>
        <button aria-label={t('a11y.next')} onClick={() => setIndex(Math.min(deck.slides.length - 1, index + 1))}>▶</button>
        <button onClick={() => setReveal((v) => !v)} title="R">{reveal ? t('present.hide') : t('present.reveal')}</button>
        {type.steps && <button onClick={() => setStep((s) => s + 1)} title="N">{t('present.step')} {step + 1}</button>}
        <span class="grow" />
        <span title="Teilnehmer">👥 {players}</span>
        <span>{t('present.code')} <b class="code">{code}</b></span>
        <button aria-label={t('a11y.fullscreen')} onClick={() => document.documentElement.requestFullscreen?.()}>⛶</button>
      </footer>
    </div>
  );
}
