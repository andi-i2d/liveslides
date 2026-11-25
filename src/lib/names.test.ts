import { describe, expect, it } from 'vitest';
import { createNameRegistry, funnyName, funnyNameCount, nameMode, resolveName } from './names';
import { WORDS } from './namewords';

describe('Namensmodus', () => {
  it('Standard ist Pflicht; nur „optional“ schaltet um', () => {
    expect(nameMode(undefined)).toBe('required');
    expect(nameMode({})).toBe('required');
    expect(nameMode({ settings: { names: 'optional' } })).toBe('optional');
    expect(nameMode({ settings: { names: 'quatsch' } })).toBe('required');
  });
  it('Pflicht: leerer Name ist nicht erlaubt, sonst bereinigt und gekürzt', () => {
    expect(resolveName('   ', 'required', 'abc123')).toBeNull();
    expect(resolveName('  Mia   Muster ', 'required', 'abc123')).toBe('Mia Muster');
    expect(resolveName('x'.repeat(50), 'required', 'p')).toHaveLength(30);
  });
  it('optional: leer ergibt einen Zufallsnamen, ein eingegebener Name bleibt', () => {
    const a = resolveName('', 'optional', 'k4m9p')!;
    expect(a).toBe(funnyName('k4m9p'));
    expect(resolveName(' ', 'optional', 'k4m9p')).toBe(a);
    expect(resolveName('Lea', 'optional', 'k4m9p')).toBe('Lea');
  });
});

describe('Lustige Zufallsnamen', () => {
  const all = Object.entries(WORDS).flatMap(([l, w]) => w.adj.flatMap((a) => w.noun.map((n) => ({ l, a, n, name: `${a} ${n}` }))));

  it('sind pro Gerät stabil und haben die Form „Adjektiv Nomen“ mit gleichem Anfangsbuchstaben', () => {
    for (const pid of ['a', 'k4m9p', 'zz9plural', '', '12345', 'ÄÖÜ', 'x'.repeat(40)]) {
      const n = funnyName(pid);
      expect(n).toBe(funnyName(pid));
      const [a, noun, ...rest] = n.split(' ');
      expect(rest).toEqual([]);
      expect(a[0]).toBe(noun[0]);
    }
  });
  it('jede Kombination der Listen ist gültig: gleicher Buchstabe, max. 28 Zeichen, Großschreibung', () => {
    for (const { l, a, n, name } of all) {
      expect(a.startsWith(l), name).toBe(true);
      expect(n.startsWith(l), name).toBe(true);
      expect(name.length, name).toBeLessThanOrEqual(28); // Platz für „ 2“ unter dem 30-Zeichen-Limit
      expect(/^\p{Lu}/u.test(a) && /^\p{Lu}/u.test(n), name).toBe(true);
    }
  });
  it('Adjektive enden auf -er, keine doppelten Wörter, jeder Buchstabe hat genug Auswahl', () => {
    const seen = new Set<string>();
    for (const [l, w] of Object.entries(WORDS)) {
      expect(w.adj.length, l).toBeGreaterThanOrEqual(4);
      expect(w.noun.length, l).toBeGreaterThanOrEqual(4);
      for (const a of w.adj) expect(a.endsWith('er'), a).toBe(true);
      for (const x of [...w.adj, ...w.noun]) {
        expect(seen.has(x), `doppelt: ${x}`).toBe(false);
        seen.add(x);
      }
    }
    expect(funnyNameCount()).toBe(all.length);
    expect(funnyNameCount()).toBeGreaterThan(600);
  });
  it('enthalten keine Schimpfwörter oder Reizwörter (Stichwortliste)', () => {
    const banned = ['scheiß', 'scheiss', 'arsch', 'fick', 'wichs', 'hure', 'nazi', 'hitler', 'depp', 'idiot', 'trottel', 'dumm', 'blöd', 'spast', 'mongo', 'neger', 'schwul', 'fixer', 'kack', 'pisse', 'tod', 'mord', 'hass', 'krieg', 'nutte', 'fotze', 'schlampe', 'behindert', 'penis'];
    for (const { name } of all) for (const b of banned) expect(name.toLowerCase(), `${name} enthält „${b}“`).not.toContain(b);
  });
  it('verteilen sich über viele Buchstaben und Namen', () => {
    const names = new Set(Array.from({ length: 400 }, (_, i) => funnyName(`pid-${i}`)));
    const letters = new Set([...names].map((n) => n[0]));
    expect(names.size).toBeGreaterThan(250);
    expect(letters.size).toBeGreaterThanOrEqual(15);
  });
});

describe('Eindeutige Anzeigenamen', () => {
  it('der zweite gleiche Name bekommt eine Nummer, dieselbe Person behält ihren Namen', () => {
    const r = createNameRegistry();
    expect(r.assign('p1', 'Lustiger Luchs')).toBe('Lustiger Luchs');
    expect(r.assign('p2', 'Lustiger Luchs')).toBe('Lustiger Luchs 2');
    expect(r.assign('p3', 'lustiger luchs')).toBe('lustiger luchs 3'); // Groß-/Kleinschreibung egal
    expect(r.assign('p2', 'Lustiger Luchs')).toBe('Lustiger Luchs 2'); // stabil
    expect(r.assign('p2', 'Lustiger Luchs 2')).toBe('Lustiger Luchs 2'); // Handy sendet den zugewiesenen Namen zurück
    expect(r.assign('p1', 'Lustiger Luchs')).toBe('Lustiger Luchs');
  });
  it('wer den Namen ändert, bekommt neu vergeben (und gibt den alten frei)', () => {
    const r = createNameRegistry();
    r.assign('p1', 'Anna');
    r.assign('p2', 'Ben');
    expect(r.assign('p2', 'Anna')).toBe('Anna 2');
    expect(r.assign('p1', 'Clara')).toBe('Clara');
    expect(r.assign('p3', 'Anna')).toBe('Anna'); // der freigegebene Name ist wieder verfügbar
    expect(r.assign('p4', 'Anna')).toBe('Anna 3'); // „Anna“ und „Anna 2“ sind belegt
  });
});
