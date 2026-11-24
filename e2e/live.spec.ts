import { expect, test, type BrowserContext } from '@playwright/test';

const mk = (type: string, data: unknown) => ({ id: Math.random().toString(36).slice(2, 9), type, data });

/** Legt ein Deck an, öffnet die Präsentator-Ansicht und liefert Seite + Beitrittscode. */
async function startPresenter(ctx: BrowserContext, slides: ReturnType<typeof mk>[]) {
  const pres = await ctx.newPage();
  await pres.goto('/');
  await pres.evaluate((s) => {
    localStorage.setItem('liveslides.lang', 'de');
    localStorage.setItem('liveslides.decks', JSON.stringify([{ id: 'e2e', title: 'E2E', slides: s }]));
  }, slides);
  await pres.goto('/#/present/e2e');
  const code = (await pres.locator('.bar .code').innerText()).trim();
  return { pres, code };
}

async function joinAs(ctx: BrowserContext, code: string, name: string) {
  const p = await ctx.newPage();
  await p.goto(`/#/join/${code}`);
  await p.getByPlaceholder('Dein Name').fill(name);
  await p.getByRole('button', { name: 'Los!' }).click();
  return p;
}

test('Umfrage: Stimme vom Handy erscheint live auf dem Beamer', async ({ browser }) => {
  const ctx = await browser.newContext({ locale: 'de-DE' });
  const { pres, code } = await startPresenter(ctx, [mk('poll', { question: 'Lieblingsfarbe?', options: ['Rot', 'Blau'] })]);
  const phone = await joinAs(ctx, code, 'Mia');
  await expect(phone.getByText('Lieblingsfarbe?')).toBeVisible();
  await phone.getByRole('button', { name: 'Blau' }).click();
  await expect(phone.getByText('Antwort gesendet')).toBeVisible();
  await expect(pres.locator('.stage .bar', { hasText: 'Blau' }).locator('.n')).toHaveText('1');
  await expect(pres.locator('.stage .bar', { hasText: 'Rot' }).locator('.n')).toHaveText('0');
  await ctx.close();
});

test('Quiz: Lösung erst nach „Auflösen“, Rangliste zeigt Punkte', async ({ browser }) => {
  const ctx = await browser.newContext({ locale: 'de-DE' });
  const { pres, code } = await startPresenter(ctx, [
    mk('shortanswer', { question: 'Hauptstadt von Frankreich?', answers: ['Paris'], points: 1000 }),
    mk('leaderboard', { title: 'Rangliste' }),
  ]);
  const phone = await joinAs(ctx, code, 'Lea');
  await phone.getByRole('textbox').fill('paris');
  await phone.getByRole('button', { name: 'Absenden' }).click();
  await expect(pres.getByText('1 Antwort(en)')).toBeVisible();
  await expect(pres.getByText('Lösung:')).toHaveCount(0);
  await pres.getByRole('button', { name: /Auflösen/ }).click();
  await expect(pres.getByText('Lösung: Paris')).toBeVisible();
  await pres.getByRole('button', { name: 'Nächste Folie' }).click();
  await expect(pres.locator('.lb li')).toContainText(['Lea1000']);
  await ctx.close();
});

test('Turnier: Schritt-Taste schaltet auch das Handy weiter', async ({ browser }) => {
  const ctx = await browser.newContext({ locale: 'de-DE' });
  const { pres, code } = await startPresenter(ctx, [mk('tournament', { title: 'T', names: ['A', 'B', 'C', 'D'] })]);
  const phone = await joinAs(ctx, code, 'Zoe');
  await expect(phone.getByText('Duell 1')).toBeVisible();
  await phone.getByRole('button', { name: 'B', exact: true }).click();
  await pres.getByRole('button', { name: /Schritt/ }).click();
  await expect(phone.getByText('Duell 2')).toBeVisible();
  await ctx.close();
});

test('Eingabeflut wird begrenzt (Rate-Limit)', async ({ browser }) => {
  const ctx = await browser.newContext({ locale: 'de-DE' });
  const { pres, code } = await startPresenter(ctx, [mk('emoji', { question: 'Tippt!', emojis: ['😀', '🔥'] })]);
  const phone = await joinAs(ctx, code, 'Spam');
  await expect(phone.getByText('Tippt!')).toBeVisible();
  const btn = phone.locator('.choice').first();
  for (let i = 0; i < 40; i++) await btn.click({ noWaitAfter: true });
  await pres.waitForTimeout(500);
  const n = Number(await pres.locator('.em b').first().innerText());
  expect(n).toBeGreaterThan(0);
  expect(n).toBeLessThan(40); // mehr als 8/s werden verworfen
  await ctx.close();
});

test('Sprachwechsel auf der Startseite', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('liveslides.lang', 'de'));
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Mitmachen' })).toBeVisible();
  await page.getByLabel('Sprache').selectOption('en');
  await expect(page.getByRole('heading', { name: 'Join' })).toBeVisible();
});
