import { useEffect, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import type { Resp, SlideType } from '../lib/types';
import { Bars } from './interactive';
import { avgVectors, ideasWithVotes, keyOf, merge } from './ideas';
import { frac, norm } from './grading';
import {
  BIG5, BIG5_ITEMS, SEP, bracket, chestValue, makeGroups, makePairs, parseNode, personalityScores,
} from './gamelogic';
import { quiz } from './quiz';
import { types } from '.';

const COLORS = ['#7c5cff', '#27c47d', '#ffb020', '#ff5c7c', '#35b7ff', '#c06cff', '#9be34a', '#ff8a4c'];
const clean = (a: string[]) => a.filter((s) => s.trim());
const inputVal = (e: Event) => (e.target as HTMLInputElement).value;
const uniq = (a: string[]) => [...new Set(a.map((s) => s.trim()).filter(Boolean))];

/** "Frage | A | B | C | 2" → Frage, Antworten, richtige Nr. (ab 1). */
export function parseMcq(line: string) {
  const p = line.split('|').map((s) => s.trim());
  const correct = Number(p[p.length - 1]);
  const hasNum = p.length >= 4 && Number.isInteger(correct) && correct >= 1 && correct <= p.length - 2;
  const opts = hasNum ? p.slice(1, -1) : p.slice(1);
  return { q: p[0], opts, correct: hasNum ? correct - 1 : 0 };
}
const mcqs = (lines: string[]) => clean(lines).map(parseMcq).filter((m) => m.q && m.opts.length >= 2);

const Submit = ({ mine, onClick, disabled }: { mine: Resp[]; onClick: () => void; disabled?: boolean }) => (
  <button class="btn primary" disabled={disabled || mine.length > 0} onClick={onClick}>{mine.length ? '✓ Gesendet' : 'Absenden'}</button>
);

/** Player „Ich bin dabei“ (für Gruppen, Rennen …). */
function JoinPlayer({ title, mine, submit, name }: { title: string; mine: Resp[]; submit: (d: any) => void; name?: string }) {
  return (
    <>
      <h3>{title}</h3>
      <button class="btn primary big" disabled={mine.length > 0} onClick={() => submit(mine[0]?.name ?? name ?? 'Ich')}>{mine.length ? '✓ Du bist dabei!' : 'Ich bin dabei!'}</button>
    </>
  );
}
const namesOf = (manual: string[], rs: Resp[]) => uniq([...manual, ...rs.map((r) => r.name)]);

// ---------- Spinner ----------
export const spinner: SlideType = {
  id: 'spinner', label: 'Glücksrad', icon: '🎡', category: 'Spiel', interactive: false,
  defaults: () => ({ title: 'Wer ist dran?', items: ['Alex', 'Sam', 'Kim', 'Robin'] }),
  fields: [
    { key: 'title', label: 'Titel', kind: 'text' },
    { key: 'items', label: 'Einträge', kind: 'list' },
  ],
  Stage: ({ data }) => {
    const items = clean(data.items);
    const n = Math.max(1, items.length);
    const a = 360 / n;
    const [rot, setRot] = useState(0);
    const [win, setWin] = useState<string | null>(null);
    const spin = () => {
      const i = Math.floor(Math.random() * n);
      setWin(null);
      setRot(Math.ceil(rot / 360) * 360 + 360 * 5 - (i + 0.5) * a);
      setTimeout(() => setWin(items[i]), 4200);
    };
    const pt = (deg: number, r: number) => [150 + r * Math.cos(((deg - 90) * Math.PI) / 180), 150 + r * Math.sin(((deg - 90) * Math.PI) / 180)];
    return (
      <div class="center">
        <h2>{data.title}</h2>
        <div class="wheelwrap">
          <div class="pointer">▼</div>
          <svg viewBox="0 0 300 300" class="wheel" style={{ transform: `rotate(${rot}deg)` }}>
            {items.map((t, i) => {
              const [x1, y1] = pt(i * a, 145), [x2, y2] = pt((i + 1) * a, 145), [tx, ty] = pt((i + 0.5) * a, 90);
              return (
                <g>
                  <path d={n === 1 ? 'M150,5 a145,145 0 1,1 -0.1,0Z' : `M150,150 L${x1},${y1} A145,145 0 0 1 ${x2},${y2} Z`} fill={COLORS[i % 8]} />
                  <text x={tx} y={ty} fill="#fff" font-size="15" text-anchor="middle" transform={`rotate(${(i + 0.5) * a} ${tx} ${ty})`}>{t.slice(0, 14)}</text>
                </g>
              );
            })}
          </svg>
        </div>
        <button class="btn primary big" onClick={spin}>Drehen</button>
        {win && <p class="big">🎉 {win}</p>}
      </div>
    );
  },
};

// ---------- Timer & Calm ----------
export const timer: SlideType = {
  id: 'timer', label: 'Timer', icon: '⏱️', category: 'Spiel', interactive: false,
  defaults: () => ({ title: 'Zeit für die Aufgabe', seconds: 120 }),
  fields: [
    { key: 'title', label: 'Titel', kind: 'text' },
    { key: 'seconds', label: 'Sekunden', kind: 'number' },
  ],
  Stage: ({ data }) => {
    const [left, setLeft] = useState(Number(data.seconds));
    const [run, setRun] = useState(false);
    useEffect(() => setLeft(Number(data.seconds)), [data.seconds]);
    useEffect(() => {
      if (!run) return;
      const iv = setInterval(() => setLeft((l) => (l <= 1 ? (setRun(false), 0) : l - 1)), 1000);
      return () => clearInterval(iv);
    }, [run]);
    const mm = String(Math.floor(left / 60)).padStart(2, '0'), ss = String(left % 60).padStart(2, '0');
    return (
      <div class="center">
        <h2>{data.title}</h2>
        <p class={'huge mono' + (left === 0 ? ' alarm' : '')}>{mm}:{ss}</p>
        <div>
          <button class="btn primary" onClick={() => setRun(!run)}>{run ? 'Pause' : 'Start'}</button>{' '}
          <button class="btn" onClick={() => { setRun(false); setLeft(Number(data.seconds)); }}>Zurücksetzen</button>
        </div>
      </div>
    );
  },
};

export const calm: SlideType = {
  id: 'calm', label: 'Atempause', icon: '🧘', category: 'Spiel', interactive: false,
  defaults: () => ({ title: 'Atmet ruhig ein … und aus' }),
  fields: [{ key: 'title', label: 'Text', kind: 'text' }],
  Stage: ({ data }) => (
    <div class="center">
      <div class="breath" />
      <h2>{data.title}</h2>
    </div>
  ),
};

// ---------- Gruppen & Paare ----------
function grouper(kind: 'groups' | 'pairs'): SlideType {
  return {
    id: kind === 'groups' ? 'groupmaker' : 'pairmaker',
    label: kind === 'groups' ? 'Zufällige Gruppen' : 'Zufällige Paare',
    icon: kind === 'groups' ? '👥' : '👫',
    category: 'Spiel', interactive: true,
    defaults: () => ({ title: kind === 'groups' ? 'Gruppen bilden' : 'Paare bilden', names: [], groups: 3 }),
    fields: [
      { key: 'title', label: 'Titel', kind: 'text' },
      { key: 'names', label: 'Weitere Namen (optional, einer pro Zeile)', kind: 'list' },
      ...(kind === 'groups' ? [{ key: 'groups', label: 'Anzahl Gruppen', kind: 'number' as const }] : []),
    ],
    Stage: ({ data, ctx }) => {
      const names = namesOf(data.names, ctx.responses);
      const [res, setRes] = useState<string[][] | null>(null);
      return (
        <div class="col">
          <h2>{data.title}</h2>
          <p class="sub">{names.length} Personen: {names.join(', ')}</p>
          <button class="btn primary big" disabled={names.length < 2} onClick={() => setRes(kind === 'groups' ? makeGroups(names, data.groups) : makePairs(names))}>Zufällig verteilen</button>
          {res && (
            <div class="cards">
              {res.map((g, i) => (
                <div class="card" style={{ borderTop: `.3em solid ${COLORS[i % 8]}` }}>
                  <b>{kind === 'groups' ? `Gruppe ${i + 1}` : `Paar ${i + 1}`}</b>
                  <div>{g.join(' · ')}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    },
    Player: ({ data, mine, submit }) => <JoinPlayer title={data.title} mine={mine} submit={submit} />,
  };
}
export const groupMaker = grouper('groups');
export const pairMaker = grouper('pairs');

// ---------- Rennen ----------
function race(id: string, label: string, emoji: string, icon: string): SlideType {
  return {
    id, label, icon, category: 'Spiel', interactive: true,
    defaults: () => ({ title: `${label}!`, names: [] }),
    fields: [
      { key: 'title', label: 'Titel', kind: 'text' },
      { key: 'names', label: 'Weitere Teilnehmer (optional)', kind: 'list' },
    ],
    Stage: ({ data, ctx }) => {
      const names = namesOf(data.names, ctx.responses).slice(0, 20);
      const [dur, setDur] = useState<number[] | null>(null);
      const [go, setGo] = useState(false);
      const [done, setDone] = useState(false);
      const start = () => {
        const d = names.map(() => 4 + Math.random() * 5);
        setDur(d); setGo(false); setDone(false);
        setTimeout(() => setGo(true), 60);
        setTimeout(() => setDone(true), Math.max(...d) * 1000 + 200);
      };
      const best = dur ? dur.indexOf(Math.min(...dur)) : -1;
      return (
        <div class="col">
          <h2>{data.title}</h2>
          <div class="track">
            {names.map((n, i) => (
              <div class="lane">
                <span class="nm">{n}</span>
                <span class="runner" style={{ left: go && dur ? 'calc(100% - 2em)' : '0', transitionDuration: dur ? `${dur[i]}s` : '0s' }}>{emoji}</span>
              </div>
            ))}
          </div>
          <button class="btn primary big" disabled={names.length < 2} onClick={start}>Start!</button>
          {done && best >= 0 && <p class="big">🏆 {names[best]}</p>}
        </div>
      );
    },
    Player: ({ data, mine, submit }) => <JoinPlayer title={data.title} mine={mine} submit={submit} />,
  };
}
export const duckRace = race('duckrace', 'Entenrennen', '🦆', '🦆');
export const halloweenRace = race('halloweenrace', 'Halloween-Rennen', '👻', '🎃');

// ---------- Quiz-Spiele mit Blasen / Truhen ----------
const BUBBLE = ['#7c5cff', '#27c47d', '#ffb020', '#ff5c7c', '#35b7ff', '#c06cff'];
function Bubbles({ opts, onPick, disabled }: { opts: string[]; onPick: (i: number) => void; disabled?: boolean }) {
  return (
    <div class="bubbles">
      {opts.map((o, i) => (
        <button class="bubble" disabled={disabled} style={{ background: BUBBLE[i % 6], animationDelay: `${i * 0.4}s` }} onClick={() => onPick(i)}>{o}</button>
      ))}
    </div>
  );
}

/** Mehrere Fragen nacheinander auf dem Handy; am Ende Antworten absenden. */
function McqRun({ qs, mine, submit, done }: { qs: ReturnType<typeof mcqs>; mine: Resp[]; submit: (d: any) => void; done: (a: number[]) => ComponentChildren }) {
  const [i, setI] = useState(0);
  const [ans, setAns] = useState<number[]>([]);
  if (mine.length) return <>{done(mine[0].data as number[])}</>;
  if (i >= qs.length) return <Finish ans={ans} submit={submit} />;
  return (
    <>
      <p class="hint">Frage {i + 1} / {qs.length}</p>
      <h3>{qs[i].q}</h3>
      <Bubbles opts={qs[i].opts} onPick={(k) => { setAns([...ans, k]); setI(i + 1); }} />
    </>
  );
}
function Finish({ ans, submit }: { ans: number[]; submit: (d: any) => void }) {
  useEffect(() => submit(ans), []);
  return <p class="hint">Sende Antworten …</p>;
}

export const pickABoo: SlideType = {
  ...quiz, id: 'pickaboo', label: 'Quiz: Pick-a-Boo (Blasen)', icon: '🫧',
  Player: ({ data, submit, mine }) => (
    <>
      <h3>{data.question}</h3>
      <Bubbles opts={data.options} disabled={mine.length > 0} onPick={submit} />
      {mine.length > 0 && <p class="hint">✓ Platzt! Auflösung auf dem Bildschirm.</p>}
    </>
  ),
};

function mcqGame(o: {
  id: string; label: string; icon: string; title: string;
  score: (d: any, r: Resp) => number; maxPts: (d: any) => number; resultText: (d: any, a: number[], pid: string) => string;
}): SlideType {
  return {
    id: o.id, label: o.label, icon: o.icon, category: 'Quiz', interactive: true,
    defaults: () => ({ title: o.title, questions: ['Was ist 2 + 2? | 3 | 4 | 5 | 2', 'Hauptstadt von Italien? | Rom | Paris | Wien | 1'], points: 1000 }),
    fields: [
      { key: 'title', label: 'Titel', kind: 'text' },
      { key: 'questions', label: 'Fragen: Frage | Antwort | Antwort … | Nr. der richtigen', kind: 'list' },
      { key: 'points', label: 'Punkte (gesamt bzw. pro Frage)', kind: 'number' },
    ],
    score: o.score,
    Stage: ({ data, ctx }) => {
      const n = ctx.responses.length;
      const avg = n ? Math.round(ctx.responses.reduce((a, r) => a + o.score(data, r), 0) / n) : 0;
      return (
        <div class="col">
          <h2>{data.title}</h2>
          <p class="sub">{mcqs(data.questions).length} Fragen · {n} Teilnehmer fertig</p>
          {ctx.reveal && <div class="solution">Ø {avg} Punkte (max. {o.maxPts(data)})</div>}
        </div>
      );
    },
    Player: ({ data, submit, mine, pid }) => {
      const qs = mcqs(data.questions);
      return (
        <>
          <h3>{data.title}</h3>
          <McqRun qs={qs} mine={mine} submit={submit} done={(a) => <p class="hint">✓ Fertig! {o.resultText(data, a, pid)}</p>} />
        </>
      );
    },
  };
}
const correctCount = (d: any, a: unknown) => (Array.isArray(a) ? mcqs(d.questions).filter((m, i) => (a as number[])[i] === m.correct).length : 0);
export const bubbleRush = mcqGame({
  id: 'bubblerush', label: 'Quiz: Bubble Rush', icon: '🚀', title: 'Bubble Rush',
  score: (d, r) => frac(d.points, correctCount(d, r.data), mcqs(d.questions).length),
  maxPts: (d) => Number(d.points),
  resultText: (d, a) => `${correctCount(d, a)} von ${mcqs(d.questions).length} richtig.`,
});
export const treasureHunt = mcqGame({
  id: 'treasure', label: 'Quiz: Schatzsuche', icon: '💰', title: 'Schatzsuche',
  score: (d, r) => mcqs(d.questions).reduce((s, m, i) => s + ((r.data as number[])[i] === m.correct ? chestValue(r.pid, i) : 0), 0),
  maxPts: (d) => mcqs(d.questions).length * 1000,
  resultText: (d, a, pid) => {
    const g = mcqs(d.questions).reduce((s, m, i) => s + (a[i] === m.correct ? chestValue(pid, i) : 0), 0);
    return `Deine Truhen enthielten ${g} Gold 💰`;
  },
});

// ---------- Turnier ----------
export const tournament: SlideType = {
  id: 'tournament', label: 'Turnier (K.-o.-Abstimmung)', icon: '🏟️', category: 'Spiel', interactive: true, multi: true, live: true, steps: true,
  defaults: () => ({ title: 'Was ist besser?', names: ['Pizza', 'Pasta', 'Burger', 'Sushi'] }),
  fields: [
    { key: 'title', label: 'Titel', kind: 'text' },
    { key: 'names', label: 'Teilnehmer (2, 4, 8 oder 16)', kind: 'list' },
  ],
  Stage: ({ data, ctx }) => {
    const b = bracket(clean(data.names), ctx.responses);
    const d = b.duels[ctx.step];
    return (
      <div class="col">
        <h2>{data.title}</h2>
        {d ? (
          <>
            <p class="sub">Duell {ctx.step + 1} von {b.duels.length}</p>
            <Bars options={[d.a ?? '?', d.b ?? '?']} counts={[d.ca, d.cb]} />
          </>
        ) : (
          <p class="big">🏆 {b.champion ?? '–'}</p>
        )}
        <p class="hint">{b.duels.map((x, i) => `${i + 1}: ${x.a ?? '?'} vs ${x.b ?? '?'}${x.winner ? ` → ${x.winner}` : ''}`).join('  ·  ')}</p>
      </div>
    );
  },
  Player: ({ data, submit, mine, live, step }) => {
    const b = bracket(clean(data.names), merge(live, mine));
    const d = b.duels[step];
    if (!d) return <h3>🏆 {b.champion ?? '–'}</h3>;
    const voted = mine.find((r) => (r.data as any).d === step);
    return (
      <>
        <h3>Duell {step + 1}: Wer gewinnt?</h3>
        <div class="choices">
          {[d.a, d.b].map((n, v) => (
            <button class={'choice' + (voted && (voted.data as any).v === v ? ' picked' : '')} disabled={!!voted || !n} onClick={() => submit({ d: step, v })}>{n ?? '?'}</button>
          ))}
        </div>
        {voted && <p class="hint">✓ Stimme gezählt – wartet auf das nächste Duell.</p>}
      </>
    );
  },
};

// ---------- Team-Retro ----------
export const retro: SlideType = {
  id: 'retro', label: 'Team-Retro', icon: '🔁', category: 'Spiel', interactive: true, multi: true, live: true, steps: true,
  defaults: () => ({ title: 'Retrospektive', columns: ['Lief gut', 'Lief schlecht', 'Ideen'], votes: 3 }),
  fields: [
    { key: 'title', label: 'Titel', kind: 'text' },
    { key: 'columns', label: 'Spalten', kind: 'list' },
    { key: 'votes', label: 'Stimmen pro Person', kind: 'number' },
  ],
  Stage: ({ data, ctx }) => {
    const cols = clean(data.columns);
    const list = ideasWithVotes(ctx.responses).map((i) => ({ ...i, ...(() => { const [c, ...t] = i.text.split(SEP); return { col: Number(c), text: t.join(SEP) }; })() }));
    const phase = ['1 · Sammeln', '2 · Abstimmen', '3 · Ergebnis'][Math.min(ctx.step, 2)];
    return (
      <div class="col">
        <h2>{data.title} <small class="hint">{phase}</small></h2>
        <div class="retro" style={{ gridTemplateColumns: `repeat(${cols.length},1fr)` }}>
          {cols.map((c, ci) => (
            <div class="panelbox">
              <h3>{c}</h3>
              {list.filter((i) => i.col === ci).sort((a, b) => (ctx.step >= 1 ? b.votes - a.votes : 0)).map((i) => (
                <div class="card">{i.text}{ctx.step >= 1 && <b> · 👍 {i.votes}</b>}</div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  },
  Player: ({ data, submit, mine, live, pid, step }) => {
    const cols = clean(data.columns);
    const [col, setCol] = useState(0);
    const [v, setV] = useState('');
    const all = merge(live, mine);
    const list = ideasWithVotes(all);
    const voted = new Set(all.filter((r) => r.pid === pid && (r.data as any)?.up).map((r) => (r.data as any).up as string));
    if (step === 0)
      return (
        <>
          <h3>{data.title}: sammeln</h3>
          <select value={col} onChange={(e) => setCol(Number(inputVal(e)))}>{cols.map((c, i) => <option value={i}>{c}</option>)}</select>
          <textarea value={v} maxLength={140} onInput={(e) => setV(inputVal(e))} />
          <button class="btn primary" onClick={() => { if (v.trim()) { submit(`${col}${SEP}${v.trim()}`); setV(''); } }}>Aufhängen</button>
          <p class="hint">{mine.filter((r) => typeof r.data === 'string').length} Karte(n) von dir</p>
        </>
      );
    if (step === 1)
      return (
        <>
          <h3>Abstimmen (noch {Number(data.votes) - voted.size} Stimmen)</h3>
          {list.map((i) => (
            <div class="rank">
              <span class="grow">{i.text.split(SEP).slice(1).join(SEP)}</span>
              <button class="btn" disabled={voted.has(i.key) || voted.size >= Number(data.votes)} onClick={() => submit({ up: i.key })}>👍 {i.votes}</button>
            </div>
          ))}
        </>
      );
    return <p class="hint">Ergebnis auf dem großen Bildschirm 👀</p>;
  },
};

// ---------- Mindmap ----------
export const mindmap: SlideType = {
  id: 'mindmap', label: 'Mindmap', icon: '🧠', category: 'Spiel', interactive: true, multi: true, live: true,
  defaults: () => ({ topic: 'Thema', max: 4 }),
  fields: [
    { key: 'topic', label: 'Zentrales Thema', kind: 'text' },
    { key: 'max', label: 'Knoten pro Person', kind: 'number' },
  ],
  Stage: ({ data, ctx }) => {
    const nodes = ctx.responses.filter((r) => typeof r.data === 'string').map((r) => ({ key: keyOf(r), ...parseNode(r.data as string) }));
    const pos = new Map<string, [number, number, number]>([['root', [50, 50, 0]]]); // x,y,winkel
    const lines: { from: string; to: string }[] = [];
    const place = (parent: string, depth: number) => {
      const kids = nodes.filter((n) => n.parent === parent && !pos.has(n.key));
      const [px, py, pa] = pos.get(parent)!;
      kids.forEach((k, i) => {
        const a = depth === 1 ? (i / Math.max(1, kids.length)) * 2 * Math.PI : pa + (i - (kids.length - 1) / 2) * 0.5;
        const r = Math.min(46, 16 + depth * 15);
        const x = depth === 1 ? 50 + r * Math.cos(a) : px + 14 * Math.cos(a);
        const y = depth === 1 ? 50 + r * Math.sin(a) * 0.8 : py + 14 * Math.sin(a) * 0.8;
        pos.set(k.key, [Math.max(6, Math.min(94, x)), Math.max(6, Math.min(94, y)), a]);
        lines.push({ from: parent, to: k.key });
        place(k.key, depth + 1);
      });
    };
    place('root', 1);
    return (
      <div class="col" style={{ height: '100%' }}>
        <div class="mind">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none">
            {lines.map((l) => <line x1={pos.get(l.from)![0]} y1={pos.get(l.from)![1]} x2={pos.get(l.to)![0]} y2={pos.get(l.to)![1]} stroke="#555a88" stroke-width=".3" />)}
          </svg>
          <div class="mn root" style={{ left: '50%', top: '50%' }}>{data.topic}</div>
          {nodes.filter((n) => pos.has(n.key)).map((n, i) => (
            <div class="mn" style={{ left: `${pos.get(n.key)![0]}%`, top: `${pos.get(n.key)![1]}%`, background: COLORS[i % 8] }}>{n.text}</div>
          ))}
        </div>
      </div>
    );
  },
  Player: ({ data, submit, mine, live }) => {
    const all = merge(live, mine);
    const nodes = all.filter((r) => typeof r.data === 'string').map((r) => ({ key: keyOf(r), pid: r.pid, ...parseNode(r.data as string) }));
    const [parent, setParent] = useState('root');
    const [v, setV] = useState('');
    const left = Number(data.max) - mine.filter((r) => typeof r.data === 'string').length;
    return left > 0 ? (
      <>
        <h3>{data.topic}</h3>
        <select value={parent} onChange={(e) => setParent(inputVal(e))}>
          <option value="root">→ direkt an das Thema</option>
          {nodes.map((n) => <option value={n.key}>↳ {n.text}</option>)}
        </select>
        <input value={v} maxLength={40} onInput={(e) => setV(inputVal(e))} />
        <button class="btn primary" onClick={() => { if (v.trim()) { submit(`${parent}${SEP}${v.trim()}`); setV(''); } }}>Hinzufügen ({left} übrig)</button>
      </>
    ) : <p class="hint">✓ Alle Knoten gesetzt</p>;
  },
};

// ---------- Persönlichkeitstest ----------
export const personality: SlideType = {
  id: 'personality', label: 'Persönlichkeitstest', icon: '🪞', category: 'Spiel', interactive: true,
  defaults: () => ({ title: 'Wie ticken wir?' }),
  fields: [{ key: 'title', label: 'Titel', kind: 'text' }],
  Stage: ({ data, ctx }) => {
    const avg = avgVectors(5, ctx.responses);
    return (
      <div class="col">
        <h2>{data.title}</h2>
        <p class="sub">Gruppenschnitt von {ctx.responses.length} Personen (1–5)</p>
        <Bars options={BIG5} counts={avg.map((v) => Math.round(v * 10) / 10)} />
      </div>
    );
  },
  Player: ({ data, submit, mine }) => {
    const [a, setA] = useState<number[]>(BIG5_ITEMS.map(() => 3));
    const res = mine.length ? (mine[0].data as number[]) : null;
    return res ? (
      <>
        <h3>Dein Profil</h3>
        <Bars options={BIG5} counts={res.map((v) => Math.round(v * 10) / 10)} />
      </>
    ) : (
      <>
        <h3>{data.title}</h3>
        <p class="hint">1 = trifft nicht zu · 5 = trifft voll zu</p>
        {BIG5_ITEMS.map((it, i) => (
          <label>{it.text} <b>{a[i]}</b><input type="range" min={1} max={5} value={a[i]} onInput={(e) => setA(a.map((x, k) => (k === i ? Number(inputVal(e)) : x)))} /></label>
        ))}
        <button class="btn primary" onClick={() => submit(personalityScores(a))}>Auswerten</button>
      </>
    );
  },
};

// ---------- Rückblick ----------
export const lookBack: SlideType = {
  id: 'lookback', label: 'Rückblick auf frühere Folie', icon: '⏪', category: 'Spiel', interactive: false,
  defaults: () => ({ slide: 1 }),
  fields: [{ key: 'slide', label: 'Nummer der Folie, deren Ergebnis erneut gezeigt wird', kind: 'number' }],
  Stage: ({ data, ctx }) => {
    const s = ctx.deck.slides[Number(data.slide) - 1];
    const t = s && types[s.type];
    if (!s || !t || s.type === 'lookback') return <div class="center"><p class="sub">Folie {data.slide} nicht gefunden.</p></div>;
    return <t.Stage data={s.data} ctx={{ ...ctx, responses: ctx.all[s.id] ?? [], reveal: true }} />;
  },
};

// ---------- Escape Room ----------
export const escapeRoom: SlideType = {
  id: 'escape', label: 'Escape Room', icon: '🔐', category: 'Spiel', interactive: true,
  defaults: () => ({ title: 'Entkommt!', rooms: ['Wie viele Beine hat eine Spinne?; 8', 'Welche Farbe hat Rubin?; rot'], points: 1000 }),
  fields: [
    { key: 'title', label: 'Titel', kind: 'text' },
    { key: 'rooms', label: 'Räume: Rätsel; Lösung', kind: 'list' },
    { key: 'points', label: 'Punkte', kind: 'number' },
  ],
  score: (d, r) => frac(d.points, Number(r.data) || 0, clean(d.rooms).length),
  Stage: ({ data, ctx }) => {
    const rooms = clean(data.rooms);
    const solved = ctx.responses.map((r) => Number(r.data) || 0);
    return (
      <div class="col">
        <h2>{data.title}</h2>
        <Bars options={rooms.map((_, i) => `Raum ${i + 1} gelöst`)} counts={rooms.map((_, i) => solved.filter((s) => s >= i + 1).length)} />
        <p class="sub">{solved.filter((s) => s >= rooms.length).length} von {solved.length} entkommen</p>
      </div>
    );
  },
  Player: ({ data, submit, mine }) => {
    const rooms = clean(data.rooms).map((l) => { const [q, ...a] = l.split(';'); return { q: q.trim(), a: a.join(';').trim() }; });
    const [solved, setSolved] = useState(Number(mine[0]?.data) || 0);
    const [v, setV] = useState('');
    const [bad, setBad] = useState(false);
    if (solved >= rooms.length) return <h3>🎉 Ihr seid entkommen!</h3>;
    return (
      <>
        <h3>Raum {solved + 1} / {rooms.length}</h3>
        <p class="body">{rooms[solved].q}</p>
        <input value={v} onInput={(e) => { setV(inputVal(e)); setBad(false); }} />
        <button class="btn primary" onClick={() => {
          if (norm(v) === norm(rooms[solved].a)) { setSolved(solved + 1); submit(solved + 1); setV(''); } else setBad(true);
        }}>Tür öffnen</button>
        {bad && <p class="hint">Die Tür bleibt zu …</p>}
      </>
    );
  },
};

// ---------- Pumpkin Head Swap ----------
export const pumpkin: SlideType = {
  id: 'pumpkin', label: 'Kopf-Tausch (Kürbis & Co.)', icon: '🎃', category: 'Spiel', interactive: true,
  defaults: () => ({ title: 'Wählt euren Kopf', emojis: ['🎃', '👻', '🦇', '🕷️', '🧛', '🧟'] }),
  fields: [
    { key: 'title', label: 'Titel', kind: 'text' },
    { key: 'emojis', label: 'Köpfe (Emojis)', kind: 'list' },
  ],
  Stage: ({ data, ctx }) => {
    const e = clean(data.emojis);
    return (
      <div class="col">
        <h2>{data.title}</h2>
        <div class="gallery">
          {ctx.responses.map((r) => <figure class="head"><span>{e[Number(r.data)] ?? '❓'}</span><figcaption>{r.name}</figcaption></figure>)}
        </div>
      </div>
    );
  },
  Player: ({ data, submit, mine }) => (
    <>
      <h3>{data.title}</h3>
      <div class="choices row">
        {clean(data.emojis).map((x, i) => <button class={'choice big' + (mine.at(-1)?.data === i ? ' picked' : '')} onClick={() => submit(i)}>{x}</button>)}
      </div>
      <p class="hint">Du kannst jederzeit wechseln.</p>
    </>
  ),
};
