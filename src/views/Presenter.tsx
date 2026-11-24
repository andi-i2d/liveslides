import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Msg, Resp } from '../lib/types';
import { getDeck, joinCode } from '../lib/store';
import { openChannel, type Channel } from '../lib/realtime';
import { types } from '../slides';

export function Presenter({ id }: { id: string }) {
  const deck = useMemo(() => getDeck(id), [id]);
  const code = useMemo(() => joinCode(), []);
  const [index, setIndex] = useState(0);
  const [all, setAll] = useState<Record<string, Resp[]>>({});
  const [players, setPlayers] = useState(0);
  const [reveal, setReveal] = useState(false);
  useEffect(() => setReveal(false), [index]);
  const ch = useRef<Channel | undefined>(undefined);
  const seen = useRef(new Set<string>());
  const stateRef = useRef({ index });
  stateRef.current.index = index;

  useEffect(() => {
    if (!deck) return;
    const send = () => ch.current?.send({ t: 'state', deck, index: stateRef.current.index, code });
    ch.current = openChannel(code, (m: Msg) => {
      if (m.t === 'hello') {
        seen.current.add(m.pid);
        setPlayers(seen.current.size);
        send();
      } else if (m.t === 'resp') {
        seen.current.add(m.resp.pid);
        setPlayers(seen.current.size);
        const slide = deck.slides.find((s) => s.id === m.slideId);
        if (!slide) return;
        const multi = types[slide.type].multi;
        setAll((a) => {
          const cur = a[m.slideId] ?? [];
          const next = multi ? [...cur, m.resp] : [...cur.filter((r) => r.pid !== m.resp.pid), m.resp];
          return { ...a, [m.slideId]: next };
        });
      }
    });
    return () => ch.current?.close();
  }, [deck, code]);

  useEffect(() => {
    if (deck) ch.current?.send({ t: 'state', deck, index, code });
  }, [index]);

  // Live-Antworten der aktuellen Folie an die Handys (gedrosselt), z. B. für Abstimmungen über Ideen
  useEffect(() => {
    if (!deck) return;
    const s = deck.slides[index];
    if (!types[s.type].Player) return;
    const t = setTimeout(
      () => ch.current?.send({ t: 'live', slideId: s.id, responses: (all[s.id] ?? []).slice(-300) }),
      300,
    );
    return () => clearTimeout(t);
  }, [all, index]);

  useEffect(() => {
    if (!deck) return;
    const k = (e: KeyboardEvent) => {
      if (['ArrowRight', 'PageDown', ' '].includes(e.key)) setIndex((i) => Math.min(deck.slides.length - 1, i + 1));
      if (['ArrowLeft', 'PageUp'].includes(e.key)) setIndex((i) => Math.max(0, i - 1));
      if (e.key === 'f') document.documentElement.requestFullscreen?.();
      if (e.key === 'r') setReveal((v) => !v);
    };
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, [deck]);

  if (!deck) return <div class="page">Nicht gefunden. <a href="#/">Zurück</a></div>;
  const slide = deck.slides[index];
  const t = types[slide.type];
  const joinUrl = `${location.origin}${location.pathname}#/join/${code}`;

  return (
    <div class="present">
      <div class="stage">
        <t.Stage
          data={slide.data}
          ctx={{ responses: all[slide.id] ?? [], all, deck, joinUrl, code, reveal }}
        />
      </div>
      <footer class="bar">
        <a href={`#/edit/${deck.id}`}>✕</a>
        <button onClick={() => setIndex(Math.max(0, index - 1))}>◀</button>
        <span>{index + 1} / {deck.slides.length}</span>
        <button onClick={() => setIndex(Math.min(deck.slides.length - 1, index + 1))}>▶</button>
        <button onClick={() => setReveal((v) => !v)} title="Lösung zeigen (R)">{reveal ? '🙈 Verbergen' : '👁 Auflösen'}</button>
        <span class="grow" />
        <span>👥 {players}</span>
        <span>Code <b class="code">{code}</b></span>
        <button onClick={() => document.documentElement.requestFullscreen?.()}>⛶</button>
      </footer>
    </div>
  );
}
