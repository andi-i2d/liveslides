import { useEffect, useRef, useState } from 'preact/hooks';
import type { Deck, Msg, Resp } from '../lib/types';
import { openChannel, type Channel } from '../lib/realtime';
import { types } from '../slides';
import { uid } from '../lib/store';

export function Join({ code }: { code: string }) {
  const [name, setName] = useState(localStorage.getItem('liveslides.name') ?? '');
  const [joined, setJoined] = useState(false);
  const [deck, setDeck] = useState<Deck>();
  const [index, setIndex] = useState(0);
  const [step, setStep] = useState(0);
  const [mine, setMine] = useState<Record<string, Resp[]>>({});
  const [live, setLive] = useState<Record<string, Resp[]>>({});
  const ch = useRef<Channel | undefined>(undefined);
  const pid = useRef(localStorage.getItem('liveslides.pid') ?? uid());
  localStorage.setItem('liveslides.pid', pid.current);

  useEffect(() => {
    if (!joined) return;
    ch.current = openChannel(code, (m: Msg) => {
      if (m.t === 'state') {
        setDeck(m.deck);
        setIndex(m.index);
        setStep(m.step ?? 0);
      } else if (m.t === 'live') {
        setLive((l) => ({ ...l, [m.slideId]: m.responses }));
      }
    });
    ch.current.send({ t: 'hello', pid: pid.current });
    // erneut anfragen, falls der Präsentator beim ersten Hello noch nicht bereit war
    const iv = setInterval(() => !deck && ch.current?.send({ t: 'hello', pid: pid.current }), 2000);
    return () => {
      clearInterval(iv);
      ch.current?.close();
    };
  }, [joined, code]);

  if (!joined)
    return (
      <div class="page narrow">
        <h2>Beitreten: {code}</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            localStorage.setItem('liveslides.name', name.trim());
            setJoined(true);
          }}
        >
          <input placeholder="Dein Name" value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} />
          <button class="btn primary">Los!</button>
        </form>
      </div>
    );

  if (!deck) return <div class="page narrow"><p>Warte auf den Präsentator …</p></div>;
  const slide = deck.slides[index];
  const t = types[slide.type];
  const submit = (data: any) => {
    const resp: Resp = { pid: pid.current, name: name.trim(), data, at: Date.now() };
    ch.current?.send({ t: 'resp', slideId: slide.id, resp });
    setMine((m) => ({ ...m, [slide.id]: [...(m[slide.id] ?? []), resp] }));
  };
  return (
    <div class="page narrow">
      {t.Player ? (
        <t.Player data={slide.data} submit={submit} mine={mine[slide.id] ?? []} live={live[slide.id] ?? []} pid={pid.current} step={step} />
      ) : (
        <p class="hint">Schau auf den großen Bildschirm 👀</p>
      )}
    </div>
  );
}
