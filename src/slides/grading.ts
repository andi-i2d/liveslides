/** Reine Bewertungsfunktionen für Quizfolien (gut testbar). Alle liefern Punkte 0..points. */

export const norm = (s: string) =>
  String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss').replace(/\s+/g, ' ').trim();

export const frac = (points: number, ok: number, total: number) => Math.round((Number(points) * ok) / Math.max(1, total));

export const clean = (a: string[]) => a.filter((s) => s.trim());

/** Akzeptierte Antworten: eine pro Zeile. */
export function scoreShort(d: { answers: string[]; points: number }, text: unknown) {
  const t = norm(String(text));
  return t && d.answers.some((a) => norm(a) === t) ? Number(d.points) : 0;
}

/** Je näher am Ziel, desto mehr Punkte; ab 100 % Abweichung 0. */
export function scoreNumber(d: { answer: number; points: number }, guess: unknown) {
  const g = Number(guess);
  if (!Number.isFinite(g)) return 0;
  const err = Math.abs(g - d.answer) / Math.max(1, Math.abs(d.answer));
  return Math.round(Number(d.points) * Math.max(0, 1 - err));
}

/** order[pos] = Index des Eintrags, den die Person an Position pos gesetzt hat. Richtig, wenn order[pos] === pos. */
export function scoreOrder(d: { items: string[]; points: number }, order: unknown) {
  if (!Array.isArray(order)) return 0;
  const n = clean(d.items).length;
  return frac(d.points, (order as number[]).filter((v, i) => v === i).length, n);
}

/** Zeilen "Eintrag; Kategorie" → Einträge + eindeutige Kategorien. */
export function parseCategorise(lines: string[]) {
  const rows = clean(lines)
    .map((l) => l.split(';').map((s) => s.trim()))
    .filter((p) => p.length >= 2 && p[0] && p[1]);
  const cats = [...new Set(rows.map((r) => r[1]))];
  return { items: rows.map((r) => ({ text: r[0], cat: cats.indexOf(r[1]) })), cats };
}
export function scoreCategorise(d: { rows: string[]; points: number }, answers: unknown) {
  if (!Array.isArray(answers)) return 0;
  const { items } = parseCategorise(d.rows);
  return frac(d.points, items.filter((it, i) => (answers as number[])[i] === it.cat).length, items.length);
}

/** Zeilen "Links; Rechts". Antwort: pro Zeile der gewählte Rechts-Index. */
export function parsePairs2(lines: string[]) {
  return clean(lines)
    .map((l) => l.split(';').map((s) => s.trim()))
    .filter((p) => p.length >= 2 && p[0] && p[1])
    .map((p) => ({ left: p[0], right: p[1] }));
}
export function scoreMatch(d: { pairs: string[]; points: number }, answers: unknown) {
  if (!Array.isArray(answers)) return 0;
  const p = parsePairs2(d.pairs);
  return frac(d.points, p.filter((_, i) => (answers as number[])[i] === i).length, p.length);
}

/** Text mit *Lücken*: "Paris ist die Hauptstadt von *Frankreich*". */
export function parseBlanks(text: string) {
  const parts: { text: string; blank: boolean }[] = [];
  const re = /\*([^*]+)\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index), blank: false });
    parts.push({ text: m[1], blank: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), blank: false });
  return parts;
}
export function scoreBlanks(d: { text: string; points: number }, answers: unknown) {
  if (!Array.isArray(answers)) return 0;
  const blanks = parseBlanks(d.text).filter((p) => p.blank);
  return frac(d.points, blanks.filter((b, i) => norm(b.text) === norm(String((answers as string[])[i] ?? ''))).length, blanks.length);
}

/** Jeder zweite Buchstabe wird zu "_" (Leerzeichen bleiben). */
export function maskWord(w: string) {
  let k = 0;
  return [...w].map((c) => (c === ' ' ? c : k++ % 2 === 1 ? '_' : c)).join('');
}

/** Zeilen "Hinweis; Lösung" (Kreuzworträtsel): Teilpunkte je richtigem Wort. */
export function scoreClues(d: { clues: string[]; points: number }, answers: unknown) {
  if (!Array.isArray(answers)) return 0;
  const c = parsePairs2(d.clues);
  return frac(d.points, c.filter((p, i) => norm(p.right) === norm(String((answers as string[])[i] ?? ''))).length, c.length);
}
