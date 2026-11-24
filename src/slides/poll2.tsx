import { useState } from 'preact/hooks';
import type { SlideType } from '../lib/types';
import { Bars, Choice, tally } from './interactive';
import { avgVectors, ideasWithVotes, merge, rankScores } from './ideas';

const clean = (a: string[]) => a.filter((s) => s.trim());
const COLORS = ['#7c5cff', '#27c47d', '#ffb020', '#ff5c7c', '#35b7ff', '#c06cff', '#9be34a', '#ff8a4c'];

export const emoji: SlideType = {
  id: 'emoji',
  label: 'Emoji-Umfrage',
  icon: '😀',
  category: 'Umfrage',
  interactive: true,
  multi: true,
  defaults: () => ({ question: 'Wie fühlt ihr euch?', emojis: ['😀', '😐', '😢', '🔥'] }),
  fields: [
    { key: 'question', label: 'Frage', kind: 'text' },
    { key: 'emojis', label: 'Emojis (eins pro Zeile, 2–6)', kind: 'list' },
  ],
  Stage: ({ data, ctx }) => {
    const e = clean(data.emojis);
    const c = tally(e.length, ctx.responses);
    return (
      <div class="col">
        <h2>{data.question}</h2>
        <div class="emojis">
          {e.map((x, i) => (
            <div class="em">
              <span style={{ fontSize: `${3 + Math.min(c[i], 20) * 0.15}em` }}>{x}</span>
              <b>{c[i]}</b>
            </div>
          ))}
        </div>
      </div>
    );
  },
  Player: ({ data, submit }) => (
    <>
      <h3>{data.question}</h3>
      <div class="choices row">
        {clean(data.emojis).map((x, i) => (
          <button class="choice big" onClick={() => submit(i)}>{x}</button>
        ))}
      </div>
      <p class="hint">Tippe so oft du willst!</p>
    </>
  ),
};

export const trueFalse: SlideType = {
  id: 'truefalse',
  label: 'Wahr / Falsch',
  icon: '✅',
  category: 'Umfrage',
  interactive: true,
  defaults: () => ({ statement: 'Die Aussage stimmt.' }),
  fields: [{ key: 'statement', label: 'Aussage', kind: 'text' }],
  Stage: ({ data, ctx }) => (
    <div class="col">
      <h2>{data.statement}</h2>
      <Bars options={['Wahr', 'Falsch']} counts={tally(2, ctx.responses)} />
    </div>
  ),
  Player: ({ data, submit, mine }) => (
    <>
      <h3>{data.statement}</h3>
      <Choice options={['Wahr', 'Falsch']} submit={submit} mine={mine} />
    </>
  ),
};

export const ranking: SlideType = {
  id: 'ranking',
  label: 'Ranking',
  icon: '🥇',
  category: 'Umfrage',
  interactive: true,
  defaults: () => ({ question: 'Was ist am wichtigsten?', items: ['Qualität', 'Geschwindigkeit', 'Preis'] }),
  fields: [
    { key: 'question', label: 'Frage', kind: 'text' },
    { key: 'items', label: 'Einträge', kind: 'list' },
  ],
  Stage: ({ data, ctx }) => {
    const items = clean(data.items);
    const s = rankScores(items.length, ctx.responses);
    const order = items.map((_, i) => i).sort((a, b) => s[b] - s[a]);
    return (
      <div class="col">
        <h2>{data.question}</h2>
        <Bars options={order.map((i) => `${items[i]}`)} counts={order.map((i) => s[i])} />
        <p class="hint">{ctx.responses.length} Rankings</p>
      </div>
    );
  },
  Player: ({ data, submit, mine }) => {
    const items = clean(data.items);
    const [order, setOrder] = useState(items.map((_, i) => i));
    const move = (p: number, d: number) => {
      const o = [...order];
      [o[p], o[p + d]] = [o[p + d], o[p]];
      setOrder(o);
    };
    const done = mine.length > 0;
    return (
      <>
        <h3>{data.question}</h3>
        <p class="hint">Wichtigstes nach oben.</p>
        {order.map((it, p) => (
          <div class="rank">
            <span class="grow">{p + 1}. {items[it]}</span>
            <button class="btn" disabled={done || p === 0} onClick={() => move(p, -1)}>↑</button>
            <button class="btn" disabled={done || p === order.length - 1} onClick={() => move(p, 1)}>↓</button>
          </div>
        ))}
        <button class="btn primary" disabled={done} onClick={() => submit(order)}>{done ? '✓ Gesendet' : 'Absenden'}</button>
      </>
    );
  },
};

export const matching: SlideType = {
  id: 'matching',
  label: 'Zuordnungs-Umfrage',
  icon: '🔗',
  category: 'Umfrage',
  interactive: true,
  defaults: () => ({ question: 'Was passt zusammen?', left: ['Apfel', 'Karotte'], right: ['Obst', 'Gemüse'] }),
  fields: [
    { key: 'question', label: 'Frage', kind: 'text' },
    { key: 'left', label: 'Spalte A', kind: 'list' },
    { key: 'right', label: 'Spalte B', kind: 'list' },
  ],
  Stage: ({ data, ctx }) => {
    const L = clean(data.left), R = clean(data.right);
    return (
      <div class="col">
        <h2>{data.question}</h2>
        <div class="two">
          {L.map((l, i) => (
            <div class="panelbox">
              <h3>{l}</h3>
              <Bars options={R} counts={tally(R.length, ctx.responses.map((r) => ({ ...r, data: (r.data as number[])[i] })))} />
            </div>
          ))}
        </div>
      </div>
    );
  },
  Player: ({ data, submit, mine }) => {
    const L = clean(data.left), R = clean(data.right);
    const [sel, setSel] = useState<number[]>(L.map(() => 0));
    return (
      <>
        <h3>{data.question}</h3>
        {L.map((l, i) => (
          <label>
            {l}
            <select disabled={mine.length > 0} onChange={(e) => setSel(sel.map((v, k) => (k === i ? Number((e.target as HTMLSelectElement).value) : v)))}>
              {R.map((r, j) => <option value={j}>{r}</option>)}
            </select>
          </label>
        ))}
        <button class="btn primary" disabled={mine.length > 0} onClick={() => submit(sel)}>{mine.length ? '✓ Gesendet' : 'Absenden'}</button>
      </>
    );
  },
};

export const matrix: SlideType = {
  id: 'matrix',
  label: '2×2-Matrix',
  icon: '🔲',
  category: 'Umfrage',
  interactive: true,
  defaults: () => ({ title: 'Aufwand vs. Wirkung', xLabel: 'Aufwand', yLabel: 'Wirkung', items: ['Idee A', 'Idee B', 'Idee C'] }),
  fields: [
    { key: 'title', label: 'Titel', kind: 'text' },
    { key: 'xLabel', label: 'X-Achse', kind: 'text' },
    { key: 'yLabel', label: 'Y-Achse', kind: 'text' },
    { key: 'items', label: 'Einträge (max. 8)', kind: 'list' },
  ],
  Stage: ({ data, ctx }) => {
    const items = clean(data.items).slice(0, 8);
    const xy = items.map((_, i) => {
      const rs = ctx.responses.filter((r) => Array.isArray(r.data) && (r.data as any)[i]);
      const m = (k: number) => (rs.length ? rs.reduce((a, r) => a + (r.data as any)[i][k], 0) / rs.length : 50);
      return [m(0), m(1)];
    });
    return (
      <div class="col">
        <h2>{data.title}</h2>
        <svg viewBox="0 0 500 360" class="chart">
          <rect x="40" y="10" width="440" height="310" fill="#0f1226" rx="8" />
          <line x1="260" y1="10" x2="260" y2="320" stroke="#555a88" />
          <line x1="40" y1="165" x2="480" y2="165" stroke="#555a88" />
          <text x="260" y="350" text-anchor="middle" fill="#9aa0c8" font-size="16">{data.xLabel} →</text>
          <text x="14" y="165" text-anchor="middle" fill="#9aa0c8" font-size="16" transform="rotate(-90 14 165)">{data.yLabel} →</text>
          {items.map((t, i) => (
            <g>
              <circle cx={40 + (xy[i][0] / 100) * 440} cy={320 - (xy[i][1] / 100) * 310} r="9" fill={COLORS[i % 8]} />
              <text x={50 + (xy[i][0] / 100) * 440} y={316 - (xy[i][1] / 100) * 310} fill="#f4f5ff" font-size="15">{t}</text>
            </g>
          ))}
        </svg>
      </div>
    );
  },
  Player: ({ data, submit, mine }) => {
    const items = clean(data.items).slice(0, 8);
    const [v, setV] = useState<number[][]>(items.map(() => [50, 50]));
    const set = (i: number, k: number, x: number) => setV(v.map((p, j) => (j === i ? p.map((q, m) => (m === k ? x : q)) : p)));
    return (
      <>
        <h3>{data.title}</h3>
        {items.map((t, i) => (
          <div class="panelbox">
            <b>{t}</b>
            <label>{data.xLabel}<input type="range" disabled={mine.length > 0} value={v[i][0]} onInput={(e) => set(i, 0, Number((e.target as HTMLInputElement).value))} /></label>
            <label>{data.yLabel}<input type="range" disabled={mine.length > 0} value={v[i][1]} onInput={(e) => set(i, 1, Number((e.target as HTMLInputElement).value))} /></label>
          </div>
        ))}
        <button class="btn primary" disabled={mine.length > 0} onClick={() => submit(v)}>{mine.length ? '✓ Gesendet' : 'Absenden'}</button>
      </>
    );
  },
};

export const radar: SlideType = {
  id: 'radar',
  label: 'Radar',
  icon: '🕸️',
  category: 'Umfrage',
  interactive: true,
  defaults: () => ({ question: 'Wie bewertet ihr das Team?', criteria: ['Kommunikation', 'Tempo', 'Qualität', 'Spaß'], max: 5 }),
  fields: [
    { key: 'question', label: 'Frage', kind: 'text' },
    { key: 'criteria', label: 'Kriterien (3–8)', kind: 'list' },
    { key: 'max', label: 'Maximalwert', kind: 'number' },
  ],
  Stage: ({ data, ctx }) => {
    const c = clean(data.criteria);
    const n = c.length;
    const avg = avgVectors(n, ctx.responses);
    const pt = (i: number, f: number) => {
      const a = (i / n) * 2 * Math.PI - Math.PI / 2;
      return `${250 + 150 * f * Math.cos(a)},${200 + 150 * f * Math.sin(a)}`;
    };
    return (
      <div class="col">
        <h2>{data.question}</h2>
        <svg viewBox="0 0 500 400" class="chart">
          {[0.25, 0.5, 0.75, 1].map((f) => (
            <polygon points={c.map((_, i) => pt(i, f)).join(' ')} fill="none" stroke="#555a88" />
          ))}
          <polygon points={avg.map((v, i) => pt(i, Math.min(1, v / data.max))).join(' ')} fill="#7c5cff88" stroke="#7c5cff" stroke-width="3" />
          {c.map((t, i) => {
            const [x, y] = pt(i, 1.15).split(',').map(Number);
            return <text x={x} y={y} text-anchor="middle" fill="#f4f5ff" font-size="16">{t} ({avg[i].toFixed(1)})</text>;
          })}
        </svg>
      </div>
    );
  },
  Player: ({ data, submit, mine }) => {
    const c = clean(data.criteria);
    const [v, setV] = useState<number[]>(c.map(() => Math.ceil(data.max / 2)));
    return (
      <>
        <h3>{data.question}</h3>
        {c.map((t, i) => (
          <label>
            {t}: <b>{v[i]}</b>
            <input type="range" min={1} max={data.max} disabled={mine.length > 0} value={v[i]} onInput={(e) => setV(v.map((x, k) => (k === i ? Number((e.target as HTMLInputElement).value) : x)))} />
          </label>
        ))}
        <button class="btn primary" disabled={mine.length > 0} onClick={() => submit(v)}>{mine.length ? '✓ Gesendet' : 'Absenden'}</button>
      </>
    );
  },
};

export const split: SlideType = {
  id: 'split',
  label: 'Punkte verteilen',
  icon: '🪙',
  category: 'Umfrage',
  interactive: true,
  defaults: () => ({ question: 'Verteilt euer Budget', items: ['Marketing', 'Produkt', 'Team'], total: 100 }),
  fields: [
    { key: 'question', label: 'Frage', kind: 'text' },
    { key: 'items', label: 'Einträge', kind: 'list' },
    { key: 'total', label: 'Punkte pro Person', kind: 'number' },
  ],
  Stage: ({ data, ctx }) => {
    const items = clean(data.items);
    const avg = avgVectors(items.length, ctx.responses).map((v) => Math.round(v * 10) / 10);
    return (
      <div class="col">
        <h2>{data.question}</h2>
        <p class="sub">Durchschnitt von {ctx.responses.length} Personen</p>
        <Bars options={items} counts={avg} />
      </div>
    );
  },
  Player: ({ data, submit, mine }) => {
    const items = clean(data.items);
    const [v, setV] = useState<number[]>(items.map(() => 0));
    const left = Number(data.total) - v.reduce((a, b) => a + b, 0);
    return (
      <>
        <h3>{data.question}</h3>
        <p class="hint">Noch zu verteilen: <b>{left}</b></p>
        {items.map((t, i) => (
          <label>
            {t}
            <input type="number" min={0} value={v[i]} disabled={mine.length > 0} onInput={(e) => setV(v.map((x, k) => (k === i ? Math.max(0, Number((e.target as HTMLInputElement).value) || 0) : x)))} />
          </label>
        ))}
        <button class="btn primary" disabled={left !== 0 || mine.length > 0} onClick={() => submit(v)}>{mine.length ? '✓ Gesendet' : 'Absenden'}</button>
      </>
    );
  },
};

export const ideaBoard: SlideType = {
  id: 'ideaboard',
  label: 'Ideenwand',
  icon: '🗒️',
  category: 'Umfrage',
  interactive: true,
  multi: true,
  defaults: () => ({ question: 'Eure Ideen?', max: 3 }),
  fields: [
    { key: 'question', label: 'Frage', kind: 'text' },
    { key: 'max', label: 'Ideen pro Person', kind: 'number' },
  ],
  Stage: ({ data, ctx }) => (
    <div class="col">
      <h2>{data.question}</h2>
      <div class="cards">
        {ctx.responses.map((r, i) => (
          <div class="card sticky" style={{ background: COLORS[i % 8] + '55', transform: `rotate(${((i * 7) % 5) - 2}deg)` }}>{String(r.data)}</div>
        ))}
      </div>
    </div>
  ),
  Player: ({ data, submit, mine }) => {
    const [v, setV] = useState('');
    const left = Number(data.max) - mine.length;
    return (
      <>
        <h3>{data.question}</h3>
        {left > 0 ? (
          <>
            <textarea value={v} maxLength={140} onInput={(e) => setV((e.target as HTMLTextAreaElement).value)} />
            <button class="btn primary" onClick={() => { if (v.trim()) { submit(v.trim()); setV(''); } }}>Aufhängen ({left} übrig)</button>
          </>
        ) : <p class="hint">✓ Alle Ideen gesendet</p>}
      </>
    );
  },
};

export const brainstorm: SlideType = {
  id: 'brainstorm',
  label: 'Brainstorming (mit Abstimmung)',
  icon: '💡',
  category: 'Umfrage',
  interactive: true,
  multi: true,
  live: true,
  defaults: () => ({ question: 'Eure Ideen?', ideas: 2, votes: 3 }),
  fields: [
    { key: 'question', label: 'Frage', kind: 'text' },
    { key: 'ideas', label: 'Ideen pro Person', kind: 'number' },
    { key: 'votes', label: 'Stimmen pro Person', kind: 'number' },
  ],
  Stage: ({ data, ctx }) => {
    const list = ideasWithVotes(ctx.responses);
    return (
      <div class="col">
        <h2>{data.question}</h2>
        <Bars options={list.map((i) => i.text)} counts={list.map((i) => i.votes)} />
      </div>
    );
  },
  Player: ({ data, submit, mine, live, pid }) => {
    const [v, setV] = useState('');
    const all = merge(live, mine);
    const list = ideasWithVotes(all);
    const myIdeas = list.filter((i) => i.pid === pid).length;
    const myVotes = new Set(all.filter((r) => r.pid === pid && (r.data as any)?.up).map((r) => (r.data as any).up as string));
    return (
      <>
        <h3>{data.question}</h3>
        {myIdeas < Number(data.ideas) && (
          <>
            <input value={v} maxLength={80} onInput={(e) => setV((e.target as HTMLInputElement).value)} />
            <button class="btn primary" onClick={() => { if (v.trim()) { submit(v.trim()); setV(''); } }}>Idee senden</button>
          </>
        )}
        <p class="hint">Stimmen übrig: {Number(data.votes) - myVotes.size}</p>
        {list.map((i) => (
          <div class="rank">
            <span class="grow">{i.text}</span>
            <button class="btn" disabled={myVotes.has(i.key) || myVotes.size >= Number(data.votes)} onClick={() => submit({ up: i.key })}>👍 {i.votes}</button>
          </div>
        ))}
      </>
    );
  },
};

/** Mehrfragen-Umfrage. Format je Zeile: Frage | Antwort A | Antwort B … */
export const survey: SlideType = {
  id: 'survey',
  label: 'Kurzumfrage (mehrere Fragen)',
  icon: '📑',
  category: 'Umfrage',
  interactive: true,
  defaults: () => ({ title: 'Feedback', questions: ['Wie war der Tag? | Gut | Okay | Schlecht', 'Weiterempfehlen? | Ja | Nein'] }),
  fields: [
    { key: 'title', label: 'Titel', kind: 'text' },
    { key: 'questions', label: 'Fragen (Frage | Antwort | Antwort …)', kind: 'list' },
  ],
  Stage: ({ data, ctx }) => {
    const qs = clean(data.questions).map((l) => l.split('|').map((s) => s.trim()));
    return (
      <div class="col">
        <h2>{data.title}</h2>
        <div class="two">
          {qs.map(([q, ...o], i) => (
            <div class="panelbox">
              <h3>{q}</h3>
              <Bars options={o} counts={tally(o.length, ctx.responses.map((r) => ({ ...r, data: (r.data as number[])[i] })))} />
            </div>
          ))}
        </div>
      </div>
    );
  },
  Player: ({ data, submit, mine }) => {
    const qs = clean(data.questions).map((l) => l.split('|').map((s) => s.trim()));
    const [a, setA] = useState<number[]>(qs.map(() => -1));
    const done = mine.length > 0;
    return (
      <>
        <h3>{data.title}</h3>
        {qs.map(([q, ...o], i) => (
          <div class="panelbox">
            <b>{q}</b>
            <div class="choices row">
              {o.map((t, j) => (
                <button class={'choice' + (a[i] === j ? ' picked' : '')} disabled={done} onClick={() => setA(a.map((x, k) => (k === i ? j : x)))}>{t}</button>
              ))}
            </div>
          </div>
        ))}
        <button class="btn primary" disabled={done || a.includes(-1)} onClick={() => submit(a)}>{done ? '✓ Gesendet' : 'Absenden'}</button>
      </>
    );
  },
};
