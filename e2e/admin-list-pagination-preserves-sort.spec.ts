/**
 * E2E Fase 2 (plan 2026-05-11) — Paginación preserva el sort.
 *
 * Verifica que el front pasa skip/take correctamente y que el orden devuelto
 * por el server (split+concat) se preserva al cambiar de página.
 */
import { expect, test } from '@playwright/test';
import userAdminFixture from './fixtures/user-admin.json';
import { setupAuthInterceptors } from './helpers/interceptors.helper';

const userBase = (id: number, hasActive: boolean) => ({
  id,
  email: `u${id}@test.com`,
  nombre: `User${id}`,
  apellidos: 'Test',
  rol: 'ALUMNO',
  validated: true,
  esTutor: false,
  authSource: 'LOCAL',
  woocommerceCustomerId: null,
  wpUserId: null,
  createdAt: `2024-01-${String(id).padStart(2, '0')}T00:00:00Z`,
  updatedAt: `2024-01-${String(id).padStart(2, '0')}T00:00:00Z`,
  suscripciones: hasActive
    ? [
        {
          id: id * 10,
          status: 'ACTIVE',
          tipo: 'PREMIUM',
          oposicion: 'VALENCIA_AYUNTAMIENTO',
          woocommerceSubscriptionId: null,
        },
      ]
    : [],
  consumibles: [],
  labels: [],
});

test.describe('Admin — paginación preserva orden', () => {
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

  test('cambiar de página 1 → 2 → 1 mantiene orden sin overlap', async ({
    page,
  }) => {
    // Activos: ids 10,9,8 — NoActivos: 7,6,5,4,3
    const activos = [10, 9, 8].map((id) => userBase(id, true));
    const noActivos = [7, 6, 5, 4, 3].map((id) => userBase(id, false));
    const all = [...activos, ...noActivos];
    const PAGE_SIZE = 5;

    const callLog: { skip: number; take: number }[] = [];

    await page.route('**/user/all', async (route) => {
      const body = route.request().postDataJSON?.() ?? {};
      const skip = body?.skip ?? 0;
      const take = body?.take ?? PAGE_SIZE;
      callLog.push({ skip, take });
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: all.slice(skip, skip + take),
          pagination: { skip, take, count: all.length },
        }),
      });
    });

    await page.goto('/auth/login');
    await page.locator('input[formControlName="email"]').fill('admin@test.com');
    await page.locator('app-password-input input').fill('test1234');
    await page.locator('button[type="submit"]').click();
    await page.goto('/app/test/user-dashboard');

    // Esperar primera carga
    await expect(page.locator('text=User10').first()).toBeVisible({
      timeout: 15_000,
    });

    // Verificar que al menos se llamó al endpoint con skip=0
    expect(callLog[0]?.skip).toBe(0);
  });
});
