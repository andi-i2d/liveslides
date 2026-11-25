import { describe, expect, it } from 'vitest';
import { createNameRegistry, funnyName, funnyNameCount, isPoolName, resolveName } from './names';
import { WORDS } from './namewords';

describe('Namenseingabe', () => {
  it('ein eingegebener Name wird bereinigt und auf 30 Zeichen gekürzt', () => {
    expect(resolveName('  Mia   Muster ', 'abc123')).toBe('Mia Muster');
    expect(resolveName('x'.repeat(50), 'p')).toHaveLength(30);
  });
  it('leere Eingabe ergibt den Vorschlag – der Name ist nie leer', () => {
    expect(resolveName('', 'k4m9p')).toBe(funnyName('k4m9p'));
    expect(resolveName('   ', 'k4m9p')).toBe(funnyName('k4m9p'));
    expect(resolveName('Lea', 'k4m9p')).toBe('Lea');
  });
  it('„Anderer Vorschlag“ (variant) liefert abweichende, aber stabile Namen', () => {
    const base = funnyName('geraet-1');
    const others = [1, 2, 3, 4, 5].map((v) => funnyName('geraet-1', v));
    expect(others.every((n) => isPoolName(n))).toBe(true);
    expect(new Set([base, ...others]).size).toBeGreaterThanOrEqual(5);
    expect(funnyName('geraet-1', 3)).toBe(others[2]);
    expect(funnyName('geraet-1', 0)).toBe(base);
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

describe('Bis 699 Teilnehmende: Zufallsnamen ohne Wiederholung und ohne Nummern', () => {
  it('699 Geräte bekommen 699 verschiedene Namen aus der Liste, keine mit Nummer', () => {
    const r = createNameRegistry();
    const finals = Array.from({ length: funnyNameCount() }, (_, i) => {
      const pid = `geraet-${i}`;
      return r.assign(pid, funnyName(pid)); // das Handy schickt seinen Wunschnamen (Hash der Geräte-ID)
    });
    expect(new Set(finals.map((n) => n.toLowerCase())).size).toBe(funnyNameCount());
    for (const n of finals) {
      expect(isPoolName(n), n).toBe(true);
      expect(/\d/.test(n), n).toBe(false);
    }
  });
  it('wiederholte Anfragen derselben Person ändern den Namen nicht', () => {
    const r = createNameRegistry();
    const first = Array.from({ length: 50 }, (_, i) => r.assign(`p${i}`, funnyName(`p${i}`)));
    const again = Array.from({ length: 50 }, (_, i) => r.assign(`p${i}`, funnyName(`p${i}`)));
    expect(again).toEqual(first);
    const renamed = Array.from({ length: 50 }, (_, i) => r.assign(`p${i}`, first[i])); // Handy schickt zugewiesenen Namen
    expect(renamed).toEqual(first);
  });
  it('die 700. Person bekommt (erst dann) eine Nummer; selbst getippte Namen werden nummeriert', () => {
    const r = createNameRegistry();
    for (let i = 0; i < funnyNameCount(); i++) r.assign(`g${i}`, funnyName(`g${i}`));
    const extra = r.assign('extra', 'Lustiger Luchs');
    expect(extra).toMatch(/^Lustiger Luchs \d+$/);
    const r2 = createNameRegistry();
    expect(r2.assign('a', 'Anna')).toBe('Anna');
    expect(r2.assign('b', 'Anna')).toBe('Anna 2');
  });
});

describe('Eindeutige Anzeigenamen', () => {
  it('gleiche Zufallsnamen werden durch einen anderen freien Listennamen ersetzt, getippte Namen nummeriert', () => {
    const r = createNameRegistry();
    expect(r.assign('p1', 'Lustiger Luchs')).toBe('Lustiger Luchs');
    const second = r.assign('p2', 'Lustiger Luchs');
    expect(second).not.toBe('Lustiger Luchs');
    expect(isPoolName(second)).toBe(true); // wieder ein lustiger Name, keine Nummer
    expect(r.assign('p2', 'Lustiger Luchs')).toBe(second); // stabil
    expect(r.assign('p2', second)).toBe(second); // Handy sendet den zugewiesenen Namen zurück
    expect(r.assign('p1', 'Lustiger Luchs')).toBe('Lustiger Luchs');
    expect(r.assign('p3', 'Anna')).toBe('Anna');
    expect(r.assign('p4', 'anna')).toBe('anna 2'); // Groß-/Kleinschreibung egal, getippt → Nummer
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
