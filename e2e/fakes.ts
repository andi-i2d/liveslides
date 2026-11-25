import { expect, type BrowserContext, type Page } from '@playwright/test';

/** Simuliert Google: Anmeldeskript, Profil und die Drive-API. */
export async function fakeGoogle(ctx: BrowserContext, who: string) {
  const uploads: { method: string; url: string; body: string }[] = [];
  const folders: string[] = [];
  let n = 0;

  await ctx.addInitScript((email) => {
    (window as any).__who = email;
  }, who);
  await ctx.route('https://accounts.google.com/gsi/client', (r) =>
    r.fulfill({
      contentType: 'text/javascript',
      body: `window.google = { accounts: { oauth2: {
        initTokenClient: (cfg) => ({ requestAccessToken: () => setTimeout(() => cfg.callback({ access_token: 'tok-' + window.__who, expires_in: 3600 }), 10) }),
        revoke: (t, cb) => cb && cb(),
      } } };`,
    }),
  );
  await ctx.route('https://www.googleapis.com/oauth2/v3/userinfo', (r) => {
    const email = (r.request().headers()['authorization'] ?? '').replace('Bearer tok-', '');
    return r.fulfill({
      json: { email, email_verified: true, name: email.split('@')[0], ...(email.endsWith('@i2d.test') ? { hd: 'i2d.test' } : {}) },
    });
  });
  await ctx.route('https://www.googleapis.com/**/drive/v3/**', async (r) => {
    const req = r.request();
    const url = req.url();
    if (url.includes('/upload/')) {
      uploads.push({ method: req.method(), url, body: req.postData() ?? '' });
      return r.fulfill({ json: { id: `file${++n}` } });
    }
    if (req.method() === 'POST') {
      folders.push(JSON.parse(req.postData() ?? '{}').name);
      return r.fulfill({ json: { id: `folder${++n}` } });
    }
    return r.fulfill({ json: { files: [] } }); // Ordnersuche: noch nichts vorhanden
  });
  return { uploads, folders };
}

/** Meldet sich an und wartet, bis der Login fertig ist (sonst ist das Konto nach einem Neuladen noch nicht gemerkt). */
export async function signIn(page: Page, email = 'anna@i2d.test') {
  await page.goto('/');
  await page.getByRole('button', { name: 'Mit Google anmelden' }).click();
  await expect(page.getByText(email)).toBeVisible();
}

/** Ein 1×1-PNG als „Drive-Datei“. */
export const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

/** Der Download der Drive-Datei `img1` liefert das PNG. */
export async function fakeDriveFile(ctx: BrowserContext) {
  await ctx.route((u) => u.href.includes('/files/img1') && u.href.includes('alt=media'), (r) =>
    r.fulfill({ contentType: 'image/png', body: PNG, headers: { 'access-control-allow-origin': '*' } }));
}

/**
 * Simuliert den Google-Dateiwähler (Picker): zeichnet die Einstellungen in window.__pickerOpts auf und
 * „wählt“ die Datei img1 oder bricht ab.
 */
export async function fakePicker(ctx: BrowserContext, choice: 'pick' | 'cancel' = 'pick') {
  await ctx.addInitScript((c) => ((window as any).__pickChoice = c), choice);
  await ctx.route('https://apis.google.com/js/api.js', (r) =>
    r.fulfill({
      contentType: 'text/javascript',
      body: `
      const view = (id) => ({ id, setIncludeFolders() { return this; }, setEnableDrives() { return this; }, setMode() { return this; }, setOwnedByMe() { return this; } });
      const P = {
        ViewId: { DOCS_IMAGES: 'docs-images' }, DocsViewMode: { GRID: 'grid' }, Feature: { SUPPORT_DRIVES: 'support-drives' },
        Action: { PICKED: 'picked', CANCEL: 'cancel' }, Response: { ACTION: 'action', DOCUMENTS: 'docs' }, Document: { ID: 'id', NAME: 'name' },
        DocsView: function (id) { return view(id); },
        PickerBuilder: function () {
          const o = (window.__pickerOpts = { views: [], features: [] });
          const b = {
            setAppId(v) { o.appId = v; return b; }, setDeveloperKey(v) { o.key = v; return b; }, setOAuthToken(v) { o.token = v; return b; },
            setLocale(v) { o.locale = v; return b; }, enableFeature(v) { o.features.push(v); return b; }, addView(v) { o.views.push(v.id); return b; },
            setCallback(cb) { o.cb = cb; return b; },
            build() { return { setVisible(on) { if (on) setTimeout(() => o.cb(window.__pickChoice === 'cancel' ? { action: 'cancel' } : { action: 'picked', docs: [{ id: 'img1', name: 'Teamfoto.png' }] }), 20); } }; },
          };
          return b;
        },
      };
      window.gapi = { load(name, opts) { window.google = window.google || {}; window.google.picker = P; (opts.callback || opts)(); } };`,
    }),
  );
}
