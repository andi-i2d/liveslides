import { expect, test } from '@playwright/test';
import { fakeDriveFile, fakeGoogle, fakePicker, signIn } from './fakes';

// Diese Tests laufen gegen die Instanz mit Google-Anmeldung und API-Schlüssel (Port 5198, Domain-Vorgabe i2d.test).
test.use({ baseURL: 'http://localhost:5198', locale: 'de-DE' });

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
  await page.goto('/');
  await page.getByRole('button', { name: 'Mit Google anmelden' }).click(); // Login schlägt hier absichtlich fehl
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

  expect(drive.folders).toEqual(['LiveSlides', 'Mein Deck']); // ein Unterordner je Präsentation, darin Deck und Ergebnisse
  const res = drive.uploads.find((u) => u.body.includes('Ergebnisse (' + code + ')'));
  expect(res, 'Ergebnisdatei wurde hochgeladen').toBeTruthy();
  expect(res!.body).toContain('"answer":"paris"');
  expect(res!.body).toContain('"name":"Lea"');
  expect(res!.body).toContain('"pts":1000'); // Rangliste
  expect(res!.url).toContain('uploadType=multipart');
});

test('Bild aus Drive: Standard-Dateiwähler von Google mit Schlüssel, Token und Laufwerken', async ({ context, page }) => {
  await fakeGoogle(context, 'anna@i2d.test');
  await fakePicker(context, 'pick');
  await fakeDriveFile(context);
  await signIn(page);
  await page.evaluate(() =>
    localStorage.setItem('liveslides.decks', JSON.stringify([{ id: 'dr', title: 'Bilder', slides: [
      { id: 's1', type: 'pinimage', data: { question: 'Wo?', image: '' } } ] }])),
  );
  await page.goto('/#/edit/dr');
  await page.reload();
  await page.getByRole('button', { name: 'Aus Drive …' }).click();
  await expect(page.locator('.imgchip')).toContainText('Bild eingebettet'); // gewählt, heruntergeladen, verkleinert
  await expect(page.locator('.drivepick')).toHaveCount(0); // keine eigene Liste, wenn der Dateiwähler verfügbar ist
  const o = await page.evaluate(() => (window as any).__pickerOpts);
  expect(o.key).toBe('test-key');
  expect(o.token).toBe('tok-anna@i2d.test');
  expect(o.appId).toBe('test'); // Projektnummer = Teil der Client-ID vor dem ersten Bindestrich
  expect(o.locale).toBe('de');
  expect(o.features).toContain('support-drives'); // geteilte Laufwerke
  expect(o.views.length).toBe(2); // Meine Ablage/Laufwerke + Mit mir geteilt
});

test('Abbrechen im Dateiwähler ändert nichts und zeigt keinen Fehler', async ({ context, page }) => {
  await fakeGoogle(context, 'anna@i2d.test');
  await fakePicker(context, 'cancel');
  await signIn(page);
  await page.evaluate(() =>
    localStorage.setItem('liveslides.decks', JSON.stringify([{ id: 'dr', title: 'Bilder', slides: [
      { id: 's1', type: 'pinimage', data: { question: 'Wo?', image: 'https://example.org/a.jpg' } } ] }])),
  );
  await page.goto('/#/edit/dr');
  await page.reload();
  await page.getByRole('button', { name: 'Aus Drive …' }).click();
  await expect.poll(() => page.evaluate(() => !!(window as any).__pickerOpts)).toBe(true);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByLabel('Bild-URL')).toHaveValue('https://example.org/a.jpg');
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
  expect(drive.folders).toEqual(['LiveSlides', 'Neuer Titel']); // Ordner trägt den Präsentationstitel
});
