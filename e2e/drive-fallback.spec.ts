import { expect, test } from '@playwright/test';
import { fakeDriveFile, fakeGoogle, signIn } from './fakes';

// Instanz mit Google-Anmeldung, aber OHNE API-Schlüssel (Port 5197): „Aus Drive …“ nutzt die eigene Liste.
test.use({ baseURL: 'http://localhost:5197', locale: 'de-DE' });

test('Ohne API-Schlüssel: eigene Drive-Bildliste mit Suche, Auswahl, Download und Einbetten', async ({ context, page }) => {
  await fakeGoogle(context, 'anna@i2d.test');
  await fakeDriveFile(context);
  const queries: string[] = [];
  // spezifischer als die allgemeine Drive-Simulation (später registriert = zuerst geprüft)
  await context.route((u) => u.href.includes('image%2F'), (r) => {
    queries.push(decodeURIComponent(r.request().url()));
    return r.fulfill({ json: { files: [{ id: 'img1', name: 'Teamfoto.png', mimeType: 'image/png', modifiedTime: '2026-01-02T10:00:00Z', size: '70' }] } });
  });
  await signIn(page);
  await page.evaluate(() =>
    localStorage.setItem('liveslides.decks', JSON.stringify([{ id: 'dr', title: 'Bilder', slides: [
      { id: 's1', type: 'pinimage', data: { question: 'Wo?', image: '' } } ] }])),
  );
  await page.goto('/#/edit/dr');
  await page.reload();
  await page.getByRole('button', { name: 'Aus Drive …' }).click();
  await expect(page.getByText('Teamfoto.png')).toBeVisible();
  expect(queries[0]).toContain("mimeType contains 'image/'");
  await page.getByPlaceholder('In Drive nach Bildern suchen').fill('team');
  await page.getByRole('button', { name: 'Suchen' }).click();
  await expect.poll(() => queries.some((q) => q.includes("name contains 'team'"))).toBe(true);
  await page.getByRole('button', { name: 'Wählen' }).click();
  await expect(page.locator('.imgchip')).toContainText('Bild eingebettet');
  await expect(page.locator('.drivepick')).toHaveCount(0); // Auswahl schließt sich
});