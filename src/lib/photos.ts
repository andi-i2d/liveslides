import { getScopedToken } from './google';

/**
 * Google Fotos Picker API: Der Nutzer wählt ein Foto in einem eigenen Google-Fotos-Fenster, die App fragt im Takt ab,
 * lädt das gewählte Foto herunter und löscht die Sitzung wieder.
 * Ablauf: POST /sessions → pickerUri öffnen → GET /sessions/{id} bis mediaItemsSet → GET /mediaItems → Foto laden → DELETE.
 * Zugriffsbereich: photospicker.mediaitems.readonly (nur bei Bedarf angefordert, siehe getScopedToken).
 */
export const PHOTOS_SCOPE = 'https://www.googleapis.com/auth/photospicker.mediaitems.readonly';
const API = 'https://photospicker.googleapis.com/v1';

export type PhotosErrorCode = 'cancelled' | 'timeout' | 'api' | 'none' | 'download';
export class PhotosError extends Error {
  constructor(public code: PhotosErrorCode, message: string, public status?: number) {
    super(message);
  }
}

export type PhotosStatus =
  | { state: 'creating' }
  /** `blocked`: das Fenster konnte nicht automatisch geöffnet werden (Popup-Blocker) – Nutzer klickt auf „Google Fotos öffnen“ */
  | { state: 'waiting'; pickerUri: string; blocked: boolean }
  | { state: 'downloading' };

export interface PhotosEnv {
  token(): Promise<string>;
  fetch?: typeof fetch;
  open?(url: string): { closed: boolean } | null;
  sleep?(ms: number): Promise<void>;
  now?(): number;
  signal?: AbortSignal;
  onStatus?(s: PhotosStatus): void;
}

/** Protobuf-Dauer („3.5s“) in Millisekunden. */
export function parseDuration(s: unknown, fallbackMs: number): number {
  const m = typeof s === 'string' ? /^(\d+(?:\.\d+)?)s$/.exec(s.trim()) : null;
  return m ? Math.round(parseFloat(m[1]) * 1000) : fallbackMs;
}

/** Größtes Foto, das wir brauchen (wird danach ohnehin auf 180 KB verkleinert). */
export const PHOTO_SIZE = '=w1280-h1280';

export async function pickPhoto(env: PhotosEnv): Promise<Blob> {
  const f = env.fetch ?? fetch;
  const now = env.now ?? Date.now;
  // Abbrechen beendet das Warten sofort, nicht erst nach dem nächsten Abfrage-Takt
  const sleep =
    env.sleep ??
    ((ms: number) =>
      new Promise<void>((r) => {
        const timer = setTimeout(r, ms);
        env.signal?.addEventListener('abort', () => { clearTimeout(timer); r(); }, { once: true });
      }));
  const check = () => {
    if (env.signal?.aborted) throw new PhotosError('cancelled', 'Abgebrochen.');
  };

  async function api(path: string, init: RequestInit = {}) {
    const r = await f(`${API}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${await env.token()}`, ...(init.headers as Record<string, string>) },
    });
    if (!r.ok) {
      let msg = '';
      try {
        msg = (await r.json())?.error?.message ?? '';
      } catch { /* kein JSON */ }
      throw new PhotosError('api', `Google Fotos ${r.status}${msg ? `: ${msg}` : ''}`, r.status);
    }
    return r.json();
  }

  env.onStatus?.({ state: 'creating' });
  check();
  const session = await api('/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pickingConfig: { maxItemCount: '1' } }), // genau ein Foto
  });
  const id: string = session.id;
  try {
    // „/autoclose“ schließt das Google-Fotos-Fenster nach der Auswahl selbst
    const win = env.open?.(`${session.pickerUri}/autoclose`) ?? null;
    env.onStatus?.({ state: 'waiting', pickerUri: `${session.pickerUri}/autoclose`, blocked: !win });

    const interval = Math.max(300, parseDuration(session.pollingConfig?.pollInterval, 3000));
    const deadline = now() + parseDuration(session.pollingConfig?.timeoutIn, 120_000);
    let closedPolls = 0;
    for (;;) {
      await sleep(interval);
      check();
      const s = await api(`/sessions/${encodeURIComponent(id)}`);
      if (s.mediaItemsSet) break;
      if (now() > deadline) throw new PhotosError('timeout', 'Es wurde kein Foto gewählt (Zeit abgelaufen).');
      // Fenster zu und noch nichts gewählt: nach zwei weiteren Abfragen als „Abbrechen“ werten
      if (win?.closed && ++closedPolls >= 2) throw new PhotosError('cancelled', 'Abgebrochen.');
    }

    env.onStatus?.({ state: 'downloading' });
    const list = await api(`/mediaItems?sessionId=${encodeURIComponent(id)}&pageSize=1`);
    const item = (list.mediaItems ?? []).find((m: any) => !m.type || m.type === 'PHOTO');
    if (!item?.mediaFile?.baseUrl) throw new PhotosError('none', 'Es wurde kein Foto gewählt.');
    check();

    let blob: Blob;
    try {
      const r = await f(`${item.mediaFile.baseUrl}${PHOTO_SIZE}`, { headers: { Authorization: `Bearer ${await env.token()}` } });
      if (!r.ok) throw new PhotosError('download', `Das Foto konnte nicht geladen werden (HTTP ${r.status}).`, r.status);
      blob = await r.blob();
    } catch (e) {
      if (e instanceof PhotosError) throw e;
      // Netzwerk-/CORS-Fehler: der Browser darf das Foto nicht mit dem Zugriffstoken abrufen
      throw new PhotosError('download', 'Google erlaubt den direkten Abruf des Fotos aus dem Browser nicht (CORS). Bitte das Foto aus Google Fotos herunterladen und über „Vom Rechner …“ wählen.');
    }
    return blob;
  } finally {
    // Sitzung aufräumen (Ressourcenlimit), Fehler dabei sind egal
    try {
      await f(`${API}/sessions/${encodeURIComponent(id)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${await env.token()}` } });
    } catch { /* ignorieren */ }
  }
}

/** Für den Browser: Fenster öffnen, echtes Warten, Token mit Fotos-Bereich. */
export const pickGooglePhoto = (signal: AbortSignal, onStatus: (s: PhotosStatus) => void) =>
  pickPhoto({ token: () => getScopedToken(PHOTOS_SCOPE), open: (u) => window.open(u, '_blank'), signal, onStatus });
