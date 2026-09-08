import { expect, test } from '@playwright/test';
import userAdminFixture from './fixtures/user-admin.json';
import { loginAsRoleMock } from './helpers/auth.helper';

const variante = {
  id: 7,
  codigo: 'GA4-6',
  oposicion: 'GENERAL',
  nivel: 'AVANZADO',
  franja: 'FRANJA_CUATRO_A_SEIS_HORAS',
  activa: true,
  planificacionMensualId: 17,
  planificacionMensual: {
    id: 17,
    identificador: 'GENERAL-AGOSTO',
    mes: 8,
    ano: 2026,
    estado: 'PUBLICADA',
    version: 1,
  },
};

const borrador = {
  id: 18,
  identificador: 'GENERAL-SEPTIEMBRE',
  mes: 9,
  ano: 2026,
  estado: 'BORRADOR',
  version: 2,
  tipoDePlanificacion: 'FRANJA_CUATRO_A_SEIS_HORAS',
  relevancia: ['GENERAL'],
};

test('admin publica y asigna una release mediante la acción explícita', async ({
  page,
}) => {
  let payloadPublicacion: unknown = null;
  await page.route('**/planificaciones/admin/variantes', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([variante]),
    }),
  );
  await page.route('**/planificaciones/admin/reglas', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  );
  await page.route('**/planificaciones/admin/sin-coincidencia', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  );
  await page.route('**/planificaciones/planificaciones-mensuales', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [variante.planificacionMensual, borrador],
        pagination: { skip: 0, take: 9999, count: 2 },
      }),
    }),
  );
  await page.route('**/planificaciones/admin/variantes/7/publicar', (route) => {
    payloadPublicacion = route.request().postDataJSON();
    return route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        ...variante,
        planificacionMensualId: borrador.id,
        planificacionMensual: { ...borrador, estado: 'PUBLICADA' },
      }),
    });
  });

  await loginAsRoleMock(page, {
    rol: 'ADMIN',
    email: 'admin@test.com',
    userFixture: userAdminFixture,
    modulos: { PLANIFICACION_AUTOASIGNACION: true },
  });
  await page.goto('/app/planificacion/admin-planificacion');

  await page.locator('tbody .pi-pencil').first().click();
  const releaseDropdown = page.locator('p-dropdown').nth(3);
  await releaseDropdown.click();
  await page
    .locator('.p-dropdown-panel')
    .last()
    .getByText(/GENERAL-SEPTIEMBRE v2.*BORRADOR/)
    .click();

  await expect(
    page.getByText(
      'Este borrador debe validarse y publicarse antes de asignarlo.',
    ),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Publicar y asignar' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Guardar' })).toBeDisabled();

  const screenshotPath = process.env['PLAN_RELEASE_SCREENSHOT_PATH'];
  if (screenshotPath) {
    await page.locator('.planificacion-admin-tabs').screenshot({
      path: screenshotPath,
    });
  }

  await page.getByRole('button', { name: 'Publicar y asignar' }).click();
  const confirmacion = page.getByRole('alertdialog');
  await expect(confirmacion).toContainText(
    'Los alumnos actuales conservarán su release anterior',
  );
  await confirmacion
    .getByRole('button', { name: 'Publicar y asignar' })
    .click();

  await expect
    .poll(() => payloadPublicacion)
    .toEqual({
      planificacionMensualId: 18,
    });
  await expect(
    page.getByText('Planificación publicada y asignada'),
  ).toBeVisible();
});
