import { describe, expect, it } from 'vitest';
import { PENDING, candidateSizes, dataUrlBytes, fitSize, isDataUrl, MAX_IMAGE_BYTES } from './images';
import { phoneAssets, redactImages, stripImages, withAssets, imageKeys } from './assets';
import { createSlide } from '../slides';
import { buildResults } from './results';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const big = (kb: number) => 'data:image/jpeg;base64,' + 'A'.repeat(Math.round((kb * 1000 * 4) / 3));

describe('Bild-Hilfen', () => {
  it('erkennt Data-URLs und schätzt ihre Größe', () => {
    expect(isDataUrl(PNG)).toBe(true);
    expect(isDataUrl('https://x/y.png')).toBe(false);
    expect(isDataUrl(undefined)).toBe(false);
    expect(dataUrlBytes(big(100))).toBeGreaterThan(99_000);
    expect(dataUrlBytes(big(100))).toBeLessThan(101_000);
  });
  it('verkleinert proportional und vergrößert nie', () => {
    expect(fitSize(4000, 2000, 1000)).toEqual({ w: 1000, h: 500 });
    expect(fitSize(300, 200, 1000)).toEqual({ w: 300, h: 200 });
    expect(fitSize(1, 5000, 100)).toEqual({ w: 1, h: 100 });
  });
  it('probiert absteigende, einmalige Größen', () => {
    const c = candidateSizes(4000, 3000);
    expect(c[0]).toEqual({ w: 1280, h: 960 });
    expect(c.map((s) => s.w)).toEqual([1280, 1024, 800, 640, 480]);
    expect(candidateSizes(200, 100)).toEqual([{ w: 200, h: 100 }]); // kleines Bild: nur Originalgröße
    expect(MAX_IMAGE_BYTES).toBeLessThan(256_000); // passt in eine Realtime-Nachricht (Free-Plan)
  });
});

describe('Bilder im Deck und auf den Handys', () => {
  const pin = () => ({ ...createSlide('pinimage'), data: { question: 'Wo?', image: big(150) } });
  const content = () => ({ ...createSlide('content'), data: { title: 'T', body: 'x', image: big(150), layout: 'right' } });
  const urlSlide = () => ({ ...createSlide('pinimage'), data: { question: 'Wo?', image: 'https://example.org/a.jpg' } });

  it('kennt die Bildfelder der Folientypen', () => {
    expect(imageKeys('pinimage')).toEqual(['image']);
    expect(imageKeys('image')).toEqual(['url']);
    expect(imageKeys('title')).toEqual([]);
    expect(imageKeys('gibtsnicht')).toEqual([]);
  });
  it('das Deck für die Handys enthält keine eingebetteten Bilder, URLs bleiben', () => {
    const deck = { id: 'd', title: 'T', slides: [pin(), content(), urlSlide()] };
    const lite = stripImages(deck);
    expect(lite.slides[0].data.image).toBe(PENDING);
    expect(lite.slides[1].data.image).toBe(PENDING);
    expect(lite.slides[2].data.image).toBe('https://example.org/a.jpg');
    expect(JSON.stringify(lite).length).toBeLessThan(2000); // statt ~400 KB
    expect(JSON.stringify(deck).length).toBeGreaterThan(300_000);
    expect(deck.slides[0].data.image).toBe(big(150)); // Original bleibt unverändert
  });
  it('nur Folientypen, deren Handy-Ansicht das Bild zeigt, bekommen es als „asset“', () => {
    expect(phoneAssets(pin())).toEqual({ image: big(150) });
    expect(phoneAssets(content())).toBeNull(); // Inhaltsfolie: Bild nur auf dem Beamer
    expect(phoneAssets(urlSlide())).toBeNull(); // URL: Handy lädt sie selbst
    expect(phoneAssets(undefined)).toBeNull();
  });
  it('jede Bild-Nachricht bleibt unter dem 256-KB-Limit', () => {
    const msg = JSON.stringify({ t: 'asset', slideId: 'abcdefgh', fields: { image: big(MAX_IMAGE_BYTES / 1000) } });
    expect(msg.length).toBeLessThan(256_000);
  });
  it('withAssets setzt eingetroffene Bilder in die Folien-Daten ein', () => {
    const lite = stripImages({ id: 'd', title: 'T', slides: [pin()] }).slides[0];
    expect(withAssets(lite, undefined).image).toBe(PENDING);
    expect(withAssets(lite, { image: PNG }).image).toBe(PNG);
  });
  it('Ergebnisdateien enthalten keine Bild-Daten', () => {
    expect(redactImages({ a: PNG, b: 'x', c: 3 })).toEqual({ a: '[eingebettetes Bild]', b: 'x', c: 3 });
    const deck = { id: 'd', title: 'T', slides: [pin()] };
    const r = buildResults(deck, {}, { code: 'ABCDE', startedAt: 0, participants: 0 });
    expect(JSON.stringify(r)).not.toContain('data:image');
    expect(JSON.stringify(r)).toContain('[eingebettetes Bild]');
  });
});
