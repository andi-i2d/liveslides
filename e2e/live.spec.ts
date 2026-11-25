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

const quizSlides = () => [
  mk('shortanswer', { question: 'Hauptstadt?', answers: ['Paris'], points: 1000 }),
  mk('leaderboard', { title: 'Rangliste' }),
];
// „Lustiger Luchs“: zwei Wörter mit demselben Anfangsbuchstaben (ohne Nummer), danach die Punkte
const FUNNY = /^(\p{L})\S* \1\S*1000$/u;
const FUNNY_NAME = /^(\p{L})\S* \1\S*$/u;

/** Öffnet den Beitritt und liefert das Handy (noch vor der Namensbestätigung). */
async function openJoin(ctx: BrowserContext, code: string, pid?: string) {
  const p = await ctx.newPage();
  if (pid) await p.addInitScript((id) => localStorage.setItem('liveslides.pid', id), pid);
  await p.goto(`/#/join/${code}`);
  return p;
}
async function answerParis(phone: Awaited<ReturnType<typeof openJoin>>) {
  await phone.getByRole('textbox').fill('paris');
  await phone.getByRole('button', { name: 'Absenden' }).click();
}

test('Namensvorschlag steht im Feld: unverändert übernehmen ergibt einen lustigen Doppelnamen überall', async ({ browser }) => {
  const ctx = await browser.newContext({ locale: 'de-DE' });
  const { pres, code } = await startPresenter(ctx, quizSlides());
  const phone = await openJoin(ctx, code);
  const field = phone.getByPlaceholder('Dein Name');
  const suggestion = await field.inputValue();
  expect(suggestion).toMatch(FUNNY_NAME); // z. B. „Dreister Denker“: gleicher Anfangsbuchstabe
  await phone.getByRole('button', { name: 'Los!' }).click(); // nichts getippt: der Vorschlag gilt
  await expect(phone.locator('.youare')).toContainText(suggestion);
  await answerParis(phone);
  await expect(pres.getByText('1 Antwort(en)')).toBeVisible();
  await pres.getByRole('button', { name: 'Nächste Folie' }).click();
  await expect(pres.locator('.lb li')).toHaveText([FUNNY]);
  expect((await pres.locator('.lb li span').innerText()).trim()).toBe(suggestion); // Beamer = Handy
  await ctx.close();
});

test('Eigener Name statt Vorschlag', async ({ browser }) => {
  const ctx = await browser.newContext({ locale: 'de-DE' });
  const { pres, code } = await startPresenter(ctx, quizSlides());
  const phone = await openJoin(ctx, code);
  await phone.getByPlaceholder('Dein Name').fill('Mia');
  await phone.getByRole('button', { name: 'Los!' }).click();
  await answerParis(phone);
  await pres.getByRole('button', { name: 'Nächste Folie' }).click();
  await expect(pres.locator('.lb li')).toContainText(['Mia1000']);
  await ctx.close();
});

test('Feld leeren und bestätigen: es gilt wieder der Vorschlag (der Name ist nie leer)', async ({ browser }) => {
  const ctx = await browser.newContext({ locale: 'de-DE' });
  const { code } = await startPresenter(ctx, quizSlides());
  const phone = await openJoin(ctx, code);
  const suggestion = await phone.getByPlaceholder('Dein Name').inputValue();
  await phone.getByPlaceholder('Dein Name').fill('   ');
  await phone.getByRole('button', { name: 'Los!' }).click();
  await expect(phone.locator('.youare')).toContainText(suggestion);
  await ctx.close();
});

test('🎲 „Anderer Vorschlag“ liefert einen neuen lustigen Namen', async ({ browser }) => {
  const ctx = await browser.newContext({ locale: 'de-DE' });
  const { code } = await startPresenter(ctx, quizSlides());
  const phone = await openJoin(ctx, code);
  const field = phone.getByPlaceholder('Dein Name');
  const seen = new Set([await field.inputValue()]);
  for (let i = 0; i < 4; i++) {
    await phone.getByRole('button', { name: 'Anderer Vorschlag' }).click();
    const v = await field.inputValue();
    expect(v).toMatch(FUNNY_NAME);
    seen.add(v);
  }
  expect(seen.size).toBeGreaterThanOrEqual(4);
  await ctx.close();
});

test('Zwei Geräte mit demselben Listennamen: das zweite bekommt automatisch einen anderen, ohne Nummer', async ({ browser }) => {
  const ctx = await browser.newContext({ locale: 'de-DE' });
  const { pres, code } = await startPresenter(ctx, quizSlides());
  const a = await openJoin(ctx, code, 'pid-aaa');
  await a.getByPlaceholder('Dein Name').fill('Lustiger Luchs');
  await a.getByRole('button', { name: 'Los!' }).click();
  await answerParis(a);
  await expect(pres.getByText('1 Antwort(en)')).toBeVisible();
  const b = await openJoin(ctx, code, 'pid-bbb');
  await b.getByPlaceholder('Dein Name').fill('Lustiger Luchs');
  await b.getByRole('button', { name: 'Los!' }).click();
  await answerParis(b);
  await expect(pres.getByText('2 Antwort(en)')).toBeVisible();
  await expect(b.locator('.youare')).not.toContainText('Lustiger Luchs'); // Handy erfährt den neuen Namen
  const nameB = (await b.locator('.youare').innerText()).replace('👤', '').trim();
  expect(nameB).toMatch(FUNNY_NAME);
  expect(nameB).not.toMatch(/\d/);
  await pres.getByRole('button', { name: 'Nächste Folie' }).click();
  expect((await pres.locator('.lb li span').allInnerTexts()).map((s) => s.trim()).sort()).toEqual(['Lustiger Luchs', nameB].sort());
  await ctx.close();
});

test('Zwei Personen mit demselben getippten Namen werden unterscheidbar („Anna“ und „Anna 2“)', async ({ browser }) => {
  const ctx = await browser.newContext({ locale: 'de-DE' });
  const { pres, code } = await startPresenter(ctx, quizSlides());
  const join = async (pid: string) => {
    const p = await openJoin(ctx, code, pid);
    await p.getByPlaceholder('Dein Name').fill('Anna');
    await p.getByRole('button', { name: 'Los!' }).click();
    await answerParis(p);
    return p;
  };
  const a = await join('pid-aaa');
  await expect(pres.getByText('1 Antwort(en)')).toBeVisible();
  const b = await join('pid-bbb');
  await expect(pres.getByText('2 Antwort(en)')).toBeVisible();
  await expect(b.locator('.youare')).toContainText('Anna 2');
  await expect(a.locator('.youare')).not.toContainText('Anna 2');
  await pres.getByRole('button', { name: 'Nächste Folie' }).click();
  await expect(pres.locator('.lb li')).toHaveCount(2);
  expect((await pres.locator('.lb li span').allInnerTexts()).map((s) => s.trim()).sort()).toEqual(['Anna', 'Anna 2']);
  await ctx.close();
});
test('QR-Code lässt sich jederzeit ein- und ausblenden (Taste Q und Knopf)', async ({ browser }) => {
  const ctx = await browser.newContext({ locale: 'de-DE' });
  const { pres, code } = await startPresenter(ctx, [mk('poll', { question: 'Egal?', options: ['A', 'B'] })]);
  await expect(pres.locator('.qroverlay')).toHaveCount(0);
  await pres.keyboard.press('q');
  const overlay = pres.getByRole('dialog', { name: 'QR-Code' });
  await expect(overlay).toBeVisible();
  await expect(overlay.locator('img.qr')).toBeVisible();
  await expect(overlay).toContainText(code);
  await overlay.click(); // Klick schließt
  await expect(overlay).toHaveCount(0);
  await pres.getByRole('button', { name: /QR-Code/ }).click(); // Knopf in der Leiste
  await expect(overlay).toBeVisible();
  await pres.keyboard.press('Escape');
  await expect(overlay).toHaveCount(0);
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
