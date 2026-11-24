import { describe, expect, it } from 'vitest';
import { types, typeList, createSlide } from '.';
import { leaderboardOf } from './quiz';
import { tally } from './interactive';

describe('Registry', () => {
  it('jeder Typ hat Defaults und Felder', () => {
    for (const t of typeList) {
      expect(t.defaults()).toBeTypeOf('object');
      for (const f of t.fields) expect(t.defaults()).toHaveProperty(f.key);
    }
  });
});

import { parsePairs } from './visual';

describe('Diagramm-Daten', () => {
  it('parsePairs liest Zeilen und ignoriert Fehler', () => {
    expect(parsePairs(['A; 3', 'B;4,5', 'kaputt', 'C; x', ''])).toEqual([
      { label: 'A', value: 3 },
      { label: 'B', value: 4.5 },
    ]);
  });
});

import { avgVectors, ideasWithVotes, rankScores } from './ideas';

import {
  maskWord, norm, parseBlanks, scoreBlanks, scoreCategorise, scoreClues, scoreMatch, scoreNumber, scoreOrder, scoreShort,
} from './grading';

describe('Phase 4 Bewertung', () => {
  it('Kurzantwort ignoriert Gross-/Kleinschreibung und Akzente', () => {
    const d = { answers: ['Paris', 'Straße'], points: 100 };
    expect(scoreShort(d, '  PARIS ')).toBe(100);
    expect(scoreShort(d, 'strasse')).toBe(100);
    expect(scoreShort(d, 'Rom')).toBe(0);
    expect(scoreShort(d, '')).toBe(0);
  });
  it('Zahl schätzen: nah = mehr Punkte', () => {
    const d = { answer: 100, points: 1000 };
    expect(scoreNumber(d, 100)).toBe(1000);
    expect(scoreNumber(d, 90)).toBe(900);
    expect(scoreNumber(d, 500)).toBe(0);
    expect(scoreNumber(d, 'abc')).toBe(0);
  });
  it('Reihenfolge: Teilpunkte pro richtiger Position', () => {
    const d = { items: ['a', 'b', 'c', 'd'], points: 1000 };
    expect(scoreOrder(d, [0, 1, 2, 3])).toBe(1000);
    expect(scoreOrder(d, [1, 0, 2, 3])).toBe(500);
  });
  it('Kategorien und Paare', () => {
    expect(scoreCategorise({ rows: ['A; x', 'B; y', 'C; x'], points: 90 }, [0, 1, 1])).toBe(60);
    expect(scoreMatch({ pairs: ['a; 1', 'b; 2'], points: 100 }, [0, 0])).toBe(50);
  });
  it('Lückentext', () => {
    expect(parseBlanks('Eins *a* zwei *b*.').map((p) => p.text)).toEqual(['Eins ', 'a', ' zwei ', 'b', '.']);
    expect(scoreBlanks({ text: 'x *Paris* y *Rom*', points: 100 }, ['paris', 'Wien'])).toBe(50);
  });
  it('Kreuzworträtsel, Maske, norm', () => {
    expect(scoreClues({ clues: ['h; Rom', 'g; Bern'], points: 100 }, ['rom', 'bern'])).toBe(100);
    expect(maskWord('Berlin')).toBe('B_r_i_');
    expect(norm('  Ä  Ö ')).toBe('a o');
  });
});

import { haversineKm, scoreMap, scorePin, xyToLatLon } from './grading';
import { parseHotspots } from './media';

describe('Phase 5 Bild/Karte', () => {
  it('Pin: Treffer = volle Punkte, ausserhalb = 0', () => {
    const d = { x: 50, y: 50, radius: 20, points: 1000 };
    expect(scorePin(d, [0.5, 0.5])).toBe(1000);
    expect(scorePin(d, [0.6, 0.5])).toBe(500);
    expect(scorePin(d, [0.9, 0.9])).toBe(0);
    expect(scorePin(d, 'x')).toBe(0);
  });
  it('Karte: Koordinaten und Entfernung', () => {
    expect(xyToLatLon(0.5, 0.5)).toEqual({ lat: 0, lon: 0 });
    expect(Math.round(haversineKm({ lat: 0, lon: 0 }, { lat: 0, lon: 90 }))).toBe(10008);
    const d = { lat: 0, lon: 0, maxKm: 1000, points: 100 };
    expect(scoreMap(d, [0.5, 0.5])).toBe(100);
    expect(scoreMap(d, [0.9, 0.5])).toBe(0);
  });
  it('Hotspots werden geparst (max. 8, ungueltige ignoriert)', () => {
    expect(parseHotspots(['10; 20; Hallo; Welt', 'kaputt', 'a; b; c'])).toEqual([{ x: 0.1, y: 0.2, text: 'Hallo; Welt' }]);
    expect(parseHotspots(Array(12).fill('1; 1; x'))).toHaveLength(8);
  });
});

import { BIG5_ITEMS, bracket, chestValue, makeGroups, makePairs, parseNode, personalityScores, SEP } from './gamelogic';
import { parseMcq } from './games';

describe('Phase 6 Spiele', () => {
  const v = (pid: string, d: number, vote: 0 | 1) => ({ pid, name: pid, data: { d, v: vote }, at: 0 });
  it('Gruppen: alle verteilt, Groessen max. 1 Unterschied', () => {
    const g = makeGroups(['a', 'b', 'c', 'd', 'e'], 2);
    expect(g.flat().sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(Math.abs(g[0].length - g[1].length)).toBeLessThanOrEqual(1);
    expect(makeGroups(['a'], 5)).toHaveLength(1);
  });
  it('Paare: ungerade Zahl ergibt ein Dreier-Team', () => {
    const p = makePairs(['a', 'b', 'c', 'd', 'e']);
    expect(p.flat()).toHaveLength(5);
    expect(p.map((x) => x.length).sort()).toEqual([2, 3]);
  });
  it('Turnier: Sieger ruecken auf, Gleichstand gewinnt A', () => {
    let b = bracket(['A', 'B', 'C', 'D'], [v('p1', 0, 1), v('p2', 0, 1), v('p1', 1, 0)]);
    expect(b.duels).toHaveLength(3);
    expect(b.duels[0].winner).toBe('B');
    expect(b.duels[1].winner).toBe('C');
    expect(b.duels[2]).toMatchObject({ a: 'B', b: 'C', winner: null });
    b = bracket(['A', 'B', 'C', 'D'], [v('p1', 0, 1), v('p1', 1, 0), v('p1', 2, 1), v('p2', 2, 1)]);
    expect(b.champion).toBe('C');
    expect(bracket(['A', 'B', 'C'], []).size).toBe(2);
  });
  it('Turnier: pro Person nur eine Stimme je Duell (letzte zaehlt)', () => {
    const b = bracket(['A', 'B'], [v('p1', 0, 0), v('p1', 0, 1)]);
    expect(b.duels[0]).toMatchObject({ ca: 0, cb: 1, winner: 'B' });
  });
  it('Truhen sind deterministisch', () => {
    expect(chestValue('p', 1)).toBe(chestValue('p', 1));
  });
  it('MCQ-Zeilen parsen', () => {
    expect(parseMcq('Frage? | A | B | C | 2')).toEqual({ q: 'Frage?', opts: ['A', 'B', 'C'], correct: 1 });
    expect(parseMcq('Frage? | A | B')).toEqual({ q: 'Frage?', opts: ['A', 'B'], correct: 0 });
  });
  it('Persoenlichkeit: umgekehrte Items werden gespiegelt', () => {
    const allFive = BIG5_ITEMS.map(() => 5);
    const s = personalityScores(allFive);
    expect(s).toEqual([3, 3, 3, 3, 3]); // 5 und (6-5)=1 → Mittel 3
    expect(personalityScores(BIG5_ITEMS.map((i) => (i.reverse ? 1 : 5)))).toEqual([5, 5, 5, 5, 5]);
  });
  it('Mindmap-Knoten', () => {
    expect(parseNode(`root${SEP}Idee`)).toEqual({ parent: 'root', text: 'Idee' });
    expect(parseNode('ohne')).toEqual({ parent: 'root', text: 'ohne' });
  });
});

describe('Phase 3 Auswertung', () => {
  const r = (pid: string, data: any, at = 0) => ({ pid, name: pid, data, at });
  it('Ranking: Borda-Punkte', () => {
    // Person 1: Item 2 > 0 > 1; Person 2: Item 2 > 1 > 0
    expect(rankScores(3, [r('a', [2, 0, 1]), r('b', [2, 1, 0])])).toEqual([3, 3, 6]);
  });
  it('Mittelwerte', () => {
    expect(avgVectors(2, [r('a', [2, 4]), r('b', [4, 0]), r('c', 'x')])).toEqual([3, 2]);
  });
  it('Ideen: Stimmen zählen je Person nur einmal', () => {
    const idea = r('a', 'Idee 1', 5);
    const key = 'a:5';
    const rs = [idea, r('b', { up: key }), r('b', { up: key }, 2), r('c', { up: key })];
    const out = ideasWithVotes(rs);
    expect(out).toHaveLength(1);
    expect(out[0].votes).toBe(2);
  });
});

describe('Auswertung', () => {
  it('zählt Stimmen', () => {
    const r = (d: number) => ({ pid: 'x', name: 'x', data: d, at: 0 });
    expect(tally(3, [r(0), r(2), r(2)])).toEqual([1, 0, 2]);
  });
  it('Rangliste summiert Quizpunkte', () => {
    const s = createSlide('quiz');
    const deck = { id: 'd', title: 't', slides: [s] };
    const all = {
      [s.id]: [
        { pid: 'a', name: 'Ann', data: 0, at: 0 },
        { pid: 'b', name: 'Ben', data: 1, at: 0 },
      ],
    };
    const lb = leaderboardOf(deck, all, types);
    expect(lb[0]).toMatchObject({ name: 'Ann', pts: 1000 });
    expect(lb[1].pts).toBe(0);
  });
});
