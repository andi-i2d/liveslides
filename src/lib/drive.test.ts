import { beforeEach, describe, expect, it } from 'vitest';
import { clearFolderCache, DriveError, getBlob, listDecks, listImages, saveDeck, saveResults, upsertJson, type DriveEnv, type IdMap } from './drive';
import { domainAllowed } from './google';
import { buildResults, resultsFileName } from './results';

interface F { id: string; name: string; mimeType: string; parents: string[]; appProperties?: Record<string, string>; json?: unknown; modifiedTime: string }
const FOLDER = 'application/vnd.google-apps.folder';

/** Minimaler Drive-Simulator: Ordner und Dateien im Speicher, inkl. Abfragen (q), Umbenennen, Multipart-Upload. */
function fakeDrive(opts: { preseed?: string[] } = {}) {
  const files = new Map<string, F>();
  const calls: { method: string; url: string }[] = [];
  let n = 0;
  const tick = () => new Date(2026, 0, 1, 0, 0, ++n).toISOString();
  for (const id of opts.preseed ?? []) files.set(id, { id, name: id, mimeType: FOLDER, parents: [], modifiedTime: tick() });

  const parseMultipart = (body: string, type: string) => {
    const b = /boundary=(.+)$/.exec(type)![1];
    const parts = body.split(`--${b}`).slice(1, -1).map((p) => p.split('\r\n\r\n').slice(1).join('\r\n\r\n').replace(/\r\n$/, ''));
    return { meta: JSON.parse(parts[0]), content: JSON.parse(parts[1]) };
  };
  const match = (f: F, query: string) => {
    const name = /(?:^|\s)name='((?:[^'\\]|\\.)*)'/.exec(query)?.[1];
    const mime = /mimeType='([^']+)'/.exec(query)?.[1];
    const parent = /'((?:[^'\\]|\\.)*)' in parents/.exec(query)?.[1];
    const prop = /appProperties has \{ key='([^']+)' and value='((?:[^'\\]|\\.)*)' \}/.exec(query);
    const mimeHas = /mimeType contains '([^']+)'/.exec(query)?.[1];
    const nameHas = /name contains '((?:[^'\\\\]|\\\\.)*)'/.exec(query)?.[1];
    if (mimeHas && !f.mimeType.includes(mimeHas)) return false;
    if (nameHas !== undefined && !f.name.toLowerCase().includes(nameHas.replace(/\\\\'/g, "'").toLowerCase())) return false;
    if (name !== undefined && f.name !== name.replace(/\\'/g, "'")) return false;
    if (mime && f.mimeType !== mime) return false;
    if (parent && !f.parents.includes(parent)) return false;
    if (prop && f.appProperties?.[prop[1]] !== prop[2]) return false;
    return true;
  };
  const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status });

  const fetchFn = (async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? 'GET';
    calls.push({ method, url });
    const headers = (init.headers ?? {}) as Record<string, string>;
    const upload = url.includes('/upload/');
    const fileId = /\/files\/([^/?]+)/.exec(url)?.[1];
    const id = fileId && decodeURIComponent(fileId);

    if (upload && method === 'PATCH') {
      const f = id && files.get(id);
      if (!f) return json({ error: 'nf' }, 404);
      const { meta, content } = parseMultipart(init.body as string, headers['Content-Type']);
      Object.assign(f, { name: meta.name ?? f.name, json: content, modifiedTime: tick() });
      return json({ id: f.id });
    }
    if (upload && method === 'POST') {
      const { meta, content } = parseMultipart(init.body as string, headers['Content-Type']);
      if (meta.parents?.some((p: string) => !files.has(p))) return json({ error: 'parent nf' }, 404);
      const f: F = { id: `file${++n}`, name: meta.name, mimeType: meta.mimeType, parents: meta.parents ?? [], appProperties: meta.appProperties, json: content, modifiedTime: tick() };
      files.set(f.id, f);
      return json({ id: f.id });
    }
    if (method === 'PATCH') {
      const f = id && files.get(id);
      if (!f) return json({ error: 'nf' }, 404);
      Object.assign(f, JSON.parse(init.body as string), { modifiedTime: tick() });
      return json({ id: f.id });
    }
    if (method === 'POST') {
      const b = JSON.parse(init.body as string);
      if (b.parents?.some((p: string) => !files.has(p))) return json({ error: 'parent nf' }, 404);
      const f: F = { id: `folder${++n}`, name: b.name, mimeType: b.mimeType, parents: b.parents ?? [], appProperties: b.appProperties, modifiedTime: tick() };
      files.set(f.id, f);
      return json({ id: f.id });
    }
    if (url.includes('alt=media')) return json(files.get(id!)?.json ?? null);
    const query = decodeURIComponent(/[?&]q=([^&]*)/.exec(url)![1]);
    let out = [...files.values()].filter((f) => match(f, query));
    if (url.includes('orderBy=modifiedTime')) out = out.sort((a, b) => b.modifiedTime.localeCompare(a.modifiedTime));
    return json({ files: out });
  }) as unknown as typeof fetch;

  const children = (parent: string) => [...files.values()].filter((f) => f.parents.includes(parent));
  return { files, calls, children, env: { token: async () => 'T', fetch: fetchFn } as DriveEnv };
}
const memMap = (): IdMap & { m: Record<string, string> } => {
  const m: Record<string, string> = {};
  return { m, get: (k) => m[k] || null, set: (k, v) => void (m[k] = v) };
};
const deck = (id: string, title: string) => ({ id, title });

beforeEach(() => clearFolderCache());

describe('Drive: ein Unterordner je Präsentation', () => {
  it('legt <Titel> im konfigurierten Wurzelordner an und speichert dort die JSON', async () => {
    const d = fakeDrive({ preseed: ['SHARED123'] });
    d.env.folderId = 'SHARED123';
    const ids = memMap();
    const fileId = await saveDeck(d.env, ids, deck('a1', 'Mein: Deck/1'));
    const folders = d.children('SHARED123');
    expect(folders).toHaveLength(1);
    expect(folders[0]).toMatchObject({ name: 'Mein- Deck-1', mimeType: FOLDER, appProperties: { liveslides: 'deckfolder', deckId: 'a1' } }); // unzulässige Zeichen ersetzt
    const inside = d.children(folders[0].id);
    expect(inside).toHaveLength(1);
    expect(inside[0]).toMatchObject({ id: fileId, name: 'Mein- Deck-1.json', appProperties: { liveslides: 'deck' } });
    expect(d.calls.filter((c) => c.method === 'POST' && !c.url.includes('/upload/'))).toHaveLength(1); // kein LiveSlides-Ordner
  });

  it('zweites Speichern überschreibt die Datei, ohne neuen Ordner oder neue Datei', async () => {
    const d = fakeDrive({ preseed: ['SHARED123'] });
    d.env.folderId = 'SHARED123';
    const ids = memMap();
    const first = await saveDeck(d.env, ids, deck('a1', 'Titel'));
    await saveDeck(d.env, ids, deck('a1', 'Titel'));
    expect(d.children('SHARED123')).toHaveLength(1);
    const folder = d.children('SHARED123')[0];
    expect(d.children(folder.id).map((f) => f.id)).toEqual([first]);
    expect(d.calls.filter((c) => c.method === 'PATCH')).toHaveLength(1);
  });

  it('Titeländerung benennt den Ordner und die Datei um, statt neu anzulegen', async () => {
    const d = fakeDrive({ preseed: ['SHARED123'] });
    d.env.folderId = 'SHARED123';
    const ids = memMap();
    await saveDeck(d.env, ids, deck('a1', 'Alt'));
    await saveDeck(d.env, ids, deck('a1', 'Neu'));
    const folders = d.children('SHARED123');
    expect(folders.map((f) => f.name)).toEqual(['Neu']);
    expect(d.children(folders[0].id).map((f) => f.name)).toEqual(['Neu.json']);
  });

  it('Ergebnisse jedes Durchlaufs landen im Ordner der Präsentation, ein Durchlauf bleibt eine Datei', async () => {
    const d = fakeDrive({ preseed: ['SHARED123'] });
    d.env.folderId = 'SHARED123';
    const ids = memMap();
    await saveDeck(d.env, ids, deck('a1', 'Workshop'));
    const r = (sessionId: string, name: string, v: number) => saveResults(d.env, ids, { deck: deck('a1', 'Workshop'), sessionId, name, json: { v } });
    await r('s1', '2026-11-25 10.00 Ergebnisse (AAAAA)', 1);
    await r('s1', '2026-11-25 10.00 Ergebnisse (AAAAA)', 2); // gleicher Durchlauf: überschreibt
    await r('s2', '2026-11-25 14.00 Ergebnisse (BBBBB)', 3);
    const folder = d.children('SHARED123')[0];
    const inside = d.children(folder.id);
    expect(d.children('SHARED123')).toHaveLength(1);
    expect(inside.map((f) => f.name).sort()).toEqual(['2026-11-25 10.00 Ergebnisse (AAAAA).json', '2026-11-25 14.00 Ergebnisse (BBBBB).json', 'Workshop.json']);
    expect(inside.find((f) => f.name.includes('AAAAA'))!.json).toEqual({ v: 2 });
    expect(inside.filter((f) => f.appProperties?.liveslides === 'results')).toHaveLength(2);
  });

  it('ohne Ordner-ID: „LiveSlides“ im eigenen Drive ist die Wurzel', async () => {
    const d = fakeDrive();
    await saveDeck(d.env, memMap(), deck('a1', 'Titel'));
    const top = [...d.files.values()].filter((f) => f.parents.length === 0);
    expect(top.map((f) => f.name)).toEqual(['LiveSlides']);
    expect(d.children(top[0].id).map((f) => f.name)).toEqual(['Titel']);
  });

  it('zwei Präsentationen mit gleichem Titel bekommen getrennte Ordner', async () => {
    const d = fakeDrive({ preseed: ['SHARED123'] });
    d.env.folderId = 'SHARED123';
    const ids = memMap();
    await saveDeck(d.env, ids, deck('a1', 'Gleich'));
    await saveDeck(d.env, ids, deck('b2', 'Gleich'));
    expect(d.children('SHARED123')).toHaveLength(2);
  });

  it('ein anderes Gerät (ohne gemerkte IDs) findet den Ordner über die Deck-ID und legt keinen zweiten an', async () => {
    const d = fakeDrive({ preseed: ['SHARED123'] });
    d.env.folderId = 'SHARED123';
    await saveDeck(d.env, memMap(), deck('a1', 'Titel'));
    await saveDeck(d.env, memMap(), deck('a1', 'Titel'));
    expect(d.children('SHARED123')).toHaveLength(1);
  });

  it('gelöschter Ordner (404): wird neu angelegt und die Datei trotzdem gespeichert', async () => {
    const d = fakeDrive({ preseed: ['SHARED123'] });
    d.env.folderId = 'SHARED123';
    const ids = memMap();
    await saveDeck(d.env, ids, deck('a1', 'Titel'));
    for (const f of d.children('SHARED123')) { for (const c of d.children(f.id)) d.files.delete(c.id); d.files.delete(f.id); }
    const id = await saveDeck(d.env, ids, deck('a1', 'Titel'));
    const folders = d.children('SHARED123');
    expect(folders).toHaveLength(1);
    expect(d.children(folders[0].id).map((f) => f.id)).toEqual([id]);
  });

  it('gemerkte Datei-IDs aus der alten Ablage (andere Ordner) werden nicht überschrieben: die Datei entsteht im Präsentationsordner', async () => {
    const d = fakeDrive({ preseed: ['SHARED123', 'OLD'] });
    d.env.folderId = 'SHARED123';
    // Zustand aus der Zeit vor den Unterordnern: das Gerät kennt eine Datei im alten Ordner unter dem alten Schlüssel
    d.files.set('oldfile', { id: 'oldfile', name: 'Titel.json', mimeType: 'application/json', parents: ['OLD'], json: { alt: true }, modifiedTime: 'x' });
    const ids = memMap();
    ids.set('deck:a1', 'oldfile');
    ids.set('res:s1', 'oldfile');
    const id = await saveDeck(d.env, ids, deck('a1', 'Titel'));
    const folder = d.children('SHARED123')[0];
    expect(d.children(folder.id).map((f) => f.id)).toEqual([id]); // Datei liegt im Unterordner
    expect(d.files.get('oldfile')!.json).toEqual({ alt: true }); // alte Datei bleibt unberührt
    const rid = await saveResults(d.env, ids, { deck: deck('a1', 'Titel'), sessionId: 's1', name: 'Ergebnisse', json: { neu: 1 } });
    expect(d.children(folder.id).map((f) => f.id)).toContain(rid);
    expect(d.files.get('oldfile')!.json).toEqual({ alt: true });
  });

  it('upsertJson legt neu an, wenn die alte Datei weg ist (404)', async () => {
    const d = fakeDrive({ preseed: ['F'] });
    const id = await upsertJson(d.env, { name: 'x.json', folderId: 'F', fileId: 'gone', json: {} });
    expect(d.files.get(id)?.parents).toEqual(['F']);
  });

  it('meldet Drive-Fehler mit Status (z. B. keine Berechtigung)', async () => {
    const env: DriveEnv = { token: async () => 'T', folderId: 'X', fetch: (async () => new Response('nope', { status: 403 })) as unknown as typeof fetch };
    const err = await saveDeck(env, memMap(), deck('a', 'T')).catch((e) => e);
    expect(err).toBeInstanceOf(DriveError);
    expect(err.status).toBe(403);
  });
});

describe('Drive: Präsentationen auflisten', () => {
  it('findet die Deck-Dateien der Unterordner, neueste zuerst, mit Ordnername; ignoriert Ergebnisse und Fremdes', async () => {
    const d = fakeDrive({ preseed: ['SHARED123', 'ANDERER'] });
    d.env.folderId = 'SHARED123';
    const ids = memMap();
    await saveDeck(d.env, ids, deck('a1', 'Erste'));
    await saveDeck(d.env, ids, deck('b2', 'Zweite'));
    await saveResults(d.env, ids, { deck: deck('a1', 'Erste'), sessionId: 's', name: 'Ergebnisse', json: {} });
    await upsertJson(d.env, { name: 'Fremd.json', folderId: 'ANDERER', json: {}, kind: 'deck' }); // Deck-Datei außerhalb des Wurzelordners
    const list = await listDecks(d.env);
    expect(list.map((f) => [f.folder, f.name])).toEqual([['Zweite', 'Zweite.json'], ['Erste', 'Erste.json']]);
  });
});

describe('Drive: Bilder wählen', () => {
  const addImg = (d: ReturnType<typeof fakeDrive>, id: string, name: string, mimeType: string, modifiedTime: string) =>
    d.files.set(id, { id, name, mimeType, parents: ['X'], modifiedTime, json: { bytes: id } });

  it('listet nur Bilddateien, neueste zuerst, und filtert nach Namen (Groß-/Kleinschreibung egal)', async () => {
    const d = fakeDrive();
    addImg(d, 'i1', 'Logo alt.png', 'image/png', '2026-01-01T00:00:01.000Z');
    addImg(d, 'i2', 'Foto Team.jpg', 'image/jpeg', '2026-01-01T00:00:03.000Z');
    addImg(d, 'i3', 'Logo neu.svg', 'image/svg+xml', '2026-01-01T00:00:02.000Z');
    addImg(d, 'd1', 'Notizen.json', 'application/json', '2026-01-01T00:00:04.000Z');
    expect((await listImages(d.env)).map((f) => f.id)).toEqual(['i2', 'i3', 'i1']);
    expect((await listImages(d.env, 'LOGO')).map((f) => f.id)).toEqual(['i3', 'i1']);
    expect(await listImages(d.env, 'gibtsnicht')).toEqual([]);
  });
  it('sucht in allen Laufwerken und maskiert Hochkommas im Suchbegriff', async () => {
    const d = fakeDrive();
    addImg(d, 'i1', "Omas Foto's.png", 'image/png', '2026-01-01T00:00:01.000Z');
    expect((await listImages(d.env, "Foto's")).map((f) => f.id)).toEqual(['i1']);
    const url = d.calls.at(-1)!.url;
    expect(url).toContain('corpora=allDrives');
    expect(url).toContain('supportsAllDrives=true');
  });
  it('lädt den Dateiinhalt mit Token herunter', async () => {
    const d = fakeDrive();
    addImg(d, 'i1', 'a.png', 'image/png', '2026-01-01T00:00:01.000Z');
    const blob = await getBlob(d.env, 'i1');
    expect(JSON.parse(await blob.text())).toEqual({ bytes: 'i1' });
    expect(d.calls.at(-1)!.url).toContain('alt=media');
  });
});

describe('Domain-Prüfung', () => {
  it('ohne Vorgabe darf jeder, mit Vorgabe nur die Firmen-Domain', () => {
    expect(domainAllowed({ email: 'x@gmail.com' }, '')).toBe(true);
    expect(domainAllowed({ email: 'a@i2d.info', email_verified: true }, 'i2d.info')).toBe(true);
    expect(domainAllowed({ email: 'a@alias.de', hd: 'I2D.info' }, 'i2d.info')).toBe(true);
    expect(domainAllowed({ email: 'a@gmail.com' }, 'i2d.info')).toBe(false);
    expect(domainAllowed({ email: 'a@evil-i2d.info' }, 'i2d.info')).toBe(false);
    expect(domainAllowed({ email: 'a@i2d.info', email_verified: false }, 'i2d.info')).toBe(false);
    expect(domainAllowed({}, 'i2d.info')).toBe(false);
  });
});

describe('Ergebnisse', () => {
  it('enthält Folien, Antworten und Rangliste', () => {
    const dk = { id: 'd', title: 'T', slides: [{ id: 's1', type: 'shortanswer', data: { question: 'Q', answers: ['Paris'], points: 100 } }] };
    const all = { s1: [{ pid: 'p1', name: 'Lea', data: 'paris', at: 0 }] };
    const r = buildResults(dk, all, { code: 'ABCDE', startedAt: 0, participants: 1, savedAt: 1000 });
    expect(r.leaderboard).toEqual([{ name: 'Lea', pts: 100 }]);
    expect(r.slides[0].responses[0]).toMatchObject({ name: 'Lea', answer: 'paris' });
    expect(r.participants).toBe(1);
  });
  it('Dateiname enthält Datum, Uhrzeit und Code (der Titel steht im Ordnernamen)', () => {
    expect(resultsFileName('XY12Z', new Date(2026, 10, 24, 18, 5).getTime())).toBe('2026-11-24 18.05 Ergebnisse (XY12Z)');
  });
});
