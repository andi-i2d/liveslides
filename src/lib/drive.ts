/** Dünner Google-Drive-Client (REST v3). `fetch` und Token sind austauschbar, damit alles testbar bleibt. */
export interface DriveEnv {
  token(): Promise<string>;
  fetch?: typeof fetch;
  /** Fester Zielordner (z. B. im geteilten Laufwerk). Sonst wird „LiveSlides“ im eigenen Drive angelegt. */
  folderId?: string;
}
export interface IdMap { get(k: string): string | null; set(k: string, v: string): void }

const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const FOLDER = 'application/vnd.google-apps.folder';
const SHARED = 'supportsAllDrives=true';

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

export async function findFolder(env: DriveEnv, name: string, parent?: string): Promise<string | null> {
  const query = [`name='${q(name)}'`, `mimeType='${FOLDER}'`, 'trashed=false', parent ? `'${q(parent)}' in parents` : null].filter(Boolean).join(' and ');
  const r = await call(env, `${API}/files?q=${encodeURIComponent(query)}&fields=files(id)&pageSize=1&${SHARED}&includeItemsFromAllDrives=true`);
  return (await r.json()).files?.[0]?.id ?? null;
}

export async function ensureFolder(env: DriveEnv, name: string, parent?: string): Promise<string> {
  const found = await findFolder(env, name, parent);
  if (found) return found;
  const r = await call(env, `${API}/files?fields=id&${SHARED}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: FOLDER, ...(parent ? { parents: [parent] } : {}) }),
  });
  return (await r.json()).id;
}

const folderCache = new Map<string, Promise<string>>();
/** Wurzel + Unterordner (z. B. „Präsentationen“, „Ergebnisse“); pro Sitzung zwischengespeichert. */
export function folderFor(env: DriveEnv, sub: string): Promise<string> {
  const key = `${env.folderId ?? 'root'}/${sub}`;
  let p = folderCache.get(key);
  if (!p) {
    p = (async () => {
      const root = env.folderId || (await ensureFolder(env, 'LiveSlides'));
      return ensureFolder(env, sub, root);
    })();
    p.catch(() => folderCache.delete(key));
    folderCache.set(key, p);
  }
  return p;
}
export const clearFolderCache = () => folderCache.clear();

function multipart(meta: unknown, json: unknown) {
  const b = 'ls' + Math.random().toString(36).slice(2);
  const body = `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${b}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(json)}\r\n--${b}--`;
  return { body, type: `multipart/related; boundary=${b}` };
}

/** Datei anlegen oder (wenn bekannt) überschreiben. Fehlt die alte Datei, wird neu angelegt. */
export async function upsertJson(
  env: DriveEnv,
  o: { name: string; folderId: string; fileId?: string | null; json: unknown },
): Promise<string> {
  if (o.fileId) {
    const m = multipart({ name: o.name }, o.json);
    try {
      const r = await call(env, `${UPLOAD}/files/${encodeURIComponent(o.fileId)}?uploadType=multipart&fields=id&${SHARED}`, {
        method: 'PATCH', headers: { 'Content-Type': m.type }, body: m.body,
      });
      return (await r.json()).id;
    } catch (e) {
      if (!(e instanceof DriveError) || e.status !== 404) throw e;
    }
  }
  const m = multipart({ name: o.name, parents: [o.folderId], mimeType: 'application/json' }, o.json);
  const r = await call(env, `${UPLOAD}/files?uploadType=multipart&fields=id&${SHARED}`, {
    method: 'POST', headers: { 'Content-Type': m.type }, body: m.body,
  });
  return (await r.json()).id;
}

export interface DriveFile { id: string; name: string; modifiedTime: string }
export async function listJson(env: DriveEnv, sub: string): Promise<DriveFile[]> {
  const folder = await folderFor(env, sub);
  const query = `'${q(folder)}' in parents and trashed=false`;
  const r = await call(env, `${API}/files?q=${encodeURIComponent(query)}&orderBy=modifiedTime desc&pageSize=50&fields=files(id,name,modifiedTime)&${SHARED}&includeItemsFromAllDrives=true`);
  return (await r.json()).files ?? [];
}

export async function getJson<T = unknown>(env: DriveEnv, id: string): Promise<T> {
  const r = await call(env, `${API}/files/${encodeURIComponent(id)}?alt=media&${SHARED}`);
  return r.json();
}

const safe = (s: string) => s.replace(/[\\/:*?"<>|]/g, '-').trim().slice(0, 80) || 'Ohne Titel';

export const DECK_FOLDER = 'Präsentationen';
export const RESULT_FOLDER = 'Ergebnisse';

export async function saveDeck(env: DriveEnv, ids: IdMap, deck: { id: string; title: string }) {
  const key = `deck:${deck.id}`;
  const id = await upsertJson(env, { name: `${safe(deck.title)}.json`, folderId: await folderFor(env, DECK_FOLDER), fileId: ids.get(key), json: deck });
  ids.set(key, id);
  return id;
}

export async function saveResults(env: DriveEnv, ids: IdMap, o: { sessionId: string; name: string; json: unknown }) {
  const key = `res:${o.sessionId}`;
  const id = await upsertJson(env, { name: `${safe(o.name)}.json`, folderId: await folderFor(env, RESULT_FOLDER), fileId: ids.get(key), json: o.json });
  ids.set(key, id);
  return id;
}
