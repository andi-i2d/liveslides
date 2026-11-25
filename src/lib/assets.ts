import type { Deck, Slide } from './types';
import { types } from '../slides';
import { PENDING, isDataUrl } from './images';

/** Felder einer Folie, die Bilder enthalten (kind: 'image'). */
export const imageKeys = (type: string): string[] => (types[type]?.fields ?? []).filter((f) => f.kind === 'image').map((f) => f.key);

/**
 * Deck für die Handys: eingebettete Bilder (Data-URLs) werden durch einen Platzhalter ersetzt, damit die
 * Deck-Nachricht klein bleibt. Bilder, die ein Handy anzeigt, kommen als eigene „asset“-Nachricht (siehe phoneAssets).
 */
export function stripImages(deck: Deck): Deck {
  return {
    ...deck,
    slides: deck.slides.map((s) => {
      const keys = imageKeys(s.type).filter((k) => isDataUrl(s.data?.[k]));
      if (!keys.length) return s;
      const data = { ...s.data };
      for (const k of keys) data[k] = PENDING;
      return { ...s, data };
    }),
  };
}

/** Eingebettete Bilder einer Folie, die das Handy braucht (nur Folientypen mit `phoneImages`), sonst null. */
export function phoneAssets(slide: Slide | undefined): Record<string, string> | null {
  if (!slide || !types[slide.type]?.phoneImages) return null;
  const out: Record<string, string> = {};
  for (const k of imageKeys(slide.type)) if (isDataUrl(slide.data?.[k])) out[k] = slide.data[k];
  return Object.keys(out).length ? out : null;
}

/** Folien-Daten mit den inzwischen eingetroffenen Bildern. */
export const withAssets = (slide: Slide, assets?: Record<string, string>) => (assets ? { ...slide.data, ...assets } : slide.data);

/** Für Ergebnisdateien: eingebettete Bilder durch einen Hinweis ersetzen (sonst enthält jede Datei dieselben Megabytes). */
export function redactImages(data: any): any {
  if (!data || typeof data !== 'object') return data;
  const out: any = Array.isArray(data) ? [...data] : { ...data };
  for (const k of Object.keys(out)) if (isDataUrl(out[k])) out[k] = '[eingebettetes Bild]';
  return out;
}
