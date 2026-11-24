import { useState } from 'preact/hooks';
import type { Resp, SlideType } from '../lib/types';

export function tally(n: number, rs: Resp[]) {
  const c = Array<number>(n).fill(0);
  for (const r of rs) if (typeof r.data === 'number' && c[r.data] !== undefined) c[r.data]++;
  return c;
}

export function Bars({
  options,
  counts,
  correct,
}: {
  options: string[];
  counts: number[];
  correct?: number;
}) {
  const max = Math.max(1, ...counts);
  return (
    <div class="bars">
      {options.map((o, i) => (
        <div class={'bar' + (correct === i ? ' ok' : '')}>
          <span class="lbl">{o}</span>
          <span class="fill" style={{ width: `${(counts[i] / max) * 100}%` }} />
          <span class="n">{counts[i]}</span>
        </div>
      ))}
    </div>
  );
}

/** Auswahl-Buttons auf dem Handy (Poll & Quiz). */
export function Choice({
  options,
  submit,
  mine,
}: {
  options: string[];
  submit: (d: number) => void;
  mine: Resp[];
}) {
  const done = mine.length > 0;
  return (
    <div class="choices">
      {options.map((o, i) => (
        <button class={'choice' + (mine[0]?.data === i ? ' picked' : '')} disabled={done} onClick={() => submit(i)}>
          {o}
        </button>
      ))}
      {done && <p class="hint">✓ Antwort gesendet</p>}
    </div>
  );
}

export const poll: SlideType = {
  id: 'poll',
  label: 'Umfrage',
  icon: '📊',
  category: 'Umfrage',
  interactive: true,
  defaults: () => ({ question: 'Eure Frage?', options: ['Option A', 'Option B', 'Option C'] }),
  fields: [
    { key: 'question', label: 'Frage', kind: 'text' },
    { key: 'options', label: 'Antworten', kind: 'list' },
  ],
  Stage: ({ data, ctx }) => (
    <div class="col">
      <h2>{data.question}</h2>
      <Bars options={data.options} counts={tally(data.options.length, ctx.responses)} />
    </div>
  ),
  Player: ({ data, submit, mine }) => (
    <>
      <h3>{data.question}</h3>
      <Choice options={data.options} submit={submit} mine={mine} />
    </>
  ),
};

/** Wordcloud: Größe nach Häufigkeit. */
export const wordcloud: SlideType = {
  id: 'wordcloud',
  label: 'Wortwolke',
  icon: '☁️',
  category: 'Umfrage',
  interactive: true,
  multi: true,
  defaults: () => ({ question: 'Was fällt euch dazu ein?', max: 3 }),
  fields: [
    { key: 'question', label: 'Frage', kind: 'text' },
    { key: 'max', label: 'Einträge pro Person', kind: 'number' },
  ],
  Stage: ({ data, ctx }) => {
    const m = new Map<string, number>();
    for (const r of ctx.responses) {
      const w = String(r.data).trim().toLowerCase();
      if (w) m.set(w, (m.get(w) ?? 0) + 1);
    }
    const top = Math.max(1, ...m.values());
    return (
      <div class="col">
        <h2>{data.question}</h2>
        <div class="cloud">
          {[...m].map(([w, n]) => (
            <span style={{ fontSize: `${1.2 + (n / top) * 3}rem` }}>{w}</span>
          ))}
        </div>
      </div>
    );
  },
  Player: ({ data, submit, mine }) => {
    const [v, setV] = useState('');
    const left = Number(data.max) - mine.length;
    return (
      <>
        <h3>{data.question}</h3>
        {left > 0 ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (v.trim()) {
                submit(v.trim());
                setV('');
              }
            }}
          >
            <input value={v} onInput={(e) => setV((e.target as HTMLInputElement).value)} maxLength={30} />
            <button class="btn">Senden</button>
            <p class="hint">Noch {left} Eintrag/Einträge</p>
          </form>
        ) : (
          <p class="hint">✓ Danke!</p>
        )}
      </>
    );
  },
};

export const openEnded: SlideType = {
  id: 'open',
  label: 'Offene Frage',
  icon: '💬',
  category: 'Umfrage',
  interactive: true,
  multi: true,
  defaults: () => ({ question: 'Eure Meinung?' }),
  fields: [{ key: 'question', label: 'Frage', kind: 'text' }],
  Stage: ({ data, ctx }) => (
    <div class="col">
      <h2>{data.question}</h2>
      <div class="cards">
        {ctx.responses.map((r) => (
          <div class="card">{String(r.data)}</div>
        ))}
      </div>
    </div>
  ),
  Player: ({ data, submit }) => {
    const [v, setV] = useState('');
    return (
      <>
        <h3>{data.question}</h3>
        <textarea value={v} onInput={(e) => setV((e.target as HTMLTextAreaElement).value)} maxLength={300} />
        <button
          class="btn"
          onClick={() => {
            if (v.trim()) {
              submit(v.trim());
              setV('');
            }
          }}
        >
          Senden
        </button>
      </>
    );
  },
};

export const scale: SlideType = {
  id: 'scale',
  label: 'Skala',
  icon: '🎚️',
  category: 'Umfrage',
  interactive: true,
  defaults: () => ({ question: 'Wie zufrieden seid ihr?', min: 1, max: 5 }),
  fields: [
    { key: 'question', label: 'Frage', kind: 'text' },
    { key: 'min', label: 'Minimum', kind: 'number' },
    { key: 'max', label: 'Maximum', kind: 'number' },
  ],
  Stage: ({ data, ctx }) => {
    const vals = ctx.responses.map((r) => Number(r.data));
    const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    const steps = Array.from({ length: data.max - data.min + 1 }, (_, i) => String(data.min + i));
    const counts = steps.map((_, i) => vals.filter((v) => v === data.min + i).length);
    return (
      <div class="col">
        <h2>{data.question}</h2>
        <p class="sub">Ø {avg.toFixed(2)} ({vals.length} Stimmen)</p>
        <Bars options={steps} counts={counts} />
      </div>
    );
  },
  Player: ({ data, submit, mine }) => {
    const steps = Array.from({ length: data.max - data.min + 1 }, (_, i) => data.min + i);
    return (
      <>
        <h3>{data.question}</h3>
        <div class="choices row">
          {steps.map((s) => (
            <button class={'choice' + (mine[0]?.data === s ? ' picked' : '')} disabled={mine.length > 0} onClick={() => submit(s)}>
              {s}
            </button>
          ))}
        </div>
      </>
    );
  },
};
