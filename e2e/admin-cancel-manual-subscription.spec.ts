/**
 * E2E Fase 2 (plan 2026-05-11) — Cancelación de suscripción manual desde admin.
 *
 * Flujo:
 *   1. Admin login (mock)
 *   2. Navegar a /app/test/user-dashboard
 *   3. Mockear /user/all → Diego (id=140) con sub ACTIVE manual
 *   4. Localizar fila Diego, abrir menú "Suscripción"
 *   5. Click botón "Cancelar" en sub ACTIVE
 *   6. Confirmar dialog
 *   7. Verificar toast success + endpoint llamado con id correcto
 *
 * NOTAS DE EJECUCIÓN:
 *   - Los selectores de PrimeNG (p-menu items, p-confirmdialog) pueden requerir
 *     afinado al ejecutarlo contra la app real. Si el `npx ng serve` real expone
 *     atributos de testing distintos, ajustar los locators.
 *   - Mockeamos backend completamente: no se requiere BD ni Server arriba.
 */
import { expect, test } from '@playwright/test';
import userAdminFixture from './fixtures/user-admin.json';
import { setupAuthInterceptors } from './helpers/interceptors.helper';

const diegoActiveSub = {
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

const diegoMock = {
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
  suscripciones: [diegoActiveSub],
  consumibles: [],
  labels: [],
};

test.describe('Admin — cancelar suscripción manual', () => {
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

    await page.route('**/user/all', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [diegoMock],
          pagination: { skip: 0, take: 10, count: 1 },
        }),
      }),
    );
  });

  test('cancelar sub manual: llama endpoint, muestra toast success', async ({
    page,
  }) => {
    let cancelCalled = false;
    let receivedId: string | null = null;

    await page.route('**/user/cancel-subscription/**', (route) => {
      cancelCalled = true;
      const url = route.request().url();
      receivedId = url.split('/cancel-subscription/')[1] ?? null;
      route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          ...diegoActiveSub,
          status: 'CANCELLED',
          fechaFin: new Date().toISOString(),
        }),
      });
    });

    await page.goto('/auth/login');
    await page
      .locator('input[formControlName="email"]')
      .fill('admin@test.com');
    await page.locator('app-password-input input').fill('test1234');
    await page.locator('button[type="submit"]').click();

    await page.goto('/app/test/user-dashboard');
    await expect(page.locator('text=Diego').first()).toBeVisible({
      timeout: 15_000,
    });

    // Abrir menú contextual del usuario (3-dots / dropdown).
    // Selector resiliente: cualquier botón con icono pi-ellipsis o "más opciones".
    const userRow = page.locator('text=Diego').first();
    await userRow
      .locator('xpath=ancestor::*[self::tr or self::div][1]')
      .locator(
        'button[icon*="ellipsis"], button:has(i.pi-ellipsis-v), [aria-haspopup="true"]',
      )
      .first()
      .click({ timeout: 5_000 });

    // Click el ítem "Suscripción" del menú PrimeNG (p-menu / p-menuitem)
    await page
      .locator('a.p-menuitem-link, .p-menuitem-text')
      .filter({ hasText: /^Suscripción$/ })
      .first()
      .click();

    // Click botón "Cancelar" (icon ban, tooltip "Cancelar suscripción...")
    await page
      .locator('button[icon*="ban"], button:has(i.pi-ban)')
      .first()
      .click({ timeout: 5_000 });

    // p-confirmDialog → click "Sí, cancelar"
    await page
      .locator('button.p-confirm-dialog-accept, button:has-text("Sí, cancelar")')
      .first()
      .click();

    // Esperar el toast / verificar endpoint
    await expect.poll(() => cancelCalled, { timeout: 10_000 }).toBe(true);
    expect(receivedId).toBe('5001');
  });
});
