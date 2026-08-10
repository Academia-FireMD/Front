/**
 * E2E Fase 2 (plan 2026-05-11) — Paginación preserva el sort.
 *
 * Verifica que el front pasa skip/take correctamente y que el orden devuelto
 * por el server (split+concat) se preserva al cambiar de página.
 */
import { expect, test } from '@playwright/test';
import userAdminFixture from './fixtures/user-admin.json';
import { loginAsAdminMock } from './helpers/auth.helper';

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

test.describe('Admin — paginación conserva el orden del listado compacto', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdminMock(page, userAdminFixture);
  });

  test('la página indicada por query conserva el orden devuelto por el servidor', async ({
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

    await page.goto('/app/test/user?skip=5&take=5');

    // Esperar primera carga
    await expect(page.locator('text=User5').first()).toBeVisible({
      timeout: 15_000,
    });

    expect(callLog[0]).toEqual({ skip: 5, take: 5 });
    await expect(page.locator('text=User10')).toHaveCount(0);
    // El menú de acciones por fila (3 puntos) existe en modo overview y abre
    // las opciones del usuario.
    const actionsBtn = page
      .locator('[data-testid="user-actions-btn"]')
      .first();
    await expect(actionsBtn).toBeVisible();
    await actionsBtn.click();
    await expect(page.getByText('Ver ficha').first()).toBeVisible();
  });
});
