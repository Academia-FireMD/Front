import { expect, test } from '@playwright/test';
import userAdminFixture from './fixtures/user-admin.json';
import { loginAsAdminMock } from './helpers/auth.helper';

const user = {
  id: 140,
  email: `diego.${'direccion-larga-sin-espacios'.repeat(4)}@test.com`,
  nombre: 'Diego',
  apellidos: 'Sánchez',
  rol: 'ALUMNO',
  validated: true,
  esTutor: false,
  authSource: 'LOCAL',
  telefono: '600 000 000',
  cantidadPlanificaciones: 2,
  onboardingCompletado: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  fechaAccesoClasesGrabadas: null,
  tipoOposicion: ['VALENCIA_AYUNTAMIENTO'],
  tipoDePlanificacionDuracionDeseada: 'FRANJA_CUATRO_A_SEIS_HORAS',
  metodoCalificacion: 'BASICO',
  suscripciones: [
    {
      id: 5001,
      status: 'ACTIVE',
      tipo: 'PREMIUM',
      oposicion: 'VALENCIA_AYUNTAMIENTO',
      fechaInicio: '2026-01-01T00:00:00.000Z',
      woocommerceSubscriptionId: null,
    },
  ],
  consumibles: [],
  labels: [
    {
      labelId: 'label-1',
      label: {
        id: 'label-1',
        key: 'cohorte',
        value: `septiembre-${'valor-largo'.repeat(12)}`,
      },
    },
  ],
};

test.describe('Admin — ficha de usuario', () => {
  test('mantiene la ficha utilizable en móvil con colecciones grandes', async ({
    page,
  }) => {
    const evidenceDir = process.env['ADMIN_DETAIL_EVIDENCE_DIR'];
    const displayedUser = evidenceDir
      ? {
          ...user,
          email: 'diego@test.com',
          labels: [
            {
              labelId: 'label-1',
              label: {
                id: 'label-1',
                key: 'cohorte',
                value: 'septiembre',
              },
            },
          ],
        }
      : user;
    await loginAsAdminMock(page, userAdminFixture);
    await page.route('**/user/admin/140', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(displayedUser),
      }),
    );
    await page.route('**/user/planifications/140', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          Array.from({ length: 20 }, (_, index) => ({
            planificacionId: index + 1,
            planificacion: {
              id: index + 1,
              identificador:
                index === 6 ? `PF-7-${'X'.repeat(96)}` : `PF-${index + 1}`,
              descripcion: 'Resistencia',
            },
          })),
        ),
      }),
    );
    await page.route('**/planificacion-fisica/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          Array.from({ length: 20 }, (_, id) => ({
            id,
            pruebaNombre: `Marca ${id}`,
            valor: id,
            unidad: 's',
            fecha: '2026-01-01T00:00:00Z',
            color: '#000',
          })),
        ),
      }),
    );

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/app/test/user/140');
    await expect(
      page.getByRole('heading', { name: 'Diego Sánchez' }),
    ).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText('Resumen administrativo')).toBeVisible();
    await expect(page.getByText('Según primera matrícula')).toBeVisible();
    await expect(page.getByText('PREMIUM · ACTIVE')).toBeVisible();
    await expect(
      page.getByText(
        evidenceDir ? 'cohorte: septiembre' : /^cohorte: septiembre-/,
      ),
    ).toBeVisible();
    await expect(
      page.getByText('Onboarding e información personal'),
    ).toBeVisible();
    await expect(page.getByText(/^PF-7-/)).toBeVisible();
    await expect(page.getByText('01/06/2024')).toHaveCount(0);
    await expect(page.getByText(/Asignada/i)).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Suscripciones' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Eliminar' })).toHaveCount(0);
    await page
      .getByRole('button', { name: 'Abrir acciones destructivas' })
      .click();
    await expect(page.getByText('Eliminar usuario')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByText('Marca 19').scrollIntoViewIfNeeded();
    await expect(page.getByText('Marca 19')).toBeVisible();
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);

    if (evidenceDir) {
      const heading = page.getByRole('heading', { name: 'Diego Sánchez' });
      await heading.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${evidenceDir}/despues-ficha-movil.png` });
      await page.setViewportSize({ width: 1440, height: 900 });
      await heading.scrollIntoViewIfNeeded();
      await page.screenshot({
        path: `${evidenceDir}/despues-ficha-escritorio.png`,
      });
    }
  });
});
