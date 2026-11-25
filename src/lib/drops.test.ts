import { describe, expect, it } from 'vitest';
import { dataUrlToBlob, extFor, imageOf, pendingDrops, photoFileName } from './drops';
import { types } from '../slides';

const JPG = 'data:image/jpeg;base64,' + btoa('JPEGDATA');
const resp = (pid: string, at: number, data: unknown, name = 'N') => ({ pid, name, at, data });

describe('Foto-Drop: Hilfen', () => {
  it('findet das Bild in den Antwortformaten', () => {
    expect(imageOf({ img: JPG, cap: 'x' })).toBe(JPG); // Foto teilen / Foto-Drop
    expect(imageOf(JPG)).toBe(JPG); // Antwort zeichnen
    expect(imageOf({ img: 'https://x/y.jpg' })).toBeNull(); // nur eingebettete Bilder
    expect(imageOf('Text')).toBeNull();
    expect(imageOf(null)).toBeNull();
    expect(imageOf({})).toBeNull();
  });
  it('wandelt Data-URLs verlustfrei in Blobs', async () => {
    const b = dataUrlToBlob(JPG);
    expect(b.type).toBe('image/jpeg');
    expect(await b.text()).toBe('JPEGDATA');
    expect(dataUrlToBlob('data:image/png;base64,' + btoa('PNG')).type).toBe('image/png');
  });
  it('Dateinamen: Zeitpunkt, Name, laufende Nummer, passende Endung', () => {
    const at = new Date(2026, 10, 25, 9, 5, 7).getTime();
    expect(photoFileName(at, 'Lustiger Luchs', 3)).toBe('2026-11-25 09.05.07 Lustiger Luchs 3.jpg');
    expect(photoFileName(at, 'Anna', 1, 'image/png')).toBe('2026-11-25 09.05.07 Anna 1.png');
    expect(extFor('application/x-unbekannt')).toBe('img');
  });
});

describe('Foto-Drop: welche Fotos noch gespeichert werden müssen', () => {
  const deck = {
    id: 'd', title: 'T',
    slides: [
      { id: 'drop', type: 'photodrop', data: {} },
      { id: 'share', type: 'photoshare', data: {} }, // „Foto teilen“ wird NICHT in Drive abgelegt
      { id: 'poll', type: 'poll', data: {} },
    ],
  };

  it('nur Folien mit Foto-Drop, nur Fotos, nur noch nicht gespeicherte, in Eingangsreihenfolge', () => {
    const all = {
      drop: [resp('b', 30, { img: JPG }), resp('a', 10, { img: JPG, cap: 'Hi' }), resp('c', 20, { img: 'https://x/y.jpg' })],
      share: [resp('a', 5, { img: JPG })],
      poll: [resp('a', 1, 0)],
    };
    const p = pendingDrops(deck, all, new Set(), types);
    expect(p.map((x) => x.key)).toEqual(['drop:a:10', 'drop:b:30']);
    expect(pendingDrops(deck, all, new Set(['drop:a:10']), types).map((x) => x.key)).toEqual(['drop:b:30']);
    expect(pendingDrops(deck, {}, new Set(), types)).toEqual([]);
  });
  it('dieselbe Person kann mehrere Fotos senden (Schlüssel enthält den Zeitpunkt)', () => {
    const all = { drop: [resp('a', 10, { img: JPG }), resp('a', 11, { img: JPG })] };
    expect(pendingDrops(deck, all, new Set(), types)).toHaveLength(2);
  });
});
