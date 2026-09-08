import { expect, test } from '@playwright/test';
import userAdminFixture from './fixtures/user-admin.json';
import { loginAsRoleMock } from './helpers/auth.helper';

const preview = {
  fileName: 'madrid-septiembre.xlsx',
  fileHash: 'a'.repeat(64),
  puedeAplicar: true,
  yaAplicado: false,
  requiereConfirmacionSobrescritura: true,
  sobrescrituras: ['S372026CMI6-8H'],
  totales: {
    hojas: 1,
    semanas: 2,
    bloques: 14,
    entrenamientos: 2,
    errores: 0,
  },
  hojas: [
    {
      hoja: 'CMI6-8',
      valida: true,
      totalBloques: 14,
      totalEntrenamientos: 2,
      semanas: [
        {
          numero: 37,
          fechaInicio: '2026-09-07',
          bloques: 7,
          entrenamientos: 1,
          esqueleto: false,
        },
        {
          numero: 38,
          fechaInicio: '2026-09-14',
          bloques: 7,
          entrenamientos: 1,
          esqueleto: false,
        },
      ],
      errores: [],
      warnings: [],
    },
  ],
};

test('admin previsualiza y confirma una importación sin escrituras implícitas', async ({
  page,
}) => {
  let previewCalls = 0;
  let applyBody = '';

  await page.route('**/planificaciones/admin/variantes', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
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
        data: [],
        pagination: { skip: 0, take: 9999, count: 0 },
      }),
    }),
  );
  await page.route(
    '**/planificaciones/admin/importaciones/plantillas/preview',
    (route) => {
      previewCalls++;
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(preview),
      });
    },
  );
  await page.route(
    '**/planificaciones/admin/importaciones/plantillas/apply',
    (route) => {
      applyBody = route.request().postData() ?? '';
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ yaAplicado: false, version: 4, hojas: [] }),
      });
    },
  );

  await loginAsRoleMock(page, {
    rol: 'ADMIN',
    email: 'admin@test.com',
    userFixture: userAdminFixture,
    modulos: { PLANIFICACION_AUTOASIGNACION: true },
  });
  await page.goto('/app/planificacion/admin-planificacion');
  await page.getByRole('tab', { name: 'Importar plantillas' }).click();

  await page.getByTestId('importacion-plantillas-file').setInputFiles({
    name: 'madrid-septiembre.xlsx',
    mimeType:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from('excel-fixture'),
  });
  await page.getByTestId('importacion-plantillas-preview').click();

  await expect.poll(() => previewCalls).toBe(1);
  await expect(page.getByTestId('importacion-plantillas-panel')).toContainText(
    '14/09/2026',
  );
  await expect(page.getByText('14 totales')).toBeVisible();
  const apply = page.getByRole('button', { name: 'Aplicar importación' });
  await expect(apply).toBeDisabled();

  await page.getByText('Confirmo la sobrescritura').click();
  await expect(apply).toBeEnabled();

  const screenshotPath = process.env['PLAN_IMPORT_SCREENSHOT_PATH'];
  if (screenshotPath) {
    await expect(
      page.getByText('Previsualización validada; aún no se ha escrito nada'),
    ).toBeHidden({ timeout: 6_000 });
    await page.screenshot({ path: screenshotPath, fullPage: true });
  }

  await apply.click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toContainText(
    'Se reemplazarán plantillas existentes (1)',
  );
  await expect(applyBody).toBe('');
  await dialog.getByRole('button', { name: 'Reemplazar plantillas' }).click();

  await expect.poll(() => applyBody).toContain('a'.repeat(64));
  expect(applyBody).toContain('true');
  await expect(
    page.getByText('Importación aplicada como versión 4'),
  ).toBeVisible();
});
