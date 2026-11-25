import { useEffect, useRef, useState } from 'preact/hooks';
import type { Deck, Msg, Resp } from '../lib/types';
import { openChannel, type Channel } from '../lib/realtime';
import { types } from '../slides';
import { uid } from '../lib/store';
import { t, useLang } from '../lib/i18n';
import { funnyName, resolveName } from '../lib/names';
import { retryDelay } from '../lib/pacing';
import { Logo } from './Brand';

const store = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* privater Modus */ } },
};

export function Join({ code }: { code: string }) {
  useLang();
  const pid = useRef(store.get('liveslides.pid') ?? uid());
  store.set('liveslides.pid', pid.current);
  /** Vorschlag-Nummer: 0 = Standardvorschlag dieses Geräts, höher = „Anderer Vorschlag“ */
  const [variant, setVariant] = useState(0);
  // Zuvor selbst gewählter Name, sonst ein lustiger Vorschlag (z. B. „Dreister Denker“)
  const [input, setInput] = useState(store.get('liveslides.name') ?? funnyName(pid.current));
  /** endgültiger Anzeigename; null = Namensabfrage läuft noch */
  const [name, setName] = useState<string | null>(null);
  const [deck, setDeck] = useState<Deck>();
  const [index, setIndex] = useState(0);
  const [step, setStep] = useState(0);
  const [mine, setMine] = useState<Record<string, Resp[]>>({});
  const [live, setLive] = useState<Record<string, Resp[]>>({});
  const ch = useRef<Channel | undefined>(undefined);
  const deckRef = useRef<Deck | undefined>(undefined);
  deckRef.current = deck;

  // Verbindung sofort aufbauen, damit die Präsentation schon geladen ist, wenn der Name bestätigt wird.
  useEffect(() => {
    ch.current = openChannel(code, (m: Msg) => {
      if (m.t === 'state') {
        if (m.deck) setDeck(m.deck); // das Deck kommt nur als Antwort auf „hello“
        setIndex(m.index);
        setStep(m.step ?? 0);
      } else if (m.t === 'live') {
        setLive((l) => ({ ...l, [m.slideId]: m.responses }));
      } else if (m.t === 'rename' && m.pid === pid.current) {
        setName(m.name); // Präsentator hat den Namen eindeutig gemacht
      }
    });
    const hello = () => ch.current?.send({ t: 'hello', pid: pid.current });
    hello();
    // Noch keine Präsentation? Erneut anfragen, mit wachsenden Abständen und Streuung (schont den Präsentator bei vielen Handys).
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout>;
    const again = () => {
      if (deckRef.current) return;
      hello();
      timer = setTimeout(again, retryDelay(++attempt));
    };
    timer = setTimeout(again, retryDelay(0));
    return () => {
      clearTimeout(timer);
      ch.current?.close();
    };
  }, [code]);

  if (name === null)
    return (
      <div class="page narrow">
        <div class="row"><Logo size={40} /><h2 class="grow">{t('join.title')} {code}</h2></div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const n = resolveName(input, pid.current); // leer → Vorschlag
            // Nur merken, was nicht ohnehin der Standardvorschlag dieses Geräts ist
            if (n !== funnyName(pid.current)) store.set('liveslides.name', n);
            setName(n);
          }}
        >
          <div class="row">
            <input
              class="grow"
              aria-label={t('join.name')}
              placeholder={t('join.name')}
              value={input}
              maxLength={30}
              onInput={(e) => setInput((e.target as HTMLInputElement).value)}
            />
            <button
              type="button"
              class="btn"
              title={t('join.reroll')}
              aria-label={t('join.reroll')}
              onClick={() => {
                const v = variant + 1;
                setVariant(v);
                setInput(funnyName(pid.current, v));
              }}
            >
              🎲
            </button>
          </div>
          <p class="hint">{t('join.nameHint')}</p>
          <button class="btn primary">{t('join.go')}</button>
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
