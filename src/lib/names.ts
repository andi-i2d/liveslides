import { WORDS } from './namewords';

/** Einstellung „Namen der Teilnehmer“: Pflicht (Standard) oder optional. */
export type NameMode = 'required' | 'optional';

export const nameMode = (d?: { settings?: { names?: string } }): NameMode =>
  d?.settings?.names === 'optional' ? 'optional' : 'required';

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

const LETTERS = Object.keys(WORDS).sort();

/** Anzahl möglicher Zufallsnamen. */
export const funnyNameCount = () => LETTERS.reduce((n, l) => n + WORDS[l].adj.length * WORDS[l].noun.length, 0);

/**
 * Lustiger Zufallsname aus der Wortliste, z. B. „Dreister Denker“ oder „Lustiger Luchs“:
 * Adjektiv und Nomen beginnen mit demselben Buchstaben. Pro Gerät (pid) immer derselbe Name.
 */
export function funnyName(pid: string): string {
  const h = hash(pid || 'x');
  const letter = LETTERS[h % LETTERS.length];
  const { adj, noun } = WORDS[letter];
  const a = adj[Math.floor(h / LETTERS.length) % adj.length];
  const n = noun[Math.floor(h / (LETTERS.length * adj.length)) % noun.length];
  return `${a} ${n}`;
}

/** Endgültiger Name oder null, wenn die Eingabe im gewählten Modus nicht reicht. */
export function resolveName(raw: string, mode: NameMode, pid: string): string | null {
  const n = raw.trim().replace(/\s+/g, ' ').slice(0, 30);
  if (n) return n;
  return mode === 'optional' ? funnyName(pid) : null;
}

/**
 * Hält Anzeigenamen in einer Präsentation eindeutig: Der zweite „Lustige Luchs“ wird zu „Lustiger Luchs 2“.
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
      for (let i = 2; taken.has(final.toLowerCase()); i++) final = `${raw} ${i}`;
      byPid.set(pid, { raw, final });
      return final;
    },
  };
}
