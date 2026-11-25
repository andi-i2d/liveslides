import { describe, expect, it } from 'vitest';
import { PhotosError, parseDuration, pickPhoto, type PhotosEnv, type PhotosStatus } from './photos';

interface Call { method: string; url: string; auth: string | null; body?: string }

/** Simulierter Photos-Picker-Server plus Bild-Host. `polls` = Antworten von GET /sessions/{id} nacheinander. */
function fake(o: {
  polls?: boolean[];
  items?: unknown[];
  createStatus?: number;
  imageStatus?: number;
  imageThrows?: boolean;
  pollingConfig?: unknown;
  winClosed?: boolean;
} = {}) {
  const calls: Call[] = [];
  const slept: number[] = [];
  const statuses: PhotosStatus[] = [];
  const opened: string[] = [];
  let clock = 1_000_000;
  let poll = 0;
  const polls = o.polls ?? [false, false, true];
  const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });
  const items = o.items ?? [{ id: 'm1', type: 'PHOTO', mediaFile: { baseUrl: 'https://lh3.googleusercontent.com/pw/ABC', mimeType: 'image/jpeg', filename: 'a.jpg' } }];

  const f = (async (url: string, init: RequestInit = {}) => {
    const h = (init.headers ?? {}) as Record<string, string>;
    const method = init.method ?? 'GET';
    calls.push({ method, url, auth: h.Authorization ?? null, body: init.body as string | undefined });
    if (url.includes('lh3.googleusercontent.com')) {
      if (o.imageThrows) throw new TypeError('Failed to fetch');
      return new Response(new Blob(['JPEGDATA'], { type: 'image/jpeg' }), { status: o.imageStatus ?? 200 });
    }
    if (method === 'POST' && url.endsWith('/v1/sessions')) {
      if (o.createStatus && o.createStatus !== 200) return json({ error: { message: 'Photos Picker API has not been used' } }, o.createStatus);
      return json({ id: 'S1', pickerUri: 'https://photos.google.com/picker/S1', pollingConfig: o.pollingConfig ?? { pollInterval: '0.5s', timeoutIn: '60s' } });
    }
    if (method === 'DELETE') return json({});
    if (url.includes('/v1/mediaItems')) return json({ mediaItems: items });
    if (url.includes('/v1/sessions/S1')) return json({ id: 'S1', mediaItemsSet: polls[Math.min(poll++, polls.length - 1)] });
    return json({}, 404);
  }) as unknown as typeof fetch;

  const win = { closed: !!o.winClosed };
  const env = (extra: Partial<PhotosEnv> = {}): PhotosEnv => ({
    token: async () => 'TK',
    fetch: f,
    open: (u) => (opened.push(u), win),
    sleep: async (ms) => { slept.push(ms); clock += ms; },
    now: () => clock,
    onStatus: (s) => statuses.push(s),
    ...extra,
  });
  return { calls, slept, statuses, opened, env, win };
}

describe('Photos Picker: Ablauf', () => {
  it('legt eine Sitzung an, öffnet Google Fotos, fragt im Takt ab, lädt das Foto und räumt auf', async () => {
    const t = fake();
    const blob = await pickPhoto(t.env());
    expect(await blob.text()).toBe('JPEGDATA');
    expect(t.calls.map((c) => `${c.method} ${c.url.replace(/^https:\/\/[^/]+/, '')}`)).toEqual([
      'POST /v1/sessions',
      'GET /v1/sessions/S1', 'GET /v1/sessions/S1', 'GET /v1/sessions/S1',
      'GET /v1/mediaItems?sessionId=S1&pageSize=1',
      'GET /pw/ABC=w1280-h1280',
      'DELETE /v1/sessions/S1',
    ]);
    expect(JSON.parse(t.calls[0].body!)).toEqual({ pickingConfig: { maxItemCount: '1' } }); // genau ein Foto
    expect(t.calls.every((c) => c.auth === 'Bearer TK')).toBe(true); // auch der Foto-Abruf trägt das Token
    expect(t.opened).toEqual(['https://photos.google.com/picker/S1/autoclose']);
    expect(t.slept).toEqual([500, 500, 500]); // Takt aus pollingConfig
    expect(t.statuses.map((s) => s.state)).toEqual(['creating', 'waiting', 'downloading']);
  });

  it('meldet blockierte Fenster, damit der Nutzer selbst auf „Google Fotos öffnen“ klickt', async () => {
    const t = fake();
    await pickPhoto(t.env({ open: () => null }));
    expect(t.statuses.find((s) => s.state === 'waiting')).toMatchObject({ blocked: true, pickerUri: 'https://photos.google.com/picker/S1/autoclose' });
  });

  it('Takt: mindestens 0,3 s; ohne Angaben 3 s', async () => {
    const a = fake({ pollingConfig: { pollInterval: '0.01s', timeoutIn: '60s' }, polls: [true] });
    await pickPhoto(a.env());
    expect(a.slept).toEqual([300]);
    const b = fake({ pollingConfig: {}, polls: [true] });
    await pickPhoto(b.env());
    expect(b.slept).toEqual([3000]);
  });

  it('nimmt das erste Foto, ignoriert Videos', async () => {
    const t = fake({ items: [
      { id: 'v', type: 'VIDEO', mediaFile: { baseUrl: 'https://lh3.googleusercontent.com/video' } },
      { id: 'p', type: 'PHOTO', mediaFile: { baseUrl: 'https://lh3.googleusercontent.com/photo' } },
    ] });
    await pickPhoto(t.env());
    expect(t.calls.some((c) => c.url.includes('/photo=w1280'))).toBe(true);
    expect(t.calls.some((c) => c.url.includes('/video'))).toBe(false);
  });
});

describe('Photos Picker: Fehler und Abbruch (die Sitzung wird immer gelöscht)', () => {
  const deleted = (t: ReturnType<typeof fake>) => t.calls.some((c) => c.method === 'DELETE');

  it('Zeit abgelaufen → timeout', async () => {
    const t = fake({ polls: [false], pollingConfig: { pollInterval: '10s', timeoutIn: '25s' } });
    const e = await pickPhoto(t.env()).catch((x) => x);
    expect(e).toBeInstanceOf(PhotosError);
    expect(e.code).toBe('timeout');
    expect(t.slept.length).toBe(3); // 10 s, 20 s, 30 s > Frist 25 s
    expect(deleted(t)).toBe(true);
  });

  it('Abbrechen per Signal → cancelled', async () => {
    const t = fake({ polls: [false] });
    const ac = new AbortController();
    const e = await pickPhoto(t.env({ signal: ac.signal, sleep: async () => ac.abort() })).catch((x) => x);
    expect(e.code).toBe('cancelled');
    expect(deleted(t)).toBe(true);
  });

  it('Fenster geschlossen, nichts gewählt → nach zwei Abfragen cancelled', async () => {
    const t = fake({ polls: [false], winClosed: true });
    const e = await pickPhoto(t.env()).catch((x) => x);
    expect(e.code).toBe('cancelled');
    expect(t.calls.filter((c) => c.method === 'GET' && c.url.includes('/sessions/S1')).length).toBe(2);
    expect(deleted(t)).toBe(true);
  });

  it('Fenster geschlossen, aber Auswahl schon getroffen (autoclose) → Foto wird geladen', async () => {
    const t = fake({ polls: [true], winClosed: true });
    expect(await (await pickPhoto(t.env())).text()).toBe('JPEGDATA');
  });

  it('Sitzung nicht anlegbar (z. B. API nicht aktiviert) → api mit Status und Google-Text, keine Sitzung zu löschen', async () => {
    const t = fake({ createStatus: 403 });
    const e = await pickPhoto(t.env()).catch((x) => x);
    expect(e.code).toBe('api');
    expect(e.status).toBe(403);
    expect(e.message).toContain('has not been used');
    expect(deleted(t)).toBe(false);
  });

  it('keine Auswahl in der Liste → none', async () => {
    const t = fake({ items: [] });
    expect((await pickPhoto(t.env()).catch((x) => x)).code).toBe('none');
    expect(deleted(t)).toBe(true);
  });

  it('Browser darf das Foto nicht laden (CORS) → verständliche Meldung mit Ausweg', async () => {
    const t = fake({ imageThrows: true });
    const e = await pickPhoto(t.env()).catch((x) => x);
    expect(e.code).toBe('download');
    expect(e.message).toContain('Vom Rechner');
    expect(deleted(t)).toBe(true);
  });

  it('Foto-Abruf mit HTTP-Fehler → download mit Status', async () => {
    const t = fake({ imageStatus: 403 });
    const e = await pickPhoto(t.env()).catch((x) => x);
    expect(e.code).toBe('download');
    expect(e.status).toBe(403);
  });
});

describe('parseDuration', () => {
  it('liest Protobuf-Dauern', () => {
    expect(parseDuration('3.5s', 0)).toBe(3500);
    expect(parseDuration('900s', 0)).toBe(900_000);
    expect(parseDuration('0s', 5)).toBe(0);
    expect(parseDuration('kaputt', 7)).toBe(7);
    expect(parseDuration(undefined, 9)).toBe(9);
  });
});
