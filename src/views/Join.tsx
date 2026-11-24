import { useEffect, useRef, useState } from 'preact/hooks';
import type { Deck, Msg, Resp } from '../lib/types';
import { openChannel, type Channel } from '../lib/realtime';
import { types } from '../slides';
import { uid } from '../lib/store';
import { t, useLang } from '../lib/i18n';

const store = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* privater Modus */ } },
};

export function Join({ code }: { code: string }) {
  useLang();
  const [name, setName] = useState(store.get('liveslides.name') ?? '');
  const [joined, setJoined] = useState(false);
  const [deck, setDeck] = useState<Deck>();
  const [index, setIndex] = useState(0);
  const [step, setStep] = useState(0);
  const [mine, setMine] = useState<Record<string, Resp[]>>({});
  const [live, setLive] = useState<Record<string, Resp[]>>({});
  const ch = useRef<Channel | undefined>(undefined);
  const pid = useRef(store.get('liveslides.pid') ?? uid());
  store.set('liveslides.pid', pid.current);
  const deckRef = useRef<Deck | undefined>(undefined);
  deckRef.current = deck;

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
    const iv = setInterval(() => !deckRef.current && ch.current?.send({ t: 'hello', pid: pid.current }), 2000);
    return () => {
      clearInterval(iv);
      ch.current?.close();
    };
  }, [joined, code]);

  if (!joined)
    return (
      <div class="page narrow">
        <h2>{t('join.title')} {code}</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            store.set('liveslides.name', name.trim());
            setJoined(true);
          }}
        >
          <input aria-label={t('join.name')} placeholder={t('join.name')} value={name} maxLength={30} onInput={(e) => setName((e.target as HTMLInputElement).value)} />
          <button class="btn primary">{t('join.go')}</button>
        </form>
      </div>
    );

  if (!deck) return <div class="page narrow"><p role="status">{t('join.wait')}</p></div>;
  const slide = deck.slides[index];
  const type = slide && types[slide.type];
  if (!type) return <div class="page narrow"><p role="status">{t('join.wait')}</p></div>;
  const submit = (data: any) => {
    const resp: Resp = { pid: pid.current, name: name.trim(), data, at: Date.now() };
    ch.current?.send({ t: 'resp', slideId: slide.id, resp });
    setMine((m) => ({ ...m, [slide.id]: [...(m[slide.id] ?? []), resp] }));
  };
  return (
    <div class="page narrow" role="main">
      {type.Player ? (
        <type.Player data={slide.data} submit={submit} mine={mine[slide.id] ?? []} live={live[slide.id] ?? []} pid={pid.current} step={step} />
      ) : (
        <p class="hint" role="status">{t('join.look')}</p>
      )}
    </div>
  );
}
