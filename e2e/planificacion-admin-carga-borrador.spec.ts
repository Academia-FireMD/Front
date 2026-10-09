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
  await page.route('**/importaciones/plantillas/pendiente/preview', (route) =>
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
  let publishCalls = 0;
  await page.route('**/importaciones/plantillas/pendiente', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        applyCalls
          ? [
              {
                id: 9,
                fileName: 'semanas-qa.xlsx',
                variantes,
                preview: { variantes },
              },
            ]
          : [],
      ),
    }),
  );
  await page.route(
    '**/importaciones/plantillas/pendiente/*/publicar',
    (route) => {
      publishCalls++;
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: '{}',
      });
    },
  );
  await page.route(
    '**/importaciones/plantillas/pendiente/preparar',
    (route) => {
      applyCalls++;
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          cargaId: 9,
          variantes: variantes.map((variante, index) => ({
            ...variante,
            planificacionId: 42 + index,
            primeraSemana: '2026-09-07',
          })),
        }),
      });
    },
  );
  await loginAsRoleMock(page, {
    rol: 'ADMIN',
    email: 'admin@test.com',
    userFixture: userAdminFixture,
    modulos: { PLANIFICACION_AUTOASIGNACION: true },
  });
  await page.goto('/app/planificacion/planificacion-mensual');
  await page
    .getByRole('button', { name: 'Importar o publicar semanas' })
    .click();
  await expect(
    page.getByRole('dialog', { name: 'Importar semanas' }),
  ).toBeVisible();
  return { preparaciones: () => applyCalls, publicaciones: () => publishCalls };
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
  await page
    .getByText(/Ver cambios de 1 semana/)
    .first()
    .click();
  await expect(page.getByText('Semana 37').first()).toBeVisible();
  await expect(page.getByText(/todavía no se ha guardado nada/)).toBeVisible();
}

for (const viewport of [
  { name: 'escritorio', width: 1280, height: 800 },
  { name: 'móvil 375 px', width: 375, height: 667 },
]) {
  test(`Excel se guarda pendiente de publicación en ${viewport.name}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    const api = await prepararAdmin(page);
    await subirYPrevisualizar(page);
    const dialogo = page.getByRole('dialog', { name: 'Importar semanas' });
    await expect(dialogo).toBeVisible();
    await dialogo.screenshot({
      path: testInfo.outputPath(`importar-semanas-${viewport.width}.png`),
    });
    expect(api.preparaciones()).toBe(0);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflow).toBe(false);
    await page
      .getByRole('button', { name: 'Guardar cambios pendientes' })
      .click();
    await expect.poll(api.preparaciones).toBe(1);
    await expect(page).toHaveURL(/admin-planificacion\?importar=1/);
    await expect(dialogo.getByText('Excel preparado')).toBeVisible();
    await expect(
      dialogo.getByRole('button', { name: 'Publicar cambios ahora' }),
    ).toBeVisible();
    expect(api.publicaciones()).toBe(0);
  });
}

for (const viewport of [
  { name: 'escritorio', width: 1280, height: 800 },
  { name: 'móvil 375 px', width: 375, height: 667 },
]) {
  test(`texto libre se confirma como independiente en ${viewport.name}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    const api = await prepararAdmin(page);
    await page.route('**/importaciones/plantillas/pendiente/preview', (route) =>
      route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          puedeAplicar: true,
          previewHash: 'a'.repeat(64),
          requiereConfirmacion: true,
          independientes: [
            {
              hoja: 'GI6-8',
              semana: 7,
              dia: 'Lunes',
              filaExcel: 7,
              tema: 'Tráfico',
            },
          ],
          variantes: [madrid],
        }),
      }),
    );
    await subirYPrevisualizar(page);
    const dialogo = page.getByRole('dialog', { name: 'Importar semanas' });
    await expect(dialogo.getByText('Tráfico')).toBeVisible();
    await expect(dialogo.getByText(/sin vínculo al catálogo/)).toBeVisible();
    await expect(
      dialogo.getByRole('button', { name: 'Guardar cambios pendientes' }),
    ).toBeDisabled();
    expect(api.preparaciones()).toBe(0);
    await dialogo.getByText('Tráfico').scrollIntoViewIfNeeded();
    await dialogo.screenshot({
      path: testInfo.outputPath(
        `subbloque-independiente-${viewport.width}.png`,
      ),
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
    ).toBe(false);
    await dialogo.locator('label[for="confirmar-cambios-carga"]').click();
    await expect(
      dialogo.getByRole('button', { name: 'Guardar cambios pendientes' }),
    ).toBeEnabled();
    await dialogo
      .getByRole('button', { name: 'Guardar cambios pendientes' })
      .click();
    await expect.poll(api.preparaciones).toBe(1);
    expect(api.publicaciones()).toBe(0);
  });
}

test('un Excel con varias oposiciones conserva todos los perfiles pendientes sin publicar', async ({
  page,
}) => {
  const general = {
    ...madrid,
    codigo: 'PGCVI6-8H',
    oposicion: 'GENERAL',
    destino: { tipo: 'CREAR', identificador: 'Importación PGCVI6-8H' },
  };
  const api = await prepararAdmin(page, [madrid, general]);
  await subirYPrevisualizar(page);
  await page
    .getByRole('button', { name: 'Guardar cambios pendientes' })
    .click();
  await expect.poll(api.preparaciones).toBe(1);
  const pendientes = page.getByRole('region', { name: 'Cambios pendientes' });
  await expect(pendientes).toContainText('2 perfiles');
  await expect(pendientes).toContainText('semanas-qa.xlsx');
  await expect(
    pendientes.getByRole('button', { name: /Publicar cambios$/ }),
  ).toBeVisible();
  expect(api.publicaciones()).toBe(0);
  await expect(page).toHaveURL(/admin-planificacion\?importar=1/);
});

test('el asistente se puede cerrar sin guardar', async ({ page }) => {
  const api = await prepararAdmin(page);
  await expect(
    page.getByRole('dialog', { name: 'Importar semanas' }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('dialog', { name: 'Importar semanas' }),
  ).toBeHidden();
  expect(api.preparaciones()).toBe(0);
  expect(api.publicaciones()).toBe(0);
});

test('el asistente permanece abierto mientras guarda semanas', async ({
  page,
}) => {
  await prepararAdmin(page);
  await subirYPrevisualizar(page);
  let liberarAplicacion!: () => void;
  const aplicacionPendiente = new Promise<void>((resolve) => {
    liberarAplicacion = resolve;
  });
  await page.route(
    '**/importaciones/plantillas/pendiente/preparar',
    async (route) => {
      await aplicacionPendiente;
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ variantes: [] }),
      });
    },
  );
  const dialogo = page.getByRole('dialog', { name: 'Importar semanas' });
  const solicitud = page.waitForRequest(
    '**/importaciones/plantillas/pendiente/preparar',
  );
  await dialogo
    .getByRole('button', { name: 'Guardar cambios pendientes' })
    .click();
  await solicitud;
  try {
    await expect(dialogo.locator('input[type="file"]')).toBeDisabled();
    await expect(dialogo.locator('.p-dialog-header-close')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(dialogo).toBeVisible();
  } finally {
    liberarAplicacion();
  }
});
