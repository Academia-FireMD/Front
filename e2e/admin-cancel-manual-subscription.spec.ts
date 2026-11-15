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
import { loginAsAdminMock } from './helpers/auth.helper';

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

    await loginAsAdminMock(page, userAdminFixture);

    await page.goto('/app/test/user-dashboard');
    await expect(page.locator('text=Diego').first()).toBeVisible({
      timeout: 15_000,
    });

    // La gestión vigente se realiza desde la ficha, conservando el endpoint.
    await page.route('**/user/admin/140', (route) =>
      route.fulfill({
        json: {
          usuario: diegoMock,
          cursos: [],
          gestion: {
            tipo: 'EXTERNA',
            motivo: null,
            comprobadaEn: new Date().toISOString(),
            capacidades: {
              puedeDarBajaExterna: true,
              puedeEliminar: true,
              puedeGestionarWoo: false,
              suscripcionesExternas: [5001],
            },
          },
          resumenEliminacion: {
            suscripciones: 1,
            cursos: 0,
            progresos: 0,
            consumibles: 0,
            invitaciones: 0,
          },
          consultadoEn: new Date().toISOString(),
        },
      }),
    );
    await page.goto('/app/test/user/140?tab=access');
    const acciones = page
      .getByTestId('alumno-suscripciones')
      .getByRole('button', { name: /Acciones del plan/ });
    await acciones.scrollIntoViewIfNeeded();
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    await acciones.click();
    await page
      .getByRole('menuitem', { name: 'Cancelar este plan', exact: true })
      .click();
    const confirmacion = page.getByRole('dialog', {
      name: 'Cancelar solo este plan',
      exact: true,
    });
    await expect(confirmacion).toContainText('Valencia Ayuntamiento');
    await expect(confirmacion).toContainText('Los demás planes');
    expect(cancelCalled).toBe(false);
    await page.getByTestId('admin-confirm-action').click();
    await expect(page.getByTestId('admin-operation-result')).toContainText(
      'Plan externo cancelado',
    );

    // Esperar el toast / verificar endpoint
    await expect.poll(() => cancelCalled, { timeout: 10_000 }).toBe(true);
    expect(receivedId).toBe('5001');
  });
});
