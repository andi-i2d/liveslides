import { expect, test } from '@playwright/test';

// Ohne Google-Anmeldung (Port 5199): Der Foto-Drop zeigt die Fotos, kann sie aber nicht in Drive ablegen. Das sagt die App offen.
test('Ohne Anmeldung warnt der Präsentator, dass Fotos nicht in Drive gespeichert werden', async ({ browser }) => {
  const ctx = await browser.newContext({ locale: 'de-DE' });
  const pres = await ctx.newPage();
  await pres.goto('/');
  await pres.evaluate(() => {
    localStorage.setItem('liveslides.lang', 'de');
    localStorage.setItem('liveslides.decks', JSON.stringify([{ id: 'fd', title: 'T', slides: [
      { id: 's1', type: 'photoshare', data: { question: 'Fotos?', max: 1, gallery: 'yes' } },
      { id: 's2', type: 'title', data: { title: 'Ende', subtitle: '' } },
    ] }]));
  });
  await pres.goto('/#/present/fd');
  await expect(pres.getByText('nicht angemeldet, Fotos werden nicht in Drive gespeichert')).toBeVisible();
  await pres.keyboard.press('ArrowRight'); // andere Folie: keine Warnung
  await expect(pres.getByText('nicht angemeldet')).toHaveCount(0);
  await ctx.close();
});
