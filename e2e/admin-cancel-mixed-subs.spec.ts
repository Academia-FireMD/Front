import { expect, test } from '@playwright/test';
import userAdminFixture from './fixtures/user-admin.json';
import { loginAsAdminMock } from './helpers/auth.helper';

const subscriptions = [
  {
    id: 700,
    status: 'ACTIVE',
    tipo: 'PREMIUM',
    oposicion: 'VALENCIA_AYUNTAMIENTO',
    woocommerceSubscriptionId: null,
  },
  {
    id: 701,
    status: 'ACTIVE',
    tipo: 'ADVANCED',
    oposicion: 'ALICANTE_CPBA',
    woocommerceSubscriptionId: '999_abc',
  },
];

test('Admin — cancela suscripciones manual y Woo desde la ficha', async ({
  page,
}) => {
  const cancelled = new Set<number>();
  const calls: number[] = [];
  await loginAsAdminMock(page, userAdminFixture);
  await page.route('**/user/admin/200', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 200,
        email: 'mixed@test.com',
        nombre: 'Mixed',
        apellidos: 'User',
        rol: 'ALUMNO',
        validated: true,
        cantidadPlanificaciones: 0,
        suscripciones: subscriptions.map((sub) =>
          cancelled.has(sub.id) ? { ...sub, status: 'CANCELLED' } : sub,
        ),
        consumibles: [],
        labels: [],
      }),
    }),
  );
  await page.route('**/user/planifications/200', (route) =>
    route.fulfill({ status: 200, body: '[]' }),
  );
  await page.route('**/planificacion-fisica/**', (route) =>
    route.fulfill({ status: 200, body: '[]' }),
  );
  await page.route('**/user/cancel-subscription/**', (route) => {
    const id = Number(route.request().url().split('/').pop());
    calls.push(id);
    cancelled.add(id);
    route.fulfill({
      status: 201,
      body: JSON.stringify({ id, status: 'CANCELLED' }),
    });
  });
  await page.goto('/app/test/user/200');
  await expect(page.getByRole('heading', { name: 'Mixed User' })).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole('button', { name: 'Suscripciones' }).click();
  for (const id of [700, 701]) {
    const entry = page.locator('.assignment').filter({
      hasText: id === 700 ? 'VALENCIA_AYUNTAMIENTO' : 'ALICANTE_CPBA',
    });
    await entry.getByRole('button', { name: 'Cancelar' }).click();
    await page.locator('button.p-confirm-dialog-accept').click();
    await expect.poll(() => calls.includes(id)).toBe(true);
    await expect(entry.getByText(/CANCELLED/)).toBeVisible();
  }
  expect(calls).toEqual([700, 701]);
});
