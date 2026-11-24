import type { Resp } from '../lib/types';

export const keyOf = (r: Resp) => `${r.pid}:${r.at}`;

/** Ideen (Text) und Stimmen ({up: key}) trennen und Stimmen je Idee zählen. Pro Person zählt jede Idee max. 1×. */
export function ideasWithVotes(rs: Resp[]) {
  const votes = new Map<string, Set<string>>();
  for (const r of rs) {
    const k = (r.data as any)?.up;
    if (typeof k === 'string') {
      if (!votes.has(k)) votes.set(k, new Set());
      votes.get(k)!.add(r.pid);
    }
  }
  return rs
    .filter((r) => typeof r.data === 'string')
    .map((r) => ({ key: keyOf(r), text: r.data as string, name: r.name, pid: r.pid, votes: votes.get(keyOf(r))?.size ?? 0 }))
    .sort((a, b) => b.votes - a.votes);
}

/** Alle Antworten, die ein Handy kennt: Live-Liste vom Präsentator plus eigene (noch nicht zurückgespiegelte). */
export function merge(live: Resp[], mine: Resp[]) {
  const m = new Map<string, Resp>();
  for (const r of [...live, ...mine]) m.set(`${r.pid}:${r.at}:${JSON.stringify(r.data)}`, r);
  return [...m.values()];
}

/** Borda-Punkte: Platz 1 von n gibt n Punkte, letzter Platz 1. */
export function rankScores(n: number, rs: Resp[]) {
  const s = Array<number>(n).fill(0);
  for (const r of rs) (r.data as number[]).forEach((item, pos) => { if (s[item] !== undefined) s[item] += n - pos; });
  return s;
}

/** Mittelwert pro Position über Antworten, die number[] sind. */
export function avgVectors(n: number, rs: Resp[]) {
  const sum = Array<number>(n).fill(0);
  let c = 0;
  for (const r of rs) {
    if (!Array.isArray(r.data)) continue;
    c++;
    for (let i = 0; i < n; i++) sum[i] += Number((r.data as any[])[i]) || 0;
  }
  return c ? sum.map((v) => v / c) : sum;
}
