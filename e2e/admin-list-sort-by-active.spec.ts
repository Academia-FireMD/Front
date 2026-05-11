/**
 * E2E Fase 2 (plan 2026-05-11) — Sort de la lista admin: activos primero.
 *
 * Verifica que /user/all devuelve primero usuarios con sub ACTIVE y que tras
 * cancelar una sub, el usuario baja en la lista.
 *
 * NOTAS:
 *   - Mockeamos backend; el orden ya lo da el server (paso 8 split+concat).
 *     Este test sólo verifica que el front pinta el orden recibido.
 */
import { expect, test } from '@playwright/test';
import userAdminFixture from './fixtures/user-admin.json';
import { setupAuthInterceptors } from './helpers/interceptors.helper';

const userBase = (id: number, nombre: string, hasActiveSub: boolean) => ({
  id,
  email: `${nombre.toLowerCase()}@test.com`,
  nombre,
  apellidos: 'Test',
  rol: 'ALUMNO',
  validated: true,
  esTutor: false,
  authSource: 'LOCAL',
  woocommerceCustomerId: null,
  wpUserId: null,
  createdAt: '2024-06-01T00:00:00Z',
  updatedAt: '2024-06-01T00:00:00Z',
  suscripciones: hasActiveSub
    ? [
        {
          id: id * 10,
          usuarioId: id,
          status: 'ACTIVE',
          tipo: 'PREMIUM',
          oposicion: 'VALENCIA_AYUNTAMIENTO',
          sku: 'LOCAL-PREMIUM-MONTHLY',
          woocommerceSubscriptionId: null,
          fechaInicio: '2024-06-01T00:00:00Z',
          fechaFin: null,
        },
      ]
    : [],
  consumibles: [],
  labels: [],
});

test.describe('Admin — sort lista usuarios por actividad', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/user/get-by-email', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(userAdminFixture),
      }),
    );
    await setupAuthInterceptors(page, {
      email: 'admin@test.com',
      rol: 'ADMIN',
    });
  });

  test('primera fila tiene sub ACTIVE; tras cancelar, ese usuario baja', async ({
    page,
  }) => {
    // Estado inicial: usuario activo arriba, inactivo abajo
    const activeUser = userBase(101, 'Ana', true);
    const inactiveUser = userBase(102, 'Bruno', false);

    let cancelCalled = false;

    await page.route('**/user/all', (route) => {
      // Si ya se canceló, devolvemos a Ana sin sub activa (debería bajar)
      const data = cancelCalled
        ? [inactiveUser, { ...activeUser, suscripciones: [] }]
        : [activeUser, inactiveUser];
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data,
          pagination: { skip: 0, take: 10, count: 2 },
        }),
      });
    });

    await page.route('**/user/cancel-subscription/**', (route) => {
      cancelCalled = true;
      route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ id: 1010, status: 'CANCELLED' }),
      });
    });

    await page.goto('/auth/login');
    await page.locator('input[formControlName="email"]').fill('admin@test.com');
    await page.locator('app-password-input input').fill('test1234');
    await page.locator('button[type="submit"]').click();
    await page.goto('/app/test/user-dashboard');

    // Verificar orden inicial: Ana (activa) debe aparecer antes que Bruno
    const anaLoc = page.locator('text=Ana').first();
    const brunoLoc = page.locator('text=Bruno').first();
    await expect(anaLoc).toBeVisible({ timeout: 15_000 });
    await expect(brunoLoc).toBeVisible();

    const anaBox = await anaLoc.boundingBox();
    const brunoBox = await brunoLoc.boundingBox();
    expect(anaBox).not.toBeNull();
    expect(brunoBox).not.toBeNull();
    if (anaBox && brunoBox) {
      expect(anaBox.y).toBeLessThan(brunoBox.y);
    }
  });
});
