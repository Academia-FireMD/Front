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
      variante: {
        codigo: 'PCMI6-8H',
        oposicion: 'MADRID',
        nivel: 'INICIACION',
        franja: 'FRANJA_SEIS_A_OCHO_HORAS',
      },
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
  const mobilePreview = process.env['PLAN_IMPORT_MOBILE'] === 'true';
  if (mobilePreview) {
    await page.setViewportSize({ width: 375, height: 667 });
  }

  let previewCalls = 0;
  let applyBody = '';

  await page.route('**/planificaciones/admin/variantes', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 7,
          codigo: 'PCMI6-8H',
          oposicion: 'MADRID',
          nivel: 'INICIACION',
          franja: 'FRANJA_SEIS_A_OCHO_HORAS',
          activa: true,
          planificacionMensual: null,
        },
      ]),
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
        data: [
          {
            id: 17,
            identificador: 'MADRID-ANUAL',
            mes: 9,
            ano: 2026,
            estado: 'BORRADOR',
            relevancia: ['MADRID'],
            tipoDePlanificacion: 'FRANJA_SEIS_A_OCHO_HORAS',
          },
        ],
        pagination: { skip: 0, take: 9999, count: 1 },
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
  if (mobilePreview) {
    await expect(
      page.getByTestId('importacion-plantillas-panel'),
    ).toContainText(/Bloques\s*14/i);
  } else {
    await expect(page.getByText('14 totales')).toBeVisible();
  }
  await expect(page.getByTestId('importacion-plantillas-panel')).toContainText(
    'Iniciación · 6-8 horas',
  );
  await expect(
    page.getByTestId('importacion-plantillas-panel'),
  ).not.toContainText('FRANJA_SEIS_A_OCHO_HORAS');
  await expect(
    page.getByTestId('importacion-plantillas-panel'),
  ).not.toContainText('INICIACION');
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
  await expect(page.getByTestId('importacion-incorporar-cta')).toContainText(
    'Aún no están incorporadas',
  );
  await expect(page.getByTestId('importacion-incorporar-cta')).toContainText(
    'Comunidad de Madrid · Iniciación · 6-8 horas',
  );
  await expect(
    page.getByRole('button', {
      name: 'Abrir borrador y previsualizar',
    }),
  ).toBeEnabled();
  await page
    .getByRole('button', { name: 'Abrir borrador y previsualizar' })
    .click();
  await expect(page).toHaveURL(/fechaFoco=2026-09-07/);
});

async function abrirSeleccionDeBorrador(
  page: import('@playwright/test').Page,
  borradores: object[],
) {
  await page.route('**/planificaciones/admin/variantes', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 7,
          codigo: 'PCMI6-8H',
          oposicion: 'MADRID',
          nivel: 'INICIACION',
          franja: 'FRANJA_SEIS_A_OCHO_HORAS',
          activa: true,
        },
      ]),
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
        data: borradores,
        pagination: { skip: 0, take: 9999, count: borradores.length },
      }),
    }),
  );
  await loginAsRoleMock(page, {
    rol: 'ADMIN',
    email: 'admin@test.com',
    userFixture: userAdminFixture,
    modulos: { PLANIFICACION_AUTOASIGNACION: true },
  });
  await page.goto(
    '/app/planificacion/admin-planificacion?codigosHoja=CMI6-8H&paso=destino',
  );
  await expect(page.getByTestId('importacion-incorporar-cta')).toBeVisible();
  const pasos = page.locator('.import-steps__item');
  await expect(pasos.nth(1)).toHaveAttribute('aria-current', 'step');
  await expect(pasos.nth(0)).not.toHaveAttribute('aria-current', 'step');
}

test('sin borradores compatibles ofrece creación guiada también en móvil', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await abrirSeleccionDeBorrador(page, []);
  await expect(page.getByTestId('importacion-incorporar-cta')).toContainText(
    'Comunidad de Madrid · Iniciación · 6-8 horas',
  );
  await expect(
    page.getByRole('button', { name: 'Abrir borrador y previsualizar' }),
  ).toHaveCount(0);

  await page
    .getByRole('button', { name: 'Crear planificación en borrador' })
    .click();
  await expect(page).toHaveURL(/planificacion-mensual\/new/);
  await expect(page.locator('#planificacion-descripcion')).toBeVisible();
  await expect(page.locator('#planificacion-identificador')).toBeVisible();
  await expect(page.getByText('Paso 2 · Crear borrador')).toBeVisible();
  await expect(page.locator('p-speeddial')).toHaveCount(0);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);

  const formControls = [
    page.locator('#planificacion-identificador'),
    page.locator('#planificacion-descripcion'),
    page.locator('.monthly-admin-controls .p-dropdown'),
    page.locator('#planificacion-oposiciones'),
    page.getByRole('button', { name: 'Cancelar creación' }),
    page.getByRole('button', { name: 'Guardar borrador y previsualizar' }),
  ];
  const reference = await formControls[0].boundingBox();
  expect(reference).not.toBeNull();
  for (const control of formControls.slice(1)) {
    const box = await control.boundingBox();
    expect(box).not.toBeNull();
    expect(Math.abs(box!.x - reference!.x)).toBeLessThanOrEqual(2);
    expect(Math.abs(box!.width - reference!.width)).toBeLessThanOrEqual(2);
    expect(box!.height).toBeGreaterThanOrEqual(40);
  }
  const duracionMobile = await page
    .locator('.monthly-admin-controls .duracion')
    .boundingBox();
  const oposicionesMobile = await page
    .locator('.monthly-admin-controls .relevancia')
    .boundingBox();
  expect(duracionMobile).not.toBeNull();
  expect(oposicionesMobile).not.toBeNull();
  expect(
    oposicionesMobile!.y - (duracionMobile!.y + duracionMobile!.height),
  ).toBeLessThanOrEqual(24);

  const screenshotPath = process.env['PLAN_GUIDED_MOBILE_SCREENSHOT_PATH'];
  if (screenshotPath) {
    await page.screenshot({ path: screenshotPath });
  }

  const desktopScreenshotPath =
    process.env['PLAN_GUIDED_DESKTOP_SCREENSHOT_PATH'];
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.locator('.header--admin').scrollIntoViewIfNeeded();
  const duracionDesktop = await page
    .locator('.monthly-admin-controls .duracion')
    .boundingBox();
  const oposicionesDesktop = await page
    .locator('.monthly-admin-controls .relevancia')
    .boundingBox();
  expect(duracionDesktop).not.toBeNull();
  expect(oposicionesDesktop).not.toBeNull();
  expect(
    Math.abs(duracionDesktop!.y - oposicionesDesktop!.y),
  ).toBeLessThanOrEqual(2);
  if (desktopScreenshotPath) {
    await page.screenshot({ path: desktopScreenshotPath });
  }
});

test('con varios borradores exige elegir uno antes de abrir la previsualización', async ({
  page,
}) => {
  const base = {
    mes: 9,
    ano: 2026,
    estado: 'BORRADOR',
    relevancia: ['MADRID'],
    tipoDePlanificacion: 'FRANJA_SEIS_A_OCHO_HORAS',
  };
  await abrirSeleccionDeBorrador(page, [
    { ...base, id: 17, identificador: 'MADRID-1' },
    { ...base, id: 18, identificador: 'MADRID-2' },
  ]);

  const abrir = page.getByRole('button', {
    name: 'Abrir borrador y previsualizar',
  });
  await expect(abrir).toBeDisabled();
  await expect(page.getByTestId('importacion-incorporar-cta')).toContainText(
    'Hay varios borradores compatibles',
  );
  await page.locator('#planificacion-destino-importacion').click();
  await page.getByRole('option', { name: /MADRID-2/ }).click();
  await expect(abrir).toBeEnabled();
});
