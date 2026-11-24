import { useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import type { Field, Resp, SlideType, StageCtx } from '../lib/types';
import { Bars, Choice, tally } from './interactive';
import { ytId } from './visual';
import {
  clean, maskWord, parseBlanks, parseCategorise, parsePairs2, scoreBlanks, scoreCategorise, scoreClues,
  scoreMatch, scoreNumber, scoreOrder, scoreShort,
} from './grading';

const POINTS: Field = { key: 'points', label: 'Punkte', kind: 'number' };
const shuffle = <T,>(a: T[]) => {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
};

interface PlayerProps { data: any; submit: (d: any) => void; mine: Resp[] }

/** Gemeinsame Folienhülle für bewertete Aufgaben: Frage, Anzahl Antworten, nach „Auflösen“ Lösung + Ø-Punkte. */
function graded(o: {
  id: string; label: string; icon: string;
  defaults: () => any; fields: Field[];
  title: (d: any) => string;
  body?: (d: any, ctx: StageCtx) => ComponentChildren;
  solution: (d: any) => ComponentChildren;
  score: (d: any, r: Resp) => number;
  Player: (p: PlayerProps) => ComponentChildren;
}): SlideType {
  return {
    id: o.id, label: o.label, icon: o.icon, category: 'Quiz', interactive: true,
    defaults: o.defaults, fields: o.fields, score: o.score,
    Stage: ({ data, ctx }) => {
      const n = ctx.responses.length;
      const avg = n ? Math.round(ctx.responses.reduce((a, r) => a + o.score(data, r), 0) / n) : 0;
      return (
        <div class="col">
          <h2>{o.title(data)}</h2>
          {o.body?.(data, ctx)}
          <p class="sub">{n} Antwort(en)</p>
          {ctx.reveal && (
            <div class="solution">
              <b>Lösung:</b> {o.solution(data)}
              <p class="sub">Ø {avg} von {data.points} Punkten</p>
            </div>
          )}
        </div>
      );
    },
    Player: (p) => o.Player(p),
  };
}

const Sent = ({ mine }: { mine: Resp[] }) => (mine.length ? <p class="hint">✓ Gesendet</p> : null);
const Submit = ({ mine, onClick, disabled }: { mine: Resp[]; onClick: () => void; disabled?: boolean }) => (
  <button class="btn primary" disabled={disabled || mine.length > 0} onClick={onClick}>{mine.length ? '✓ Gesendet' : 'Absenden'}</button>
);
const inputVal = (e: Event) => (e.target as HTMLInputElement).value;

export const shortAnswer = graded({
  id: 'shortanswer', label: 'Quiz: Kurzantwort', icon: '✍️',
  defaults: () => ({ question: 'Hauptstadt von Frankreich?', answers: ['Paris'], points: 1000 }),
  fields: [
    { key: 'question', label: 'Frage', kind: 'text' },
    { key: 'answers', label: 'Akzeptierte Antworten (eine pro Zeile)', kind: 'list' },
    POINTS,
  ],
  title: (d) => d.question,
  solution: (d) => clean(d.answers).join(' / '),
  score: (d, r) => scoreShort(d, r.data),
  Player: ({ data, submit, mine }) => {
    const [v, setV] = useState('');
    return (
      <>
        <h3>{data.question}</h3>
        <input value={v} disabled={mine.length > 0} onInput={(e) => setV(inputVal(e))} />
        <Submit mine={mine} disabled={!v.trim()} onClick={() => submit(v.trim())} />
      </>
    );
  },
});

export const trueFalseQuiz = graded({
  id: 'tfquiz', label: 'Quiz: Wahr/Falsch', icon: '☑️',
  defaults: () => ({ statement: 'Die Erde ist rund.', correct: 'Wahr', points: 1000 }),
  fields: [
    { key: 'statement', label: 'Aussage', kind: 'text' },
    { key: 'correct', label: 'Richtig ist', kind: 'select', options: [{ value: 'Wahr', label: 'Wahr' }, { value: 'Falsch', label: 'Falsch' }] },
    POINTS,
  ],
  title: (d) => d.statement,
  body: (d, ctx) => <Bars options={['Wahr', 'Falsch']} counts={tally(2, ctx.responses)} correct={ctx.reveal ? (d.correct === 'Wahr' ? 0 : 1) : undefined} />,
  solution: (d) => d.correct,
  score: (d, r) => ((r.data === 0 ? 'Wahr' : 'Falsch') === d.correct ? Number(d.points) : 0),
  Player: ({ data, submit, mine }) => (
    <>
      <h3>{data.statement}</h3>
      <Choice options={['Wahr', 'Falsch']} submit={submit} mine={mine} />
    </>
  ),
});

export const guessNumber = graded({
  id: 'guessnumber', label: 'Quiz: Zahl schätzen', icon: '🔢',
  defaults: () => ({ question: 'Wie hoch ist der Eiffelturm (in m)?', answer: 330, points: 1000 }),
  fields: [
    { key: 'question', label: 'Frage', kind: 'text' },
    { key: 'answer', label: 'Richtige Zahl', kind: 'number' },
    POINTS,
  ],
  title: (d) => d.question,
  solution: (d) => String(d.answer),
  score: (d, r) => scoreNumber(d, r.data),
  Player: ({ data, submit, mine }) => {
    const [v, setV] = useState('');
    return (
      <>
        <h3>{data.question}</h3>
        <input type="number" value={v} disabled={mine.length > 0} onInput={(e) => setV(inputVal(e))} />
        <Submit mine={mine} disabled={v === ''} onClick={() => submit(Number(v))} />
      </>
    );
  },
});

export const correctOrder = graded({
  id: 'correctorder', label: 'Quiz: Reihenfolge', icon: '🔢',
  defaults: () => ({ question: 'Bringe in die richtige Reihenfolge', items: ['Erster', 'Zweiter', 'Dritter', 'Vierter'], points: 1000 }),
  fields: [
    { key: 'question', label: 'Frage', kind: 'text' },
    { key: 'items', label: 'Einträge in RICHTIGER Reihenfolge', kind: 'list' },
    POINTS,
  ],
  title: (d) => d.question,
  solution: (d) => clean(d.items).map((s, i) => `${i + 1}. ${s}`).join('  ·  '),
  score: (d, r) => scoreOrder(d, r.data),
  Player: ({ data, submit, mine }) => {
    const items = clean(data.items);
    const [order, setOrder] = useState(() => shuffle(items.map((_, i) => i)));
    const move = (p: number, dlt: number) => {
      const o = [...order];
      [o[p], o[p + dlt]] = [o[p + dlt], o[p]];
      setOrder(o);
    };
    const done = mine.length > 0;
    return (
      <>
        <h3>{data.question}</h3>
        {order.map((it, p) => (
          <div class="rank">
            <span class="grow">{p + 1}. {items[it]}</span>
            <button class="btn" disabled={done || p === 0} onClick={() => move(p, -1)}>↑</button>
            <button class="btn" disabled={done || p === order.length - 1} onClick={() => move(p, 1)}>↓</button>
          </div>
        ))}
        <Submit mine={mine} onClick={() => submit(order)} />
      </>
    );
  },
});

export const categorise = graded({
  id: 'categorise', label: 'Quiz: Kategorien zuordnen', icon: '🗂️',
  defaults: () => ({ question: 'Obst oder Gemüse?', rows: ['Apfel; Obst', 'Karotte; Gemüse', 'Birne; Obst', 'Gurke; Gemüse'], points: 1000 }),
  fields: [
    { key: 'question', label: 'Frage', kind: 'text' },
    { key: 'rows', label: 'Zeilen: Eintrag; Kategorie', kind: 'list' },
    POINTS,
  ],
  title: (d) => d.question,
  solution: (d) => {
    const { items, cats } = parseCategorise(d.rows);
    return cats.map((c, ci) => `${c}: ${items.filter((i) => i.cat === ci).map((i) => i.text).join(', ')}`).join('  ·  ');
  },
  score: (d, r) => scoreCategorise(d, r.data),
  Player: ({ data, submit, mine }) => {
    const { items, cats } = parseCategorise(data.rows);
    const [sel, setSel] = useState<number[]>(items.map(() => -1));
    return (
      <>
        <h3>{data.question}</h3>
        {items.map((it, i) => (
          <label>
            {it.text}
            <select disabled={mine.length > 0} value={sel[i]} onChange={(e) => setSel(sel.map((v, k) => (k === i ? Number(inputVal(e)) : v)))}>
              <option value={-1}>– wählen –</option>
              {cats.map((c, ci) => <option value={ci}>{c}</option>)}
            </select>
          </label>
        ))}
        <Submit mine={mine} disabled={sel.includes(-1)} onClick={() => submit(sel)} />
      </>
    );
  },
});

export const matchPairs = graded({
  id: 'matchpairs', label: 'Quiz: Paare finden', icon: '🧩',
  defaults: () => ({ question: 'Was gehört zusammen?', pairs: ['Hund; bellt', 'Katze; miaut', 'Kuh; muht'], points: 1000 }),
  fields: [
    { key: 'question', label: 'Frage', kind: 'text' },
    { key: 'pairs', label: 'Paare: Links; Rechts', kind: 'list' },
    POINTS,
  ],
  title: (d) => d.question,
  body: (d) => (
    <ul class="bullets">{parsePairs2(d.pairs).map((p) => <li>{p.left}</li>)}</ul>
  ),
  solution: (d) => parsePairs2(d.pairs).map((p) => `${p.left} = ${p.right}`).join('  ·  '),
  score: (d, r) => scoreMatch(d, r.data),
  Player: ({ data, submit, mine }) => {
    const pairs = parsePairs2(data.pairs);
    const [opts] = useState(() => shuffle(pairs.map((_, i) => i)));
    const [sel, setSel] = useState<number[]>(pairs.map(() => -1));
    return (
      <>
        <h3>{data.question}</h3>
        {pairs.map((p, i) => (
          <label>
            {p.left}
            <select disabled={mine.length > 0} value={sel[i]} onChange={(e) => setSel(sel.map((v, k) => (k === i ? Number(inputVal(e)) : v)))}>
              <option value={-1}>– wählen –</option>
              {opts.map((o) => <option value={o}>{pairs[o].right}</option>)}
            </select>
          </label>
        ))}
        <Submit mine={mine} disabled={sel.includes(-1)} onClick={() => submit(sel)} />
      </>
    );
  },
});

export const fillBlanks = graded({
  id: 'fillblanks', label: 'Quiz: Lückentext', icon: '📄',
  defaults: () => ({ text: 'Die Hauptstadt von Frankreich ist *Paris*.', points: 1000 }),
  fields: [{ key: 'text', label: 'Text (Lücken in *Sternchen*)', kind: 'textarea' }, POINTS],
  title: () => 'Lückentext',
  body: (d) => (
    <p class="body">{parseBlanks(d.text).map((p) => (p.blank ? <span class="blank">{'_'.repeat(Math.max(3, p.text.length))}</span> : p.text))}</p>
  ),
  solution: (d) => parseBlanks(d.text).filter((p) => p.blank).map((p) => p.text).join(', '),
  score: (d, r) => scoreBlanks(d, r.data),
  Player: ({ data, submit, mine }) => {
    const parts = parseBlanks(data.text);
    const n = parts.filter((p) => p.blank).length;
    const [v, setV] = useState<string[]>(Array(n).fill(''));
    let k = -1;
    return (
      <>
        <h3>Ergänze die Lücken</h3>
        <p>
          {parts.map((p) => {
            if (!p.blank) return p.text;
            const i = ++k;
            return <input class="inline" value={v[i]} disabled={mine.length > 0} onInput={(e) => setV(v.map((x, j) => (j === i ? inputVal(e) : x)))} />;
          })}
        </p>
        <Submit mine={mine} onClick={() => submit(v)} />
      </>
    );
  },
});

export const missingLetters = graded({
  id: 'missingletters', label: 'Quiz: Fehlende Buchstaben', icon: '🔤',
  defaults: () => ({ hint: 'Eine Hauptstadt', word: 'Berlin', points: 1000 }),
  fields: [
    { key: 'hint', label: 'Hinweis', kind: 'text' },
    { key: 'word', label: 'Gesuchtes Wort', kind: 'text' },
    POINTS,
  ],
  title: (d) => d.hint,
  body: (d) => <p class="big mono">{maskWord(d.word)}</p>,
  solution: (d) => d.word,
  score: (d, r) => scoreShort({ answers: [d.word], points: d.points }, r.data),
  Player: ({ data, submit, mine }) => {
    const [v, setV] = useState('');
    return (
      <>
        <h3>{data.hint}</h3>
        <p class="big mono">{maskWord(data.word)}</p>
        <input value={v} placeholder="Ganzes Wort eingeben" disabled={mine.length > 0} onInput={(e) => setV(inputVal(e))} />
        <Submit mine={mine} disabled={!v.trim()} onClick={() => submit(v.trim())} />
      </>
    );
  },
});

export const crossword = graded({
  id: 'crossword', label: 'Quiz: Kreuzworträtsel', icon: '📰',
  defaults: () => ({ clues: ['Gelbes Obst; Banane', 'Hauptstadt von Italien; Rom'], points: 1000 }),
  fields: [{ key: 'clues', label: 'Zeilen: Hinweis; Lösung', kind: 'list' }, POINTS],
  title: () => 'Kreuzworträtsel',
  body: (d, ctx) => (
    <ol class="bullets">
      {parsePairs2(d.clues).map((c) => (
        <li>{c.left} <small class="hint">({c.right.length} Buchstaben)</small>{ctx.reveal && <b> → {c.right}</b>}</li>
      ))}
    </ol>
  ),
  solution: (d) => parsePairs2(d.clues).map((c) => c.right).join(', '),
  score: (d, r) => scoreClues(d, r.data),
  Player: ({ data, submit, mine }) => {
    const c = parsePairs2(data.clues);
    const [v, setV] = useState<string[]>(c.map(() => ''));
    return (
      <>
        <h3>Kreuzworträtsel</h3>
        {c.map((p, i) => (
          <label>
            {i + 1}. {p.left} ({p.right.length})
            <input value={v[i]} disabled={mine.length > 0} onInput={(e) => setV(v.map((x, j) => (j === i ? inputVal(e) : x)))} />
          </label>
        ))}
        <Submit mine={mine} onClick={() => submit(v)} />
      </>
    );
  },
});

/** YouTube-Quiz: Video auf der Bühne, Auswahlfrage dazu. */
export const youtubeQuiz: SlideType = {
  id: 'ytquiz', label: 'Quiz: YouTube-Video', icon: '🎬', category: 'Quiz', interactive: true,
  defaults: () => ({ url: '', question: 'Was passiert im Video?', options: ['A', 'B', 'C'], correct: 1, points: 1000 }),
  fields: [
    { key: 'url', label: 'YouTube-Link', kind: 'url' },
    { key: 'question', label: 'Frage', kind: 'text' },
    { key: 'options', label: 'Antworten', kind: 'list' },
    { key: 'correct', label: 'Richtige Antwort (Nr., ab 1)', kind: 'number' },
    POINTS,
  ],
  score: (d, r) => (r.data === d.correct - 1 ? Number(d.points) : 0),
  Stage: ({ data, ctx }) => {
    const id = ytId(data.url);
    return (
      <div class="split">
        {id ? <iframe class="video" src={`https://www.youtube-nocookie.com/embed/${id}`} allow="encrypted-media; fullscreen" allowFullScreen /> : <p class="sub">YouTube-Link eintragen</p>}
        <div>
          <h2>{data.question}</h2>
          <Bars options={data.options} counts={tally(data.options.length, ctx.responses)} correct={ctx.reveal ? data.correct - 1 : undefined} />
        </div>
      </div>
    );
  },
  Player: ({ data, submit, mine }) => (
    <>
      <h3>{data.question}</h3>
      <Choice options={data.options} submit={submit} mine={mine} />
      <Sent mine={mine} />
    </>
  ),
};
