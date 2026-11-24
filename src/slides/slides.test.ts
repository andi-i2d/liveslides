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
