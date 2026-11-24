import { beforeEach, describe, expect, it } from 'vitest';
import { clearFolderCache, saveDeck, saveResults, upsertJson, type DriveEnv, type IdMap } from './drive';
import { domainAllowed } from './google';
import { buildResults, resultsFileName } from './results';

interface Call { method: string; url: string; body?: string }

/** Minimaler Drive-Simulator: Ordner und Dateien im Speicher. */
function fakeDrive(opts: { missing?: Set<string> } = {}) {
  const calls: Call[] = [];
  const folders = new Map<string, string>(); // "name|parent" → id
  let n = 0;
  const f = (async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? 'GET';
    calls.push({ method, url, body: init.body as string | undefined });
    const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status });
    if (url.includes('/upload/') && method === 'PATCH') {
      const id = decodeURIComponent(url.split('/files/')[1].split('?')[0]);
      return opts.missing?.has(id) ? json({ error: 'nf' }, 404) : json({ id });
    }
    if (url.includes('/upload/') && method === 'POST') return json({ id: `file${++n}` });
    if (method === 'POST') {
      const b = JSON.parse(init.body as string);
      const id = `folder${++n}`;
      folders.set(`${b.name}|${b.parents?.[0] ?? ''}`, id);
      return json({ id });
    }
    const q = decodeURIComponent(url.split('q=')[1].split('&')[0]);
    const name = /name='([^']+)'/.exec(q)?.[1] ?? '';
    const parent = /'([^']+)' in parents/.exec(q)?.[1] ?? '';
    const id = folders.get(`${name}|${parent}`);
    return json({ files: id ? [{ id }] : [] });
  }) as unknown as typeof fetch;
  return { calls, env: { token: async () => 'T', fetch: f } as DriveEnv };
}
const memMap = (): IdMap & { m: Record<string, string> } => {
  const m: Record<string, string> = {};
  return { m, get: (k) => m[k] ?? null, set: (k, v) => void (m[k] = v) };
};

beforeEach(() => clearFolderCache());

describe('Drive', () => {
  it('legt LiveSlides/Präsentationen an und speichert das Deck mit Bearer-Token', async () => {
    const d = fakeDrive();
    const ids = memMap();
    const id = await saveDeck(d.env, ids, { id: 'a1', title: 'Mein: Deck/1' });
    expect(id).toMatch(/^file/);
    expect(ids.m['deck:a1']).toBe(id);
    const creates = d.calls.filter((c) => c.method === 'POST' && !c.url.includes('/upload/')).map((c) => JSON.parse(c.body!));
    expect(creates.map((c) => c.name)).toEqual(['LiveSlides', 'Präsentationen']);
    const up = d.calls.find((c) => c.url.includes('/upload/'))!;
    expect(up.body).toContain('"name":"Mein- Deck-1.json"'); // unzulässige Zeichen ersetzt
  });
  it('überschreibt beim zweiten Speichern statt neu anzulegen', async () => {
    const d = fakeDrive();
    const ids = memMap();
    const first = await saveDeck(d.env, ids, { id: 'a1', title: 'T' });
    await saveDeck(d.env, ids, { id: 'a1', title: 'T2' });
    const patches = d.calls.filter((c) => c.method === 'PATCH');
    expect(patches).toHaveLength(1);
    expect(patches[0].url).toContain(first);
    expect(d.calls.filter((c) => c.method === 'POST' && c.url.includes('/upload/'))).toHaveLength(1);
  });
  it('legt neu an, wenn die alte Datei gelöscht wurde (404)', async () => {
    const d = fakeDrive({ missing: new Set(['gone']) });
    const id = await upsertJson(d.env, { name: 'x.json', folderId: 'F', fileId: 'gone', json: {} });
    expect(id).toMatch(/^file/);
  });
  it('nutzt einen festen Zielordner statt LiveSlides anzulegen', async () => {
    const d = fakeDrive();
    d.env.folderId = 'SHARED123';
    await saveResults(d.env, memMap(), { sessionId: 's', name: 'Ergebnis', json: { a: 1 } });
    const creates = d.calls.filter((c) => c.method === 'POST' && !c.url.includes('/upload/')).map((c) => JSON.parse(c.body!));
    expect(creates).toEqual([{ name: 'Ergebnisse', mimeType: 'application/vnd.google-apps.folder', parents: ['SHARED123'] }]);
  });
  it('meldet Drive-Fehler mit Status', async () => {
    const env: DriveEnv = { token: async () => 'T', fetch: (async () => new Response('nope', { status: 403 })) as unknown as typeof fetch };
    await expect(saveDeck(env, memMap(), { id: 'a', title: 'T' })).rejects.toMatchObject({ status: 403 });
  });
});

describe('Domain-Prüfung', () => {
  it('ohne Vorgabe darf jeder, mit Vorgabe nur die Firmen-Domain', () => {
    expect(domainAllowed({ email: 'x@gmail.com' }, '')).toBe(true);
    expect(domainAllowed({ email: 'a@i2d.de', email_verified: true }, 'i2d.de')).toBe(true);
    expect(domainAllowed({ email: 'a@alias.de', hd: 'I2D.de' }, 'i2d.de')).toBe(true);
    expect(domainAllowed({ email: 'a@gmail.com' }, 'i2d.de')).toBe(false);
    expect(domainAllowed({ email: 'a@evil-i2d.de' }, 'i2d.de')).toBe(false);
    expect(domainAllowed({ email: 'a@i2d.de', email_verified: false }, 'i2d.de')).toBe(false);
    expect(domainAllowed({}, 'i2d.de')).toBe(false);
  });
});

describe('Ergebnisse', () => {
  it('enthält Folien, Antworten und Rangliste', () => {
    const deck = { id: 'd', title: 'T', slides: [{ id: 's1', type: 'shortanswer', data: { question: 'Q', answers: ['Paris'], points: 100 } }] };
    const all = { s1: [{ pid: 'p1', name: 'Lea', data: 'paris', at: 0 }] };
    const r = buildResults(deck, all, { code: 'ABCDE', startedAt: 0, participants: 1, savedAt: 1000 });
    expect(r.leaderboard).toEqual([{ name: 'Lea', pts: 100 }]);
    expect(r.slides[0].responses[0]).toMatchObject({ name: 'Lea', answer: 'paris' });
    expect(r.participants).toBe(1);
  });
  it('Dateiname enthält Titel und Code', () => {
    expect(resultsFileName('Mein Deck', 'XY12Z', new Date(2026, 10, 24, 18, 5).getTime())).toBe('2026-11-24 18.05 Mein Deck – Ergebnisse (XY12Z)');
  });
});
