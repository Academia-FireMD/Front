import { expect, test, type Page } from '@playwright/test';
import userAdminFixture from './fixtures/user-admin.json';
import { loginAsRoleMock } from './helpers/auth.helper';

const madrid = {
  codigo: 'PCMI6-8H',
  oposicion: 'MADRID',
  nivel: 'INICIACION',
  franja: 'FRANJA_SEIS_A_OCHO_HORAS',
  publicadaId: null,
  candidatos: [],
  destino: { tipo: 'CREAR', identificador: 'Importación PCMI6-8H' },
  semanas: [
    {
      hoja: 'CMI6-8',
      numero: 37,
      lunes: '2026-09-07',
      creados: 2,
      actualizados: 0,
      eliminados: 0,
      omitidos: 0,
      bloques: [],
    },
  ],
};

async function prepararAdmin(page: Page, variantes = [madrid]) {
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
  await page.route('**/carga-borrador/preview', (route) =>
    route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        puedeAplicar: true,
        previewHash: 'a'.repeat(64),
        requiereConfirmacion: false,
        variantes,
      }),
    }),
  );
  let applyCalls = 0;
  await page.route('**/carga-borrador/apply', (route) => {
    applyCalls++;
    return route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        variantes: variantes.map((variante, index) => ({
          ...variante,
          planificacionId: 42 + index,
          primeraSemana: '2026-09-07',
        })),
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
  await page.getByRole('tab', { name: 'Cargar semanas' }).click();
  return () => applyCalls;
}

async function subirYPrevisualizar(page: Page) {
  await page
    .locator('input[aria-label="Archivo Excel con semanas"]')
    .setInputFiles({
      name: 'semanas-qa.xlsx',
      mimeType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from('excel-fixture'),
    });
  await page.getByRole('button', { name: 'Previsualizar cambios' }).click();
  await expect(page.getByText('Semana 37').first()).toBeVisible();
  await expect(
    page.getByText('Los alumnos no verán estos cambios'),
  ).toBeVisible();
}

for (const viewport of [
  { name: 'escritorio', width: 1280, height: 800 },
  { name: 'móvil 375 px', width: 375, height: 667 },
]) {
  test(`Excel a calendario de borrador en ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    const aplicarLlamadas = await prepararAdmin(page);
    await subirYPrevisualizar(page);
    expect(aplicarLlamadas()).toBe(0);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflow).toBe(false);
    await page
      .getByRole('button', { name: 'Guardar semanas en borrador' })
      .click();
    await expect.poll(aplicarLlamadas).toBe(1);
    await expect(page).toHaveURL(
      /planificacion-mensual\/42\?fechaFoco=2026-09-07/,
    );
  });
}

test('un Excel con varias oposiciones muestra un enlace a cada borrador', async ({
  page,
}) => {
  const general = {
    ...madrid,
    codigo: 'PGCVI6-8H',
    oposicion: 'GENERAL',
    destino: { tipo: 'CREAR', identificador: 'Importación PGCVI6-8H' },
  };
  const aplicarLlamadas = await prepararAdmin(page, [madrid, general]);
  await subirYPrevisualizar(page);
  await page
    .getByRole('button', { name: 'Guardar semanas en borrador' })
    .click();
  await expect.poll(aplicarLlamadas).toBe(1);
  await expect(
    page.getByRole('button', { name: /Abrir calendario/ }),
  ).toHaveCount(2);
  await expect(page).toHaveURL(/admin-planificacion/);
});
