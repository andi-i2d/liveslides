import { describe, expect, it } from 'vitest';
import { typeList, types } from '.';
import { grouped, groupOf, modeOf } from './groups';

describe('Folienauswahl: präsentierend und interaktiv', () => {
  const g = grouped(typeList);

  it('jeder Folientyp landet genau einmal in genau einem Modus', () => {
    const ids = [...g.present, ...g.interactive].flatMap((x) => x.types.map((t) => t.id));
    expect(ids.length).toBe(typeList.length);
    expect(new Set(ids).size).toBe(typeList.length);
  });

  it('präsentierend sind genau die Folien ohne Eingaben vom Publikum', () => {
    const present = g.present.flatMap((x) => x.types.map((t) => t.id)).sort();
    expect(present).toEqual(
      ['title', 'content', 'listing', 'quote', 'image', 'video', 'diagram', 'comparison', 'swot', 'chart', 'qr', 'leaderboard', 'spinner', 'timer', 'calm', 'lookback'].sort(),
    );
    // Gegenprobe: präsentierende Folien haben keinen Handy-Player, interaktive schon
    for (const t of typeList) {
      if (modeOf(t) === 'present') expect(t.Player, t.id).toBeUndefined();
      else expect(t.Player, t.id).toBeDefined();
    }
  });

  it('Gruppen sind nie leer und heißen im Modus sinnvoll', () => {
    for (const mode of ['present', 'interactive'] as const) for (const x of g[mode]) expect(x.types.length).toBeGreaterThan(0);
    expect(g.present.map((x) => x.name)).toEqual(expect.arrayContaining(['Inhalt', 'Werkzeuge', 'Auswertung']));
    expect(g.interactive.map((x) => x.name)).toEqual(expect.arrayContaining(['Umfrage', 'Quiz', 'Bild', 'Spiel']));
    expect(g.interactive.map((x) => x.name)).not.toContain('Werkzeuge');
  });

  it('Foto teilen gibt es nur einmal in der Auswahl; der frühere Name photodrop läuft als Alias weiter', () => {
    const ids = typeList.map((t) => t.id);
    expect(ids).toContain('photoshare');
    expect(ids).not.toContain('photodrop');
    expect(types.photodrop).toBe(types.photoshare); // alte Präsentationen funktionieren weiter
    expect(types.photoshare.driveDrop).toBe(true); // Fotos landen immer in Drive
    expect(typeList.filter((t) => t.label.includes('Foto')).map((t) => t.id)).toEqual(['photoshare']);
  });

  it('Rangliste und Glücksrad sind präsentierend und heißen nicht Quiz/Spiel', () => {
    const by = (id: string) => typeList.find((t) => t.id === id)!;
    expect(modeOf(by('leaderboard'))).toBe('present');
    expect(groupOf(by('leaderboard'))).toBe('Auswertung');
    expect(groupOf(by('spinner'))).toBe('Werkzeuge');
    expect(groupOf(by('duckrace'))).toBe('Spiel');
  });
});
