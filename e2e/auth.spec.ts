import { expect, test, type BrowserContext, type Page } from '@playwright/test';

// Diese Tests laufen gegen die Instanz mit Google-Anmeldung (Port 5198, Domain-Vorgabe i2d.test).
test.use({ baseURL: 'http://localhost:5198', locale: 'de-DE' });

/** Simuliert Google: Anmeldeskript, Profil und die Drive-API. */
async function fakeGoogle(ctx: BrowserContext, who: string) {
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

async function signIn(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Mit Google anmelden' }).click();
}

test('ohne Anmeldung ist nur die Login-Seite erreichbar, Teilnehmer-Link nicht', async ({ context, page }) => {
  await fakeGoogle(context, 'anna@i2d.test');
  await page.goto('/#/present/irgendwas');
  await expect(page.getByRole('heading', { name: 'Anmelden' })).toBeVisible();
  await expect(page.getByText('Nur Konten von @i2d.test')).toBeVisible();
  await page.goto('/#/join/ABCDE');
  await expect(page.getByPlaceholder('Dein Name')).toBeVisible(); // Teilnehmer brauchen keine Anmeldung
});

test('Konto außerhalb der Domain wird abgelehnt', async ({ context, page }) => {
  await fakeGoogle(context, 'fremd@gmail.com');
  await signIn(page);
  await expect(page.getByRole('alert')).toContainText('nicht zugelassen');
  await expect(page.getByRole('heading', { name: 'Meine Präsentationen' })).toHaveCount(0);
});

test('Anmeldung mit i2d-Konto, Deck und Ergebnisse landen in Drive', async ({ context, page }) => {
  const drive = await fakeGoogle(context, 'anna@i2d.test');
  await signIn(page);
  await expect(page.getByText('anna@i2d.test')).toBeVisible();

  // Deck anlegen und präsentieren
  await page.evaluate(() =>
    localStorage.setItem('liveslides.decks', JSON.stringify([{ id: 'e2e', title: 'Mein Deck', slides: [
      { id: 's1', type: 'shortanswer', data: { question: 'Hauptstadt?', answers: ['Paris'], points: 1000 } } ] }])),
  );
  await page.goto('/#/present/e2e');
  await page.reload();
  const code = (await page.locator('.bar .code').innerText()).trim();

  const phone = await context.newPage();
  await phone.goto(`/#/join/${code}`);
  await phone.getByPlaceholder('Dein Name').fill('Lea');
  await phone.getByRole('button', { name: 'Los!' }).click();
  await phone.getByRole('textbox').fill('paris');
  await phone.getByRole('button', { name: 'Absenden' }).click();
  await expect(page.getByText('1 Antwort(en)')).toBeVisible();

  await page.getByTitle('Jetzt in Drive speichern').click();
  await expect(page.getByRole('button', { name: /In Drive gespeichert/ })).toBeVisible();

  expect(drive.folders).toEqual(['LiveSlides', 'Ergebnisse']);
  const res = drive.uploads.find((u) => u.body.includes('Ergebnisse (' + code + ')'));
  expect(res, 'Ergebnisdatei wurde hochgeladen').toBeTruthy();
  expect(res!.body).toContain('"answer":"paris"');
  expect(res!.body).toContain('"name":"Lea"');
  expect(res!.body).toContain('"pts":1000'); // Rangliste
  expect(res!.url).toContain('uploadType=multipart');
});

test('Editor sichert Änderungen als Deck-Datei in Drive', async ({ context, page }) => {
  const drive = await fakeGoogle(context, 'anna@i2d.test');
  await signIn(page);
  await page.evaluate(() =>
    localStorage.setItem('liveslides.decks', JSON.stringify([{ id: 'ed', title: 'Alt', slides: [
      { id: 's1', type: 'title', data: { title: 'Hallo', subtitle: 'x' } } ] }])),
  );
  // Diagnose: schlägt das Warten fehl, steht im Fehlertext, was die Seite zeigte und welche Fehler es gab
  const problems: string[] = [];
  page.on('pageerror', (e) => problems.push(`pageerror: ${e}`));
  page.on('console', (m) => m.type() === 'error' && problems.push(`console: ${m.text()}`));
  await page.goto('/#/edit/ed');
  await page.reload();
  const title = page.getByLabel('Titel der Präsentation');
  await title.waitFor({ timeout: 15_000 }).catch(async (e) => {
    const body = (await page.locator('body').innerText().catch(() => '?')).replace(/\s+/g, ' ').slice(0, 300);
    throw new Error(`Editor nicht sichtbar. URL=${page.url()} Seite="${body}" Fehler=[${problems.join(' | ')}] (${e.message.split('\n')[0]})`);
  });
  await title.fill('Neuer Titel');
  await expect.poll(() => drive.uploads.some((u) => u.body.includes('Neuer Titel.json')), { timeout: 10_000 }).toBe(true);
  expect(drive.folders).toEqual(['LiveSlides', 'Präsentationen']);
});
