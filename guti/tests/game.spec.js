import { test, expect } from '@playwright/test';

const clickNode = async (page, id) => {
  const i = await page.evaluate((id) => window.__guti.game.map.idx(id), id);
  await page.locator(`.hit[data-node="${i}"]`).click({ force: true });
};

test('quebra-cabeça da fase 3: cadeia de quatro saltos dá 3 estrelas', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.getByRole('button', { name: /Campanha/ }).click();
  await page.evaluate(() => window.__guti.startLevel(3));
  await expect(page.locator('#status')).toContainText('captura obrigatória');
  for (const id of ['Lbot', 'Ly0', 'Ry1', 'Rtop', 'Ra1']) {
    await clickNode(page, id);
    await page.waitForTimeout(450);
  }
  await expect(page.locator('#modal h3')).toHaveText('Vitória!');
  await expect(page.locator('.big-stars .on')).toHaveCount(3);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('guti:progress')));
  expect(saved['3']).toBe(3);
  expect(errors).toEqual([]);
});

test('contra o computador: o computador responde e desfazer volta à sua vez', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Partida livre/ }).click();
  await page.getByRole('button', { name: 'Começar partida' }).click();
  await clickNode(page, 'Ly1');
  await clickNode(page, 'C');
  await expect(page.locator('#count-1')).toHaveText('5', { timeout: 8000 });
  await expect(page.locator('#status')).toContainText('Sua vez');
  await page.getByRole('button', { name: /Desfazer/ }).click();
  await expect(page.locator('#count-1')).toHaveText('6');
  expect(await page.evaluate(() => window.__guti.game.history.length)).toBe(0);
});

test('dois jogadores no mesmo aparelho alternam a vez', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Partida livre/ }).click();
  await page.locator('label', { hasText: '2 jogadores' }).click();
  await page.locator('.map-card', { hasText: 'Lau Kata Kati' }).click();
  await page.getByRole('button', { name: 'Começar partida' }).click();
  await expect(page.locator('#who-2')).toHaveText('Jogador 2');
  await clickNode(page, 'L1m');
  await clickNode(page, 'C');
  await expect(page.locator('#status')).toContainText('Vez das Karelas');
  await expect(page.locator('#panel-2')).toHaveClass(/active/);
});

test('celular em retrato: tabuleiro gira e cabe na tela', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.evaluate(() => window.__guti.startLevel(1));
  const vb = await page.locator('#board').getAttribute('viewBox');
  expect(vb).toBe('0 0 600 900');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  expect(overflow).toBe(false);
});
