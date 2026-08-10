import { expect, test } from '@playwright/test';
import userAdminFixture from './fixtures/user-admin.json';
import { loginAsAdminMock } from './helpers/auth.helper';

const manualSubscription = {
  id: 5001,
  usuarioId: 140,
  status: 'ACTIVE',
  tipo: 'PREMIUM',
  oposicion: 'VALENCIA_AYUNTAMIENTO',
  sku: 'LOCAL-PREMIUM-MONTHLY',
  woocommerceSubscriptionId: null,
  fechaInicio: '2024-06-01T00:00:00Z',
  fechaFin: null,
};

const diego = {
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
  cantidadPlanificaciones: 0,
  suscripciones: [manualSubscription],
  consumibles: [],
  labels: [],
};

test.describe('Admin — cancelación manual desde la ficha', () => {
  test('confirma la cancelación, llama el endpoint y muestra feedback', async ({
    page,
  }) => {
    let cancelled = false;
    await loginAsAdminMock(page, userAdminFixture);
    await page.route('**/user/admin/140', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...diego,
          suscripciones: cancelled
            ? [{ ...manualSubscription, status: 'CANCELLED' }]
            : [manualSubscription],
        }),
      }),
    );
    await page.route('**/user/planifications/140', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '[]',
      }),
    );
    await page.route('**/planificacion-fisica/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '[]',
      }),
    );
    await page.route('**/user/cancel-subscription/5001', (route) => {
      cancelled = true;
      route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ ...manualSubscription, status: 'CANCELLED' }),
      });
    });

    await page.goto('/app/test/user/140');
    await expect(
      page.getByRole('heading', { name: 'Diego Sánchez' }),
    ).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole('button', { name: 'Suscripciones' }).click();
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByText('Cancelar suscripción')).toBeVisible();
    await page.locator('button.p-confirm-dialog-accept').click();

    await expect.poll(() => cancelled).toBe(true);
    await expect(page.getByText('Suscripción cancelada')).toBeVisible();
    await expect(page.getByText('PREMIUM · CANCELLED')).toBeVisible();
  });
});
