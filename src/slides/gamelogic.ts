import type { Resp } from '../lib/types';

export const SEP = '␟';

export function shuffled<T>(a: T[], rnd: () => number = Math.random) {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

/** Verteilt Namen zufällig auf k Gruppen (reihum, daher max. 1 Unterschied in der Größe). */
export function makeGroups(names: string[], k: number, rnd: () => number = Math.random) {
  const n = Math.max(1, Math.min(Math.floor(k) || 1, Math.max(1, names.length)));
  const groups: string[][] = Array.from({ length: n }, () => []);
  shuffled(names, rnd).forEach((nm, i) => groups[i % n].push(nm));
  return groups;
}

/** Paare; bei ungerader Zahl bildet die letzte Person ein Dreier-Team. */
export function makePairs(names: string[], rnd: () => number = Math.random) {
  const s = shuffled(names, rnd);
  const pairs: string[][] = [];
  for (let i = 0; i < s.length; i += 2) pairs.push(s.slice(i, i + 2));
  if (pairs.length > 1 && pairs[pairs.length - 1].length === 1) pairs[pairs.length - 2].push(...(pairs.pop() as string[]));
  return pairs;
}

export interface Duel { a: string | null; b: string | null; winner: string | null; ca: number; cb: number }

/**
 * K.-o.-Turnier: Duell d wird mit Stimmen {d, v:0|1} entschieden. Anzahl der Teilnehmer wird auf die größte
 * Zweierpotenz gekürzt. Gleichstand → Teilnehmer A. Spätere Duelle ergeben sich aus den Siegern der früheren.
 */
export function bracket(names: string[], votes: Resp[]) {
  let n = 2;
  while (n * 2 <= names.length) n *= 2;
  const comp = names.slice(0, n);
  const tally = new Map<string, number>(); // "d:pid" → v
  for (const r of votes) {
    const d = (r.data as any)?.d;
    const v = (r.data as any)?.v;
    if (Number.isInteger(d) && (v === 0 || v === 1)) tally.set(`${d}:${r.pid}`, v);
  }
  const counts = (d: number) => {
    let ca = 0, cb = 0;
    for (const [k, v] of tally) if (k.startsWith(`${d}:`)) v === 0 ? ca++ : cb++;
    return [ca, cb];
  };
  const duels: Duel[] = [];
  let current: (string | null)[] = comp;
  let idx = 0;
  while (current.length > 1) {
    const next: (string | null)[] = [];
    for (let i = 0; i < current.length; i += 2) {
      const [ca, cb] = counts(idx);
      const a = current[i], b = current[i + 1];
      const decided = ca + cb > 0;
      const winner = a === null || b === null ? null : decided ? (cb > ca ? b : a) : null;
      duels.push({ a, b, winner, ca, cb });
      next.push(winner);
      idx++;
    }
    current = next;
  }
  return { duels, champion: duels.length ? duels[duels.length - 1].winner : null, size: n };
}

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};
export const CHESTS = [100, 200, 300, 500, 1000];
/** Deterministischer Truhen-Gewinn je Person und Frage (damit Punkte reproduzierbar bleiben). */
export const chestValue = (pid: string, q: number) => CHESTS[hash(`${pid}:${q}`) % CHESTS.length];

export const BIG5 = ['Offenheit', 'Gewissenhaftigkeit', 'Extraversion', 'Verträglichkeit', 'Gelassenheit'];
/** Je Eigenschaft zwei Aussagen; die zweite ist umgekehrt formuliert. */
export const BIG5_ITEMS: { text: string; trait: number; reverse: boolean }[] = [
  { text: 'Ich probiere gern neue Dinge aus.', trait: 0, reverse: false },
  { text: 'Ich bleibe lieber bei Bewährtem.', trait: 0, reverse: true },
  { text: 'Ich erledige Aufgaben zuverlässig und gründlich.', trait: 1, reverse: false },
  { text: 'Ich lasse Dinge oft liegen.', trait: 1, reverse: true },
  { text: 'Ich bin gern unter vielen Menschen.', trait: 2, reverse: false },
  { text: 'Ich halte mich eher im Hintergrund.', trait: 2, reverse: true },
  { text: 'Ich gehe rücksichtsvoll auf andere ein.', trait: 3, reverse: false },
  { text: 'Ich setze meine Interessen oft hart durch.', trait: 3, reverse: true },
  { text: 'Ich bleibe auch unter Druck ruhig.', trait: 4, reverse: false },
  { text: 'Ich mache mir schnell Sorgen.', trait: 4, reverse: true },
];
/** Antworten 1–5 je Aussage → Mittelwert 1–5 je Eigenschaft. */
export function personalityScores(answers: number[]) {
  const sum = Array(5).fill(0), cnt = Array(5).fill(0);
  BIG5_ITEMS.forEach((it, i) => {
    const a = Number(answers[i]);
    if (!a) return;
    sum[it.trait] += it.reverse ? 6 - a : a;
    cnt[it.trait]++;
  });
  return sum.map((s, i) => (cnt[i] ? s / cnt[i] : 0));
}

/** Mindmap-Knoten: Antwort-Text "parentKey␟text". */
export function parseNode(s: string) {
  const i = s.indexOf(SEP);
  return i < 0 ? { parent: 'root', text: s } : { parent: s.slice(0, i), text: s.slice(i + 1) };
}
