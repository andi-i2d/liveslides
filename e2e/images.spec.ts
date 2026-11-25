import { expect, test, type BrowserContext } from '@playwright/test';

// 1×1-PNG; wird beim Einbetten per Canvas zu einem JPEG verkleinert
const PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const png = Buffer.from(PNG_B64, 'base64');

const deckWith = (slides: unknown[]) => [{ id: 'img', title: 'Bilder', slides }];
const slide = (id: string, type: string, data: unknown) => ({ id, type, data });

test('Bild vom Rechner: wird verkleinert eingebettet, gespeichert und im Editor angezeigt', async ({ page }) => {
  await page.goto('/');
  await page.evaluate((d) => {
    localStorage.setItem('liveslides.lang', 'de');
    localStorage.setItem('liveslides.decks', JSON.stringify(d));
  }, deckWith([slide('s1', 'content', { title: 'Mit Bild', body: 'Text', image: '', layout: 'right' })]));
  await page.goto('/#/edit/img');
  await page.reload();
  await page.locator('input[type=file]').setInputFiles({ name: 'foto.png', mimeType: 'image/png', buffer: png });
  await expect(page.locator('.imgchip')).toContainText('Bild eingebettet');
  await expect(page.locator('.stage img.pic')).toHaveAttribute('src', /^data:image\/jpeg;base64,/);
  const readSaved = () => page.evaluate(() => JSON.parse(localStorage.getItem('liveslides.decks')!)[0].slides[0].data.image as string);
  await expect.poll(readSaved).toMatch(/^data:image\/jpeg;base64,/); // Sichern läuft kurz nach dem Rendern
  expect((await readSaved()).length).toBeLessThan(250_000); // unter dem Nachrichten-Limit
  await page.getByRole('button', { name: 'Entfernen' }).click(); // zurück zum URL-Feld
  await expect(page.getByLabel('Bild-URL')).toBeVisible();
});

test('Keine Bilddatei: verständliche Fehlermeldung, Feld bleibt unverändert', async ({ page }) => {
  await page.goto('/');
  await page.evaluate((d) => {
    localStorage.setItem('liveslides.lang', 'de');
    localStorage.setItem('liveslides.decks', JSON.stringify(d));
  }, deckWith([slide('s1', 'content', { title: 'T', body: 'x', image: 'https://example.org/a.jpg', layout: 'right' })]));
  await page.goto('/#/edit/img');
  await page.reload();
  await page.locator('input[type=file]').setInputFiles({ name: 'notiz.txt', mimeType: 'text/plain', buffer: Buffer.from('hallo') });
  await expect(page.getByRole('alert')).toContainText('keine Bilddatei');
  await expect(page.getByLabel('Bild-URL')).toHaveValue('https://example.org/a.jpg');
});

/** Zeichnet alle über BroadcastChannel gesendeten Nachrichten des Präsentators auf (Größe + Typ). */
async function recordSent(ctx: BrowserContext) {
  await ctx.addInitScript(() => {
    const orig = BroadcastChannel.prototype.postMessage;
    (window as any).__sent = [];
    BroadcastChannel.prototype.postMessage = function (m: any) {
      (window as any).__sent.push({ t: m?.t, size: JSON.stringify(m).length, hasData: JSON.stringify(m).includes('data:image'), deck: !!m?.deck });
      return orig.call(this, m);
    };
  });
}

test('Eingebettete Bilder: Deck für Handys bleibt klein, das Bild kommt als eigene Nachricht und wird angezeigt', async ({ browser }) => {
  const ctx = await browser.newContext({ locale: 'de-DE' });
  await recordSent(ctx);
  const big = 'data:image/jpeg;base64,' + 'A'.repeat(160_000); // ~120 KB eingebettetes Bild
  const pres = await ctx.newPage();
  await pres.goto('/');
  await pres.evaluate((d) => {
    localStorage.setItem('liveslides.lang', 'de');
    localStorage.setItem('liveslides.decks', JSON.stringify(d));
  }, deckWith([
    slide('s1', 'content', { title: 'Nur Beamer', body: 'x', image: big, layout: 'right' }),
    slide('s2', 'pinimage', { question: 'Wo?', image: big }),
  ]));
  await pres.goto('/#/present/img');
  const code = (await pres.locator('.bar .code').innerText()).trim();

  const phone = await ctx.newPage();
  await phone.goto(`/#/join/${code}`);
  await phone.getByRole('button', { name: 'Los!' }).click();
  await expect(phone.getByText('Schau auf den großen Bildschirm')).toBeVisible(); // Folie 1: Bild nur auf dem Beamer

  await pres.keyboard.press('ArrowRight'); // Folie 2: Pin auf Bild, das Handy zeigt das Bild
  await expect(phone.locator('.pinimg img')).toHaveAttribute('src', /^data:image\/jpeg;base64,/);

  const sent: { t: string; size: number; hasData: boolean; deck: boolean }[] = await pres.evaluate(() => (window as any).__sent);
  const deckMsgs = sent.filter((m) => m.deck);
  expect(deckMsgs.length).toBeGreaterThan(0);
  for (const m of deckMsgs) {
    expect(m.hasData).toBe(false); // keine eingebetteten Bilder im Deck
    expect(m.size).toBeLessThan(5000);
  }
  const assets = sent.filter((m) => m.t === 'asset');
  expect(assets.length).toBeGreaterThan(0);
  for (const m of assets) expect(m.size).toBeLessThan(256_000); // passt in eine Supabase-Nachricht (Free-Plan)
  await ctx.close();
});

test('Spätes Beitreten auf einer Bildfolie: das Bild kommt mit der Antwort auf „Hallo“', async ({ browser }) => {
  const ctx = await browser.newContext({ locale: 'de-DE' });
  const big = 'data:image/jpeg;base64,' + 'A'.repeat(40_000);
  const pres = await ctx.newPage();
  await pres.goto('/');
  await pres.evaluate((d) => {
    localStorage.setItem('liveslides.lang', 'de');
    localStorage.setItem('liveslides.decks', JSON.stringify(d));
  }, deckWith([slide('s1', 'pinimage', { question: 'Wo?', image: big })]));
  await pres.goto('/#/present/img');
  const code = (await pres.locator('.bar .code').innerText()).trim();
  await pres.waitForTimeout(500); // Präsentator hat die Folie schon länger offen, niemand war dabei
  const late = await ctx.newPage();
  await late.goto(`/#/join/${code}`);
  await late.getByRole('button', { name: 'Los!' }).click();
  await expect(late.locator('.pinimg img')).toHaveAttribute('src', /^data:image\/jpeg;base64,/);
  await ctx.close();
});
