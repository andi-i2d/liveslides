import { expect, test } from '@playwright/test';
import { fakeGoogle, fakePhotos, signIn } from './fakes';

// Instanz mit Google-Anmeldung (Port 5198); Google Fotos wird simuliert.
test.use({ baseURL: 'http://localhost:5198', locale: 'de-DE' });

async function openEditor(page: import('@playwright/test').Page) {
  await page.evaluate(() =>
    localStorage.setItem('liveslides.decks', JSON.stringify([{ id: 'ph', title: 'Fotos', slides: [
      { id: 's1', type: 'pinimage', data: { question: 'Wo?', image: '' } } ] }])),
  );
  await page.goto('/#/edit/ph');
  await page.reload();
}

test('Aus Google Fotos: Auswahl im eigenen Fenster, Foto wird geladen, eingebettet, Sitzung gelöscht', async ({ context, page }) => {
  await fakeGoogle(context, 'anna@i2d.test');
  const photos = await fakePhotos(context);
  await signIn(page);
  await openEditor(page);

  const popup = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Aus Google Fotos …' }).click();
  expect((await popup).url()).toBe('https://photos.google.com/picker/S1/autoclose'); // schließt sich nach der Auswahl selbst
  await expect(page.getByText('Wähle dein Foto im Fenster von Google Fotos')).toBeVisible();
  await expect(page.locator('.imgchip')).toContainText('Bild eingebettet');
  await expect(page.locator('.photostatus')).toHaveCount(0);

  await expect.poll(() => photos.calls.some((c) => c.method === 'DELETE')).toBe(true);
  const create = photos.calls.find((c) => c.method === 'POST')!;
  expect(JSON.parse(create.body!)).toEqual({ pickingConfig: { maxItemCount: '1' } });
  expect(photos.calls.some((c) => c.path.startsWith('/v1/mediaItems?sessionId=S1'))).toBe(true);

  // Der Fotos-Bereich wird getrennt vom Login angefordert (der Login selbst fragt ihn nicht ab)
  const scopes: string[] = await page.evaluate(() => (window as any).__scopes);
  expect(scopes.filter((s) => s.includes('photospicker')).length).toBe(1);
  expect(scopes[0]).not.toContain('photospicker');
});

test('Abbrechen beendet die Auswahl, löscht die Sitzung und zeigt keinen Fehler', async ({ context, page }) => {
  await fakeGoogle(context, 'anna@i2d.test');
  const photos = await fakePhotos(context, { polls: [false] }); // nie fertig
  await signIn(page);
  await openEditor(page);
  await page.getByRole('button', { name: 'Aus Google Fotos …' }).click();
  await expect(page.locator('.photostatus')).toBeVisible();
  await page.locator('.photostatus').getByRole('button', { name: 'Abbrechen' }).click();
  await expect(page.locator('.photostatus')).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.locator('.imgchip')).toHaveCount(0);
  await expect.poll(() => photos.calls.some((c) => c.method === 'DELETE')).toBe(true);
});

test('Blockiertes Fenster: Knopf „Google Fotos öffnen“ erscheint, öffnet das Fenster, danach läuft alles weiter', async ({ context, page }) => {
  await fakeGoogle(context, 'anna@i2d.test');
  await fakePhotos(context, { polls: [false, false, false, true] });
  // Popup-Blocker simulieren: der erste automatische Aufruf scheitert, spätere (per Klick) funktionieren
  await context.addInitScript(() => {
    const orig = window.open.bind(window);
    let n = 0;
    window.open = (...a: Parameters<typeof window.open>) => (n++ === 0 ? null : orig(...a));
  });
  await signIn(page);
  await openEditor(page);
  await page.getByRole('button', { name: 'Aus Google Fotos …' }).click();
  await expect(page.getByText('vom Browser blockiert')).toBeVisible();
  const popup = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Google Fotos öffnen' }).click();
  expect((await popup).url()).toBe('https://photos.google.com/picker/S1/autoclose');
  await expect(page.locator('.imgchip')).toContainText('Bild eingebettet'); // nach der Auswahl geht es automatisch weiter
});
test('Browser darf das Foto nicht laden (CORS): klare Meldung mit Ausweg, Feld bleibt leer', async ({ context, page }) => {
  await fakeGoogle(context, 'anna@i2d.test');
  const photos = await fakePhotos(context, { imageFails: true });
  await signIn(page);
  await openEditor(page);
  await page.getByRole('button', { name: 'Aus Google Fotos …' }).click();
  await expect(page.getByRole('alert')).toContainText('Vom Rechner');
  await expect(page.locator('.imgchip')).toHaveCount(0);
  await expect.poll(() => photos.calls.some((c) => c.method === 'DELETE')).toBe(true);
});