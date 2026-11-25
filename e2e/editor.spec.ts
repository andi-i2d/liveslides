import { expect, test, type BrowserContext } from '@playwright/test';

const PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

async function openEditor(page: import('@playwright/test').Page, slides: unknown[]) {
  await page.goto('/');
  await page.evaluate((s) => {
    localStorage.setItem('liveslides.lang', 'de');
    localStorage.setItem('liveslides.decks', JSON.stringify([{ id: 'ed', title: 'Editor', slides: s }]));
  }, slides);
  await page.goto('/#/edit/ed');
  await page.reload();
}
const poll = { id: 's1', type: 'poll', data: { question: 'Lieblingsfarbe?', options: ['Rot', 'Blau'] } };
const title = { id: 's2', type: 'title', data: { title: 'Hallo', subtitle: 'Welt' } };

test.describe('Folienauswahl: präsentierend und interaktiv', () => {
  test('zwei Arten mit Gruppen; Auswahl fügt die Folie hinzu und markiert interaktive Folien', async ({ page }) => {
    await openEditor(page, [title]);
    await page.getByRole('button', { name: '+ Folie hinzufügen …' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    // Standard: präsentierend. Zitat ist da, Umfrage nicht.
    await expect(dialog.getByRole('tab', { name: /Präsentierend/ })).toHaveAttribute('aria-selected', 'true');
    await expect(dialog.getByRole('button', { name: /Zitat/ })).toBeVisible();
    await expect(dialog.getByRole('button', { name: /^📊 Umfrage/ })).toHaveCount(0);
    await expect(dialog.getByRole('heading', { name: 'Werkzeuge' })).toBeVisible(); // Glücksrad, Timer …
    await expect(dialog.getByRole('button', { name: /Glücksrad/ })).toBeVisible();
    // Interaktiv: Umfrage, Quiz, Foto-Drop; kein Zitat
    await dialog.getByRole('tab', { name: /Interaktiv/ }).click();
    await expect(dialog.getByRole('button', { name: /Foto-Drop/ })).toBeVisible();
    await expect(dialog.getByRole('button', { name: /Zitat/ })).toHaveCount(0);
    await expect(dialog.getByRole('heading', { name: 'Quiz' })).toBeVisible();
    await dialog.getByRole('button', { name: /^📊 Umfrage/ }).click();
    await expect(dialog).toHaveCount(0); // schließt nach der Auswahl
    const items = page.locator('button.thumb');
    await expect(items).toHaveCount(2);
    await expect(items.nth(1)).toContainText('Umfrage');
    await expect(items.nth(1).locator('.badge')).toBeVisible(); // ⚡ = interaktiv
    await expect(items.nth(0).locator('.badge')).toHaveCount(0); // Titelfolie: präsentierend
  });

  test('Escape und Klick neben das Fenster schließen die Auswahl', async ({ page }) => {
    await openEditor(page, [title]);
    await page.getByRole('button', { name: '+ Folie hinzufügen …' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('button', { name: '+ Folie hinzufügen …' }).click();
    await page.mouse.click(5, 5);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('button.thumb')).toHaveCount(1); // nichts hinzugefügt
  });
});

/** Zeichnet alle über BroadcastChannel gesendeten Nachrichten dieser Seite auf. */
async function recordSent(ctx: BrowserContext) {
  await ctx.addInitScript(() => {
    const orig = BroadcastChannel.prototype.postMessage;
    (window as any).__sent = [];
    BroadcastChannel.prototype.postMessage = function (m: any) {
      (window as any).__sent.push(m?.t);
      return orig.call(this, m);
    };
  });
}

test.describe('Teilnehmeransicht (Vorschau) im Editor', () => {
  test('zeigt die Handy-Ansicht der gewählten Folie; Eingaben bleiben lokal und senden nichts', async ({ browser }) => {
    const ctx = await browser.newContext({ locale: 'de-DE' });
    await recordSent(ctx);
    const page = await ctx.newPage();
    await openEditor(page, [poll, title]);
    await expect(page.locator('.phone')).toHaveCount(0); // standardmäßig aus
    await page.getByRole('button', { name: '📱 Teilnehmeransicht' }).click();
    const phone = page.locator('.phone');
    await expect(phone).toBeVisible();
    await expect(phone).toContainText('Vorschau: Eingaben werden nicht gesendet');
    await expect(phone.getByText('Lieblingsfarbe?')).toBeVisible(); // echte Handy-Ansicht (Player) der Umfrage
    await expect(phone.locator('.youare')).toContainText(/^👤 (\p{L})\S* \1\S*$/u); // lustiger Name wie auf dem echten Handy
    await phone.getByRole('button', { name: 'Blau' }).click();
    await expect(phone.getByText('Antwort gesendet')).toBeVisible(); // lokaler Zustand wie nach dem Absenden
    await phone.getByRole('button', { name: 'Zurücksetzen' }).click();
    await expect(phone.getByText('Antwort gesendet')).toHaveCount(0);
    expect(await page.evaluate(() => (window as any).__sent)).toEqual([]); // nichts wurde gesendet
    await ctx.close();
  });

  test('folgt der gewählten Folie; präsentierende Folien zeigen den Hinweis auf den Beamer', async ({ page }) => {
    await openEditor(page, [poll, title]);
    await page.getByRole('button', { name: '📱 Teilnehmeransicht' }).click();
    await expect(page.locator('.phone').getByText('Lieblingsfarbe?')).toBeVisible();
    await page.locator('button.thumb').nth(1).click(); // Titelfolie
    await expect(page.locator('.phone').getByText('Schau auf den großen Bildschirm')).toBeVisible();
    await expect(page.locator('.phone').getByText('Lieblingsfarbe?')).toHaveCount(0);
    await page.locator('.phone').getByRole('button', { name: 'Schließen' }).click();
    await expect(page.locator('.phone')).toHaveCount(0);
  });

  test('Foto-Drop-Folie: Vorschau zeigt Datei-Auswahl und den Datenschutz-Hinweis', async ({ page }) => {
    await openEditor(page, [{ id: 's3', type: 'photodrop', data: { question: 'Teilt Fotos', max: 2, gallery: 'yes' } }]);
    await page.getByRole('button', { name: '📱 Teilnehmeransicht' }).click();
    const phone = page.locator('.phone');
    await expect(phone.locator('input[type=file]')).toBeVisible();
    await expect(phone).toContainText('wird auf dem Beamer gezeigt und wird von den Veranstaltenden gespeichert');
    await expect(phone).toContainText('Noch 2 Fotos möglich');
    void PNG_B64;
  });
});