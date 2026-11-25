/**
 * Dünner Google-Drive-Client (REST v3). `fetch` und Token sind austauschbar, damit alles testbar bleibt.
 *
 * Ablage:  <Wurzelordner>/<Präsentationstitel>/<Titel>.json                          (die Präsentation)
 *                                              /<Datum> Ergebnisse (<Code>).json      (je Durchlauf)
 * Wurzelordner = `folderId` (z. B. Ordner im geteilten Laufwerk), sonst „LiveSlides“ im eigenen Drive.
 */
export interface DriveEnv {
  token(): Promise<string>;
  fetch?: typeof fetch;
  /** Fester Wurzelordner (z. B. im geteilten Laufwerk). Sonst wird „LiveSlides“ im eigenen Drive angelegt. */
  folderId?: string;
}
/** Merkt Drive-IDs pro Gerät. Ein leerer Wert gilt als „unbekannt“. */
export interface IdMap { get(k: string): string | null; set(k: string, v: string): void }

const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const FOLDER = 'application/vnd.google-apps.folder';
const SHARED = 'supportsAllDrives=true';
const ALL = `${SHARED}&includeItemsFromAllDrives=true`;

export class DriveError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function call(env: DriveEnv, url: string, init: RequestInit = {}) {
  const r = await (env.fetch ?? fetch)(url, {
    ...init,
    headers: { Authorization: `Bearer ${await env.token()}`, ...(init.headers as Record<string, string>) },
  });
  if (!r.ok) throw new DriveError(r.status, `Drive ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r;
}

const q = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
const enc = encodeURIComponent;
const notFound = (e: unknown) => e instanceof DriveError && e.status === 404;

/** Nur von dieser App gelesene Markierungen an Dateien/Ordnern (appProperties sind für andere Apps unsichtbar). */
export const APP = 'liveslides';

async function list<T>(env: DriveEnv, query: string, fields: string, extra = ''): Promise<T[]> {
  const r = await call(env, `${API}/files?q=${enc(query)}&fields=files(${fields})&pageSize=200&${ALL}${extra}`);
  return (await r.json()).files ?? [];
}

export async function findFolder(env: DriveEnv, name: string, parent?: string): Promise<string | null> {
  const query = [`name='${q(name)}'`, `mimeType='${FOLDER}'`, 'trashed=false', parent ? `'${q(parent)}' in parents` : null].filter(Boolean).join(' and ');
  return (await list<{ id: string }>(env, query, 'id'))[0]?.id ?? null;
}

async function createFolder(env: DriveEnv, name: string, parent?: string, appProperties?: Record<string, string>): Promise<string> {
  const r = await call(env, `${API}/files?fields=id&${SHARED}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: FOLDER, ...(parent ? { parents: [parent] } : {}), ...(appProperties ? { appProperties } : {}) }),
  });
  return (await r.json()).id;
}

export async function ensureFolder(env: DriveEnv, name: string, parent?: string): Promise<string> {
  return (await findFolder(env, name, parent)) ?? createFolder(env, name, parent);
}

const rootCache = new Map<string, Promise<string>>();
/** Wurzelordner: der konfigurierte Ordner oder „LiveSlides“ im eigenen Drive (pro Sitzung zwischengespeichert). */
export function rootFolder(env: DriveEnv): Promise<string> {
  if (env.folderId) return Promise.resolve(env.folderId);
  let p = rootCache.get('LiveSlides');
  if (!p) {
    p = ensureFolder(env, 'LiveSlides');
    p.catch(() => rootCache.delete('LiveSlides'));
    rootCache.set('LiveSlides', p);
  }
  return p;
}
export const clearFolderCache = () => rootCache.clear();

const safe = (s: string) => s.replace(/[\\/:*?"<>|]/g, '-').trim().slice(0, 80) || 'Ohne Titel';

/**
 * Unterordner einer Präsentation. Gefunden wird er über die Deck-ID (nicht über den Namen), daher bleibt er auch nach
 * Umbenennung derselbe; ändert sich der Titel, wird der Ordner umbenannt. Zwei Präsentationen mit gleichem Titel
 * bekommen getrennte Ordner.
 */
export async function deckFolder(env: DriveEnv, ids: IdMap, deck: { id: string; title: string }): Promise<string> {
  const idKey = `folder:${deck.id}`;
  const nameKey = `foldername:${deck.id}`;
  const name = safe(deck.title);
  const known = ids.get(idKey);
  if (known) {
    if (ids.get(nameKey) !== name) {
      try {
        await call(env, `${API}/files/${enc(known)}?fields=id&${SHARED}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }),
        });
        ids.set(nameKey, name);
      } catch (e) {
        if (notFound(e)) { ids.set(idKey, ''); return deckFolder(env, ids, deck); } // Ordner wurde gelöscht → neu anlegen
        // andere Fehler (z. B. keine Umbenennungsrechte): Ordner weiter verwenden
      }
    }
    return known;
  }
  const root = await rootFolder(env);
  const found = (await list<{ id: string }>(env, `'${q(root)}' in parents and mimeType='${FOLDER}' and trashed=false and appProperties has { key='deckId' and value='${q(deck.id)}' }`, 'id'))[0]?.id;
  const id = found ?? (await createFolder(env, name, root, { [APP]: 'deckfolder', deckId: deck.id }));
  ids.set(idKey, id);
  ids.set(nameKey, found ? '' : name); // gefundener Ordner: Name beim nächsten Speichern angleichen
  return id;
}

function multipart(meta: unknown, json: unknown) {
  const b = 'ls' + Math.random().toString(36).slice(2);
  const body = `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${b}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(json)}\r\n--${b}--`;
  return { body, type: `multipart/related; boundary=${b}` };
}

/** Datei anlegen oder (wenn bekannt) überschreiben. Fehlt die alte Datei, wird neu angelegt. */
export async function upsertJson(
  env: DriveEnv,
  o: { name: string; folderId: string; fileId?: string | null; json: unknown; kind?: 'deck' | 'results' },
): Promise<string> {
  if (o.fileId) {
    const m = multipart({ name: o.name }, o.json);
    try {
      const r = await call(env, `${UPLOAD}/files/${enc(o.fileId)}?uploadType=multipart&fields=id&${SHARED}`, {
        method: 'PATCH', headers: { 'Content-Type': m.type }, body: m.body,
      });
      return (await r.json()).id;
    } catch (e) {
      if (!notFound(e)) throw e;
    }
  }
  const meta = { name: o.name, parents: [o.folderId], mimeType: 'application/json', appProperties: { [APP]: o.kind ?? 'deck' } };
  const m = multipart(meta, o.json);
  const r = await call(env, `${UPLOAD}/files?uploadType=multipart&fields=id&${SHARED}`, {
    method: 'POST', headers: { 'Content-Type': m.type }, body: m.body,
  });
  return (await r.json()).id;
}

/** Fehlt der Präsentationsordner (404, z. B. gelöscht), Ordner neu anlegen und einmal wiederholen. */
async function inDeckFolder(env: DriveEnv, ids: IdMap, deck: { id: string; title: string }, fn: (folder: string) => Promise<string>) {
  try {
    return await fn(await deckFolder(env, ids, deck));
  } catch (e) {
    if (!notFound(e)) throw e;
    ids.set(`folder:${deck.id}`, '');
    return fn(await deckFolder(env, ids, deck));
  }
}

/**
 * Gemerkte Datei-IDs gelten nur zusammen mit dem Ordner, in dem die Datei liegt (Schlüssel enthält die Ordner-ID).
 * So wird nie eine Datei an einem anderen Ort überschrieben, z. B. eine aus einer früheren Ablage-Struktur
 * oder aus einem inzwischen gelöschten Ordner.
 */
export async function saveDeck(env: DriveEnv, ids: IdMap, deck: { id: string; title: string }) {
  return inDeckFolder(env, ids, deck, async (folder) => {
    const key = `deckfile:${folder}`;
    const id = await upsertJson(env, { name: `${safe(deck.title)}.json`, folderId: folder, fileId: ids.get(key), json: deck, kind: 'deck' });
    ids.set(key, id);
    return id;
  });
}

export async function saveResults(
  env: DriveEnv,
  ids: IdMap,
  o: { deck: { id: string; title: string }; sessionId: string; name: string; json: unknown },
) {
  return inDeckFolder(env, ids, o.deck, async (folder) => {
    const key = `resfile:${folder}:${o.sessionId}`;
    const id = await upsertJson(env, { name: `${safe(o.name)}.json`, folderId: folder, fileId: ids.get(key), json: o.json, kind: 'results' });
    ids.set(key, id);
    return id;
  });
}

export interface DriveFile { id: string; name: string; modifiedTime: string; folder?: string }

/** Alle gespeicherten Präsentationen (je Präsentationsordner unter dem Wurzelordner), neueste zuerst. */
export async function listDecks(env: DriveEnv): Promise<DriveFile[]> {
  const root = await rootFolder(env);
  const folders = await list<{ id: string; name: string }>(env, `'${q(root)}' in parents and mimeType='${FOLDER}' and trashed=false`, 'id,name');
  const byId = new Map(folders.map((f) => [f.id, f.name]));
  const files = await list<{ id: string; name: string; modifiedTime: string; parents?: string[] }>(
    env,
    `appProperties has { key='${APP}' and value='deck' } and trashed=false`,
    'id,name,modifiedTime,parents',
    '&corpora=allDrives&orderBy=modifiedTime desc',
  );
  return files
    .filter((f) => f.parents?.some((p) => byId.has(p)))
    .map((f) => ({ id: f.id, name: f.name, modifiedTime: f.modifiedTime, folder: byId.get(f.parents!.find((p) => byId.has(p))!) }));
}

export async function getJson<T = unknown>(env: DriveEnv, id: string): Promise<T> {
  const r = await call(env, `${API}/files/${enc(id)}?alt=media&${SHARED}`);
  return r.json();
}

export interface DriveImage { id: string; name: string; mimeType: string; modifiedTime: string; size?: string }

/** Bilddateien aus Drive (eigene und geteilte Laufwerke), neueste zuerst, optional nach Namen gefiltert. */
export async function listImages(env: DriveEnv, search = ''): Promise<DriveImage[]> {
  const s = search.trim();
  const query = ["mimeType contains 'image/'", 'trashed=false', s ? `name contains '${q(s)}'` : null].filter(Boolean).join(' and ');
  const r = await call(env, `${API}/files?q=${enc(query)}&fields=files(id,name,mimeType,modifiedTime,size)&pageSize=40&orderBy=modifiedTime desc&corpora=allDrives&${ALL}`);
  return (await r.json()).files ?? [];
}

/** Dateiinhalt (z. B. ein Bild) herunterladen. */
export async function getBlob(env: DriveEnv, id: string): Promise<Blob> {
  const r = await call(env, `${API}/files/${enc(id)}?alt=media&${SHARED}`);
  return r.blob();
}