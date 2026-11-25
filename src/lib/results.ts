import type { Deck, Resp } from './types';
import { types } from '../slides';
import { leaderboardOf } from '../slides/quiz';

export interface ResultsMeta { code: string; startedAt: number; participants: number; savedAt?: number }

/** Alles, was nach einer Präsentation interessiert: Folien, Antworten je Folie, Rangliste. */
export function buildResults(deck: Deck, all: Record<string, Resp[]>, meta: ResultsMeta) {
  return {
    version: 1,
    deck: { id: deck.id, title: deck.title },
    code: meta.code,
    startedAt: new Date(meta.startedAt).toISOString(),
    savedAt: new Date(meta.savedAt ?? Date.now()).toISOString(),
    participants: meta.participants,
    leaderboard: leaderboardOf(deck, all, types),
    slides: deck.slides.map((s, i) => ({
      nr: i + 1,
      id: s.id,
      type: s.type,
      data: s.data,
      responses: (all[s.id] ?? []).map((r) => ({ name: r.name, pid: r.pid, at: new Date(r.at).toISOString(), answer: r.data })),
    })),
  };
}

/** Dateiname: „2026-11-24 18.05 Ergebnisse (CODE)“; der Präsentationstitel steht im Namen des Ordners. */
export function resultsFileName(code: string, startedAt: number) {
  const d = new Date(startedAt);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}.${p(d.getMinutes())} Ergebnisse (${code})`;
}

export const hasAnyResponse = (all: Record<string, Resp[]>) => Object.values(all).some((r) => r.length > 0);
