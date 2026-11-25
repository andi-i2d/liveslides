import { useEffect, useRef, useState } from 'preact/hooks';
import type { Deck, Msg, Resp } from '../lib/types';
import { openChannel, type Channel } from '../lib/realtime';
import { types } from '../slides';
import { uid } from '../lib/store';
import { t, useLang } from '../lib/i18n';
import { nameMode, resolveName } from '../lib/names';

const store = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* privater Modus */ } },
};

export function Join({ code }: { code: string }) {
  useLang();
  const [input, setInput] = useState(store.get('liveslides.name') ?? '');
  /** endgültiger Anzeigename; null = Namensabfrage läuft noch */
  const [name, setName] = useState<string | null>(null);
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

  // Verbindung sofort aufbauen: so kennen wir die Einstellung „Name Pflicht/optional“ der Präsentation,
  // noch bevor der Name abgefragt wird.
  useEffect(() => {
    ch.current = openChannel(code, (m: Msg) => {
      if (m.t === 'state') {
        setDeck(m.deck);
        setIndex(m.index);
        setStep(m.step ?? 0);
      } else if (m.t === 'live') {
        setLive((l) => ({ ...l, [m.slideId]: m.responses }));
      } else if (m.t === 'rename' && m.pid === pid.current) {
        setName(m.name); // Präsentator hat den Namen eindeutig gemacht
      }
    });
    ch.current.send({ t: 'hello', pid: pid.current });
    // erneut anfragen, falls der Präsentator beim ersten Hello noch nicht bereit war
    const iv = setInterval(() => !deckRef.current && ch.current?.send({ t: 'hello', pid: pid.current }), 2000);
    return () => {
      clearInterval(iv);
      ch.current?.close();
    };
  }, [code]);

  const mode = nameMode(deck); // bis die Präsentation bekannt ist, gilt die strengere Variante (Pflicht)

  if (name === null)
    return (
      <div class="page narrow">
        <h2>{t('join.title')} {code}</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const n = resolveName(input, mode, pid.current);
            if (!n) return;
            if (input.trim()) store.set('liveslides.name', n);
            setName(n);
          }}
        >
          <input
            aria-label={t('join.name')}
            placeholder={mode === 'optional' ? t('join.nameOptional') : t('join.name')}
            value={input}
            maxLength={30}
            onInput={(e) => setInput((e.target as HTMLInputElement).value)}
          />
          <button class="btn primary">{t('join.go')}</button>
          {mode === 'optional' && !input.trim() && (
            <button type="button" class="btn" onClick={() => setName(resolveName('', 'optional', pid.current))}>
              {t('join.skip')}
            </button>
          )}
        </form>
        {!deck && <p class="hint" role="status">{t('join.connecting')}</p>}
      </div>
    );

  if (!deck) return <div class="page narrow"><p role="status">{t('join.wait')}</p></div>;
  const slide = deck.slides[index];
  const type = slide && types[slide.type];
  if (!type) return <div class="page narrow"><p role="status">{t('join.wait')}</p></div>;
  const submit = (data: any) => {
    const resp: Resp = { pid: pid.current, name, data, at: Date.now() };
    ch.current?.send({ t: 'resp', slideId: slide.id, resp });
    setMine((m) => ({ ...m, [slide.id]: [...(m[slide.id] ?? []), resp] }));
  };
  return (
    <div class="page narrow" role="main">
      <p class="youare" aria-label={`${t('join.youAre')} ${name}`}>👤 {name}</p>
      {type.Player ? (
        <type.Player data={slide.data} submit={submit} mine={mine[slide.id] ?? []} live={live[slide.id] ?? []} pid={pid.current} step={step} />
      ) : (
        <p class="hint" role="status">{t('join.look')}</p>
      )}
    </div>
  );
}
