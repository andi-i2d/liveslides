import { expect, test } from '@playwright/test';
import { PNG, fakeGoogle, signIn } from './fakes';

// Foto teilen (landet in Drive): Handy → Beamer-Seite (Präsentator, angemeldet) → Drive. Port 5198 (Google-Anmeldung wird simuliert).
test.use({ baseURL: 'http://localhost:5198', locale: 'de-DE' });

const dropDeck = (extra: unknown[] = []) => [{ id: 'fd', title: 'Foto Test', slides: [
  { id: 's1', type: 'photoshare', data: { question: 'Teilt eure Fotos', max: 2, gallery: 'yes' } },
  ...extra,
] }];

test('Foto vom Handy erscheint auf dem Beamer und landet automatisch in Drive/Fotos', async ({ context, page }) => {
  const drive = await fakeGoogle(context, 'anna@i2d.test');
  await signIn(page);
  await page.evaluate((d) => localStorage.setItem('liveslides.decks', JSON.stringify(d)), dropDeck());
  await page.goto('/#/present/fd');
  await page.reload();
  const code = (await page.locator('.bar .code').innerText()).trim();

  const phone = await context.newPage();
  await phone.goto(`/#/join/${code}`);
  await phone.getByPlaceholder('Dein Name').fill('Mia');
  await phone.getByRole('button', { name: 'Los!' }).click();
  await expect(phone.getByText('Teilt eure Fotos')).toBeVisible();
  await expect(phone.getByText('wird auf dem Beamer gezeigt und wird von den Veranstaltenden gespeichert')).toBeVisible();
  await phone.locator('input[type=file]').setInputFiles({ name: 'urlaub.png', mimeType: 'image/png', buffer: PNG });
  await expect(phone.locator('img.preview')).toHaveAttribute('src', /^data:image\/jpeg;base64,/); // verkleinert, JPEG
  await phone.getByPlaceholder('Bildunterschrift (optional)').fill('Strand');
  await phone.getByRole('button', { name: 'Senden' }).click();
  await expect(phone.getByText('Noch 1 Foto möglich')).toBeVisible();

  // Beamer: Zähler und Galerie
  await expect(page.getByText('📷 1 Foto erhalten')).toBeVisible();
  await expect(page.locator('.gallery img')).toHaveCount(1);
  await expect(page.locator('.gallery figcaption')).toHaveText('Strand');

  // Drive: Ordner LiveSlides → Foto Test → Fotos, darin das JPEG mit Zeitstempel, Name und Nummer, Typ image/jpeg
  await expect.poll(() => drive.uploads.some((u) => u.body.includes('image/jpeg') && u.body.includes('"appProperties":{"liveslides":"photo"}')), { timeout: 10_000 }).toBe(true);
  expect(drive.folders).toEqual(['LiveSlides', 'Foto Test', 'Fotos']);
  const up = drive.uploads.find((u) => u.body.includes('"liveslides":"photo"'))!;
  expect(up.body).toMatch(/"name":"\d{4}-\d\d-\d\d \d\d\.\d\d\.\d\d Mia 1\.jpg"/);
  expect(up.body).toContain('Content-Type: image/jpeg');
  expect(up.body).toContain('JFIF'); // lesbare JPEG-Kennung im Dateikopf: ein echtes, verkleinertes Foto kam an (kein Platzhalter)

  // zweites Foto: gleicher Ordner, Nummer 2, kein weiterer Ordner
  await phone.locator('input[type=file]').setInputFiles({ name: 'zwei.png', mimeType: 'image/png', buffer: PNG });
  await expect(phone.locator('img.preview')).toBeVisible();
  await phone.getByRole('button', { name: 'Senden' }).click();
  await expect(phone.getByText(/2 Fotos gesendet/)).toBeVisible();
  await expect.poll(() => drive.uploads.filter((u) => u.body.includes('"liveslides":"photo"')).length, { timeout: 10_000 }).toBe(2);
  expect(drive.folders).toEqual(['LiveSlides', 'Foto Test', 'Fotos']);
  expect(drive.uploads.filter((u) => u.body.includes('"liveslides":"photo"'))[1].body).toMatch(/ Mia 2\.jpg"/);
});

test('Der Dateiname enthält den Einsendernamen, auch den Zufallsnamen, wenn der Vorschlag unverändert bleibt', async ({ context, page }) => {
  const drive = await fakeGoogle(context, 'anna@i2d.test');
  await signIn(page);
  await page.evaluate((d) => localStorage.setItem('liveslides.decks', JSON.stringify(d)), dropDeck());
  await page.goto('/#/present/fd');
  await page.reload();
  const code = (await page.locator('.bar .code').innerText()).trim();
  const phone = await context.newPage();
  await phone.goto(`/#/join/${code}`);
  await phone.getByRole('button', { name: 'Los!' }).click(); // Namensvorschlag (z. B. Dreister Denker) unverändert übernehmen
  const name = (await phone.locator('.youare').innerText()).replace('👤', '').trim();
  expect(name).toMatch(/^(\p{L})\S* \1\S*$/u);
  await phone.locator('input[type=file]').setInputFiles({ name: 'a.png', mimeType: 'image/png', buffer: PNG });
  await expect(phone.locator('img.preview')).toBeVisible();
  await phone.getByRole('button', { name: 'Senden' }).click();
  await expect.poll(() => drive.uploads.some((u) => u.body.includes('"liveslides":"photo"')), { timeout: 10_000 }).toBe(true);
  const body = drive.uploads.find((u) => u.body.includes('"liveslides":"photo"'))!.body;
  expect(body).toContain(` ${name} 1.jpg"`); // Datum, Uhrzeit, Einsendername, Nummer
});

test('Der frühere Typname photodrop (Foto-Drop) läuft weiter und wird ebenfalls in Drive gespeichert', async ({ context, page }) => {
  const drive = await fakeGoogle(context, 'anna@i2d.test');
  await signIn(page);
  await page.evaluate(() =>
    localStorage.setItem('liveslides.decks', JSON.stringify([{ id: 'old', title: 'Alt', slides: [
      { id: 's1', type: 'photodrop', data: { question: 'Alte Folie', max: 1, gallery: 'yes' } } ] }])),
  );
  await page.goto('/#/present/old');
  await page.reload();
  await expect(page.getByText('Alte Folie')).toBeVisible();
  const code = (await page.locator('.bar .code').innerText()).trim();
  const phone = await context.newPage();
  await phone.goto(`/#/join/${code}`);
  await phone.getByPlaceholder('Dein Name').fill('Mia');
  await phone.getByRole('button', { name: 'Los!' }).click();
  await phone.locator('input[type=file]').setInputFiles({ name: 'a.png', mimeType: 'image/png', buffer: PNG });
  await expect(phone.locator('img.preview')).toBeVisible();
  await phone.getByRole('button', { name: 'Senden' }).click();
  await expect.poll(() => drive.uploads.some((u) => u.body.includes('"liveslides":"photo"')), { timeout: 10_000 }).toBe(true);
  expect(drive.folders).toEqual(['LiveSlides', 'Alt', 'Fotos']);
});

test('Datei, die kein Bild ist: verständliche Fehlermeldung, nichts wird gesendet', async ({ context, page }) => {
  await fakeGoogle(context, 'anna@i2d.test');
  await signIn(page);
  await page.evaluate((d) => localStorage.setItem('liveslides.decks', JSON.stringify(d)), dropDeck());
  await page.goto('/#/present/fd');
  await page.reload();
  const code = (await page.locator('.bar .code').innerText()).trim();
  const phone = await context.newPage();
  await phone.goto(`/#/join/${code}`);
  await phone.getByPlaceholder('Dein Name').fill('Mia');
  await phone.getByRole('button', { name: 'Los!' }).click();
  await phone.locator('input[type=file]').setInputFiles({ name: 'notiz.txt', mimeType: 'text/plain', buffer: Buffer.from('hallo') });
  await expect(phone.getByRole('alert')).toContainText('keine Bilddatei');
  await expect(phone.getByRole('button', { name: 'Senden' })).toBeDisabled();
});
