import { expect, test } from '@playwright/test';
import userAdminFixture from './fixtures/user-admin.json';
import { loginAsAdminMock } from './helpers/auth.helper';

const user = {
  id: 140,
  email: 'diego@test.com',
  nombre: 'Diego',
  apellidos: 'Sánchez',
  rol: 'ALUMNO',
  validated: true,
  esTutor: false,
  authSource: 'LOCAL',
  woocommerceCustomerId: null,
  wpUserId: null,
  createdAt: '2024-06-01T00:00:00Z',
  updatedAt: '2024-06-01T00:00:00Z',
  suscripciones: [],
  consumibles: [],
  labels: [],
};

test.describe('Admin — tabs de la expansión de usuarios', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdminMock(page, userAdminFixture);

    await page.route('**/user/all', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [user],
          pagination: { skip: 0, take: 10, count: 1 },
        }),
      }),
    );
    await page.route('**/user/planifications/140', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      }),
    );
    await page.route('**/planificacion-fisica/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      }),
    );
    await page.route('**/user/obtain-avaliable-subscriptions', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      }),
    );
    await page.route('**/labels', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      }),
    );
  });

  test('cambiar una pestaña expandida no abre Editar usuario', async ({
    page,
  }) => {
    await page.goto('/app/test/user-dashboard');

    const row = page.locator('.item-container').filter({ hasText: 'Diego' });
    await expect(row).toBeVisible({ timeout: 15_000 });

    await row.locator('.right-side button').first().click();
    const expansion = row.locator('[data-prevent-item-click]');
    await expect(expansion).toBeVisible();

    await expansion.getByRole('tab', { name: /Marcas físicas/i }).click();

    await expect(
      expansion.getByRole('tab', { name: /Marcas físicas/i }),
    ).toHaveAttribute('aria-selected', 'true');
    await expect(
      page.getByRole('dialog', { name: 'Editar usuario' }),
    ).toHaveCount(0);
  });
});
