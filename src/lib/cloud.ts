import { useEffect, useState } from 'preact/hooks';
import type { Deck, Resp } from './types';
import { DRIVE_FOLDER_ID, authEnabled, currentUser, getToken } from './google';
import * as drive from './drive';
import { buildResults, resultsFileName, type ResultsMeta } from './results';

export type CloudStatus = { state: 'idle' | 'saving' | 'saved' | 'error'; message?: string; at?: number };
let status: CloudStatus = { state: 'idle' };
const subs = new Set<() => void>();
const setStatus = (s: CloudStatus) => {
  status = s;
  subs.forEach((f) => f());
};
export function useCloudStatus() {
  const [, force] = useState(0);
  useEffect(() => {
    const f = () => force((x) => x + 1);
    subs.add(f);
    return () => void subs.delete(f);
  }, []);
  return status;
}

const MAP_KEY = 'liveslides.drive.ids';
const ids: drive.IdMap = {
  get(k) {
    try { return JSON.parse(localStorage.getItem(MAP_KEY) ?? '{}')[k] ?? null; } catch { return null; }
  },
  set(k, v) {
    try {
      const m = JSON.parse(localStorage.getItem(MAP_KEY) ?? '{}');
      m[k] = v;
      localStorage.setItem(MAP_KEY, JSON.stringify(m));
    } catch { /* ignorieren */ }
  },
};

const env = (): drive.DriveEnv => ({ token: getToken, folderId: DRIVE_FOLDER_ID || undefined });
export const cloudReady = () => authEnabled && !!currentUser();

/** Speichervorgänge nacheinander ausführen, damit nie zwei „Neu anlegen“-Aufrufe derselben Datei parallel laufen. */
let chain: Promise<unknown> = Promise.resolve();
function enqueue(task: () => Promise<unknown>) {
  const run = chain.then(async () => {
    setStatus({ state: 'saving' });
    try {
      await task();
      setStatus({ state: 'saved', at: Date.now() });
    } catch (e: any) {
      console.warn('Drive:', e);
      setStatus({ state: 'error', message: String(e?.message ?? e) });
    }
  });
  chain = run;
  return run;
}

export function cloudSaveDeck(deck: Deck) {
  if (!cloudReady()) return Promise.resolve();
  return enqueue(() => drive.saveDeck(env(), ids, deck));
}

export function cloudSaveResults(deck: Deck, all: Record<string, Resp[]>, meta: ResultsMeta & { sessionId: string }) {
  if (!cloudReady()) return Promise.resolve();
  const json = buildResults(deck, all, { ...meta, savedAt: Date.now() });
  return enqueue(() => drive.saveResults(env(), ids, { sessionId: meta.sessionId, name: resultsFileName(deck.title, meta.code, meta.startedAt), json }));
}

export const cloudListDecks = () => drive.listJson(env(), drive.DECK_FOLDER);
export const cloudLoadDeck = (id: string) => drive.getJson<Deck>(env(), id);
