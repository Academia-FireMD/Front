import { expect, test } from '@playwright/test';
import userAdminFixture from './fixtures/user-admin.json';
import { loginAsRoleMock } from './helpers/auth.helper';

test('los controles del bloque no pisan el contenido en móvil', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.route('**/planificaciones/bloques', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          {
            id: 1,
            identificador: 'ENTRENAMIENTO PRESENCIAL',
            descripcion: 'Entrenamiento presencial con contenido reutilizable',
            subBloques: [{ id: 10 }, { id: 11 }],
            createdAt: '2026-09-01T10:00:00.000Z',
          },
        ],
        pagination: { take: 10, skip: 0, searchTerm: '', count: 1 },
      }),
    }),
  );
  await loginAsRoleMock(page, {
    rol: 'ADMIN',
    email: 'admin@test.com',
    userFixture: userAdminFixture,
  });
  await page.goto('/app/planificacion/bloques');

  const item = page.locator('.bloque-item').first();
  await expect(item).toBeVisible();
  const details = await item.locator('.bloque-item__details').boundingBox();
  const actions = await item.locator('.bloque-item__actions').boundingBox();
  const card = await page
    .locator('.item-container')
    .filter({ has: item })
    .first()
    .boundingBox();
  expect(details).not.toBeNull();
  expect(actions).not.toBeNull();
  expect(card).not.toBeNull();
  expect(actions!.y).toBeGreaterThanOrEqual(details!.y + details!.height - 1);
  expect(actions!.x + actions!.width).toBeLessThanOrEqual(375);
  expect(card!.y).toBeLessThanOrEqual(details!.y);
  expect(card!.y + card!.height).toBeGreaterThanOrEqual(
    actions!.y + actions!.height - 1,
  );

  for (const button of await item
    .locator('.bloque-item__actions button')
    .all()) {
    const box = await button.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    375,
  );
});
