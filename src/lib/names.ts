import { WORDS } from './namewords';

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

const LETTERS = Object.keys(WORDS).sort();

/** Alle Zufallsnamen in fester Reihenfolge (Buchstabe, Adjektiv, Nomen). */
const POOL: string[] = LETTERS.flatMap((l) => WORDS[l].adj.flatMap((a) => WORDS[l].noun.map((n) => `${a} ${n}`)));
const POOL_SET = new Set(POOL.map((n) => n.toLowerCase()));

/** Anzahl möglicher Zufallsnamen. */
export const funnyNameCount = () => POOL.length;
export const isPoolName = (n: string) => POOL_SET.has(n.trim().toLowerCase());

/**
 * Lustiger Namensvorschlag aus der Wortliste, z. B. „Dreister Denker“ oder „Lustiger Luchs“:
 * Adjektiv und Nomen beginnen mit demselben Buchstaben. Pro Gerät (pid) und `variant` immer derselbe Name;
 * `variant` > 0 liefert einen anderen Vorschlag („🎲“).
 */
export function funnyName(pid: string, variant = 0): string {
  const h = hash(variant ? `${pid}#${variant}` : pid || 'x');
  const letter = LETTERS[h % LETTERS.length];
  const { adj, noun } = WORDS[letter];
  const a = adj[Math.floor(h / LETTERS.length) % adj.length];
  const n = noun[Math.floor(h / (LETTERS.length * adj.length)) % noun.length];
  return `${a} ${n}`;
}

/** Name aus dem Eingabefeld; leer oder nur Leerzeichen → der Vorschlag. Nie leer. */
export function resolveName(raw: string, pid: string): string {
  return raw.trim().replace(/\s+/g, ' ').slice(0, 30) || funnyName(pid);
}

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
/** Schrittweite für die Suche nach freien Namen; teilerfremd zur Poolgröße, damit wirklich alle erreicht werden. */
const STEP = (() => { let s = 7; while (gcd(s, POOL.length) !== 1) s++; return s; })();

/**
 * Hält Anzeigenamen in einer Präsentation eindeutig.
 * - Zufallsnamen aus der Liste: Ist der Name schon vergeben, bekommt die Person einen anderen **freien** Namen
 *   aus der Liste (ab dem Wunschplatz reihum). Bis zu `funnyNameCount()` Personen (699) gibt es so nie Nummern.
 * - Selbst getippte Namen (oder wenn der Pool erschöpft ist): „Anna“ → „Anna 2“ → „Anna 3“.
 * Dieselbe Person (pid) behält ihren Namen; ändert sie ihn, wird neu vergeben.
 */
export function createNameRegistry() {
  const byPid = new Map<string, { raw: string; final: string }>();
  return {
    assign(pid: string, raw: string): string {
      const cur = byPid.get(pid);
      if (cur && (cur.raw === raw || cur.final === raw)) return cur.final;
      const taken = new Set<string>();
      for (const [p, v] of byPid) if (p !== pid) taken.add(v.final.toLowerCase());
      let final = raw;
      if (taken.has(raw.toLowerCase()) && isPoolName(raw)) {
        const start = POOL.findIndex((n) => n.toLowerCase() === raw.trim().toLowerCase());
        for (let i = 1; i < POOL.length; i++) {
          const cand = POOL[(start + i * STEP) % POOL.length]; // STEP teilerfremd zur Poolgröße → besucht jeden Namen
          if (!taken.has(cand.toLowerCase())) { final = cand; break; }
        }
      }
      for (let i = 2; taken.has(final.toLowerCase()); i++) final = `${raw} ${i}`;
      byPid.set(pid, { raw, final });
      return final;
    },
  };
}
