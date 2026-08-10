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
  suscripciones: [],
  consumibles: [],
  labels: [],
};

test.describe('Admin — selección de alumno para factura manual', () => {
  test('una fila selecciona y deselecciona sin navegar a la ficha', async ({
    page,
  }) => {
    await loginAsAdminMock(page, userAdminFixture);
    await page.route('**/admin/facturas**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ facturas: [], total: 0 }),
      }),
    );
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

    await page.goto('/app/facturacion');
    await page.getByRole('button', { name: 'Nueva factura' }).click();
    await expect(
      page.getByRole('dialog', { name: 'Nueva factura manual' }),
    ).toBeVisible();
    const row = page
      .locator('.item-container')
      .filter({ hasText: 'Diego Sánchez' });
    await expect(row).toBeVisible({ timeout: 15_000 });

    await row.click();
    await expect(page).toHaveURL(/\/app\/facturacion/);
    await expect(row.getByRole('checkbox')).toBeChecked();

    await row.click();
    await expect(page).toHaveURL(/\/app\/facturacion/);
    await expect(row.getByRole('checkbox')).not.toBeChecked();
  });
});
