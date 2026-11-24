import type { Deck } from './types';
import { createSlide } from '../slides';

const KEY = 'liveslides.decks';
export const uid = () => Math.random().toString(36).slice(2, 10);

export function loadDecks(): Deck[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]');
  } catch {
    return [];
  }
}
export function saveDecks(d: Deck[]) {
  localStorage.setItem(KEY, JSON.stringify(d));
}
export function getDeck(id: string) {
  return loadDecks().find((d) => d.id === id);
}
export function saveDeck(deck: Deck) {
  const all = loadDecks();
  const i = all.findIndex((d) => d.id === deck.id);
  if (i >= 0) all[i] = deck;
  else all.push(deck);
  saveDecks(all);
}
export function deleteDeck(id: string) {
  saveDecks(loadDecks().filter((d) => d.id !== id));
}
export function newDeck(): Deck {
  const deck: Deck = {
    id: uid(),
    title: 'Neue Präsentation',
    slides: [createSlide('title'), createSlide('poll')],
  };
  saveDeck(deck);
  return deck;
}
export function joinCode() {
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 5 }, () => c[Math.floor(Math.random() * c.length)]).join('');
}
