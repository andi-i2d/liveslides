import type { SlideType } from '../lib/types';

/** Zwei Arten von Folien: zeigen (präsentierend) oder das Publikum macht per Handy mit (interaktiv). */
export type Mode = 'present' | 'interactive';

export const modeOf = (t: SlideType): Mode => (t.interactive ? 'interactive' : 'present');

/**
 * Gruppenname innerhalb des Modus. Präsentierende Folien aus Spiel/Quiz heißen „Werkzeuge“ (Glücksrad, Timer …)
 * bzw. „Auswertung“ (Rangliste), damit sie nicht unter Spielen oder Quiz einsortiert werden.
 */
export function groupOf(t: SlideType): string {
  if (t.interactive) return t.category;
  if (t.category === 'Spiel') return 'Werkzeuge';
  if (t.category === 'Quiz') return 'Auswertung';
  return t.category;
}

export interface Group { name: string; types: SlideType[] }

/** Folientypen je Modus und Gruppe, in der Reihenfolge der Registry. */
export function grouped(list: SlideType[]): Record<Mode, Group[]> {
  const out: Record<Mode, Group[]> = { present: [], interactive: [] };
  for (const t of list) {
    const groups = out[modeOf(t)];
    const name = groupOf(t);
    let g = groups.find((x) => x.name === name);
    if (!g) groups.push((g = { name, types: [] }));
    g.types.push(t);
  }
  return out;
}
