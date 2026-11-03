import { expect, test, type Locator, type Page } from '@playwright/test';
import userAdminFixture from './fixtures/user-admin.json';
import { loginAsRoleMock } from './helpers/auth.helper';

const madrid = {
  codigo: 'PCMI6-8H',
  oposicion: 'MADRID',
  nivel: 'INICIACION',
  franja: 'FRANJA_SEIS_A_OCHO_HORAS',
  planificacionId: 42,
  publicadaId: 42,
  publicada: { identificador: 'MADRID-6-8', version: 4 },
  primeraSemana: '2026-09-07',
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

const previewSemanas = {
  puedeAplicar: true,
  previewHash: 'a'.repeat(64),
  requiereConfirmacion: false,
  warnings: [
    {
      hoja: 'CMI6-8',
      semana: 37,
      mensaje: 'Se copiaron metadatos de la pestaña.',
    },
  ],
  variantes: [madrid],
};

const resultadoPublicacion = {
  cargaId: 9,
  estado: 'PUBLICADA',
  variantes: [{ codigo: 'PCMI6-8H', planificacionId: 42 }],
  semanas: [
    {
      codigo: 'PCMI6-8H',
      hoja: 'CMI6-8',
      semana: 37,
      lunes: '2026-09-07',
      creados: 2,
      actualizados: 0,
      omitidos: 0,
      eliminados: 0,
      bloques: [],
    },
  ],
  warnings: [],
  mensaje:
    'Semanas publicadas en las planificaciones existentes. Se conservaron sus identificadores y el progreso de los alumnos.',
};

const cargaPendiente = {
  id: 9,
  fileName: 'semanas-qa.xlsx',
  createdAt: '2026-11-03T12:00:00Z',
  preview: { ...previewSemanas, cargaId: 9 },
  variantes: [{ codigo: 'PCMI6-8H', planificacionMensualId: 42 }],
};

const previewErrorSemanas = {
  fileName: 'semanas-qa.xlsx',
  fileHash: 'f'.repeat(64),
  puedeAplicar: false,
  yaAplicado: false,
  requiereConfirmacionSobrescritura: false,
  sobrescrituras: [],
  totales: {
    hojas: 1,
    semanas: 0,
    bloques: 0,
    entrenamientos: 0,
    errores: 1,
  },
  hojas: [
    {
      hoja: 'CMI6-8',
      valida: false,
      totalBloques: 0,
      totalEntrenamientos: 0,
      semanas: [],
      errores: [
        {
          hoja: 'CMI6-8',
          semana: 37,
          dia: 'Lunes',
          filaExcel: 12,
          celdas: ['A12', 'C12'],
          campo: 'fecha',
          mensaje: 'La fecha no es válida.',
        },
      ],
      warnings: [],
    },
  ],
};

async function prepararAdmin(
  page: Page,
  opciones: {
    fallosPublicacion?: number;
    errorPublicacion?: 409 | 422;
  } = {},
) {
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
      body: JSON.stringify(previewSemanas),
    }),
  );
  let preparaciones = 0;
  let publicaciones = 0;
  let publicada = false;
  await page.route('**/importaciones/plantillas/pendiente', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(preparaciones && !publicada ? [cargaPendiente] : []),
    }),
  );
  await page.route(
    '**/importaciones/plantillas/pendiente/preparar',
    (route) => {
      preparaciones++;
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ ...previewSemanas, cargaId: 9 }),
      });
    },
  );
  await page.route(
    '**/importaciones/plantillas/pendiente/*/publicar',
    (route) => {
      publicaciones++;
      if (opciones.errorPublicacion && publicaciones === 1) {
        return route.fulfill({
          status: opciones.errorPublicacion,
          contentType: 'application/json',
          body: JSON.stringify(
            opciones.errorPublicacion === 409
              ? {
                  code: 'CARGA_PREVIEW_STALE',
                  message: 'El plan cambió; previsualiza de nuevo.',
                }
              : {
                  code: 'CARGA_EXCEL_INVALIDO',
                  message: 'Corrige los errores localizados del Excel.',
                  preview: previewErrorSemanas,
                },
          ),
        });
      }
      if (publicaciones <= (opciones.fallosPublicacion ?? 0)) {
        return route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'La publicación no respondió.' }),
        });
      }
      publicada = true;
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(resultadoPublicacion),
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
  return {
    preparaciones: () => preparaciones,
    publicaciones: () => publicaciones,
  };
}

async function subirExcel(page: Page) {
  await page
    .locator('input[aria-label="Archivo Excel con semanas"]')
    .setInputFiles({
      name: 'semanas-qa.xlsx',
      mimeType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from('excel-fixture'),
    });
  const dialogo = page.getByRole('dialog', { name: 'Importar semanas' });
  await expect(dialogo).toContainText(
    'Revisa las fechas y pulsa «Importar semanas».',
  );
  await expect(
    dialogo.getByRole('button', { name: 'Importar semanas' }),
  ).toBeVisible();
  await expect(dialogo.getByText('Año 2026').first()).toBeVisible();
  await expect(dialogo.getByText('Semana 37').first()).toBeVisible();
  await expect(dialogo.getByText('07/09/2026').first()).toBeVisible();
  await expect(dialogo.getByText('Destino: MADRID-6-8 v4')).toBeVisible();
  await expect(
    dialogo.getByRole('button', { name: 'Previsualizar cambios' }),
  ).toHaveCount(0);
  await expect(
    dialogo.getByRole('button', { name: 'Guardar cambios pendientes' }),
  ).toHaveCount(0);
  return dialogo;
}

async function comprobarSinOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
  ).toBe(false);
}

/**
 * Las capturas deben mostrar solo el importador. El login mockeado deja a
 * veces toasts de peticiones abortadas por la navegación, ajenos a esta
 * pantalla; se retiran del DOM justo antes de capturar sin alterar el flujo.
 */
async function capturarDialogo(
  page: Page,
  dialogo: Locator,
  path: string,
): Promise<void> {
  await page.evaluate(() =>
    document
      .querySelectorAll('.toast-container')
      .forEach((elemento) => elemento.remove()),
  );
  await dialogo.screenshot({ path });
}

for (const viewport of [
  { name: 'escritorio 1440', width: 1440, height: 900 },
  { name: 'móvil 390', width: 390, height: 844 },
]) {
  test(`un Excel se revisa e importa con una sola acción en ${viewport.name}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    const api = await prepararAdmin(page);
    const dialogo = await subirExcel(page);

    const avisos = dialogo.locator('details.carga-directa__avisos');
    await expect(avisos.locator('summary')).toContainText(
      'Avisos del Excel (1)',
    );
    expect(
      await avisos.evaluate(
        (elemento) => (elemento as HTMLDetailsElement).open,
      ),
    ).toBe(false);
    expect(api.preparaciones()).toBe(0);
    expect(api.publicaciones()).toBe(0);
    await comprobarSinOverflow(page);
    await capturarDialogo(
      page,
      dialogo,
      testInfo.outputPath(`importar-preview-${viewport.width}.png`),
    );

    await dialogo.getByRole('button', { name: 'Importar semanas' }).click();
    await expect.poll(api.preparaciones).toBe(1);
    await expect.poll(api.publicaciones).toBe(1);
    await expect(dialogo.getByText('Excel importado')).toBeVisible();
    await expect(
      dialogo.getByRole('button', { name: 'Descartar resumen' }),
    ).toHaveCount(0);
    await expect(dialogo).toContainText('Comunidad de Madrid');
    await expect(dialogo).toContainText('Año 2026');
    await expect(dialogo).toContainText('Semana 37 · 07/09/2026');
    const enlace = dialogo.getByRole('link', {
      name: 'Ver semana importada',
    });
    await expect(enlace).toHaveAttribute(
      'href',
      /\/app\/planificacion\/planificacion-mensual\/42\?fechaFoco=2026-09-07$/,
    );
    const detalle = dialogo.locator('details.carga-directa__detalle');
    await expect(detalle.locator('summary')).toContainText('Ver detalles');
    expect(
      await detalle.evaluate(
        (elemento) => (elemento as HTMLDetailsElement).open,
      ),
    ).toBe(false);
    await expect(
      dialogo.getByRole('button', { name: 'Previsualizar cambios' }),
    ).toHaveCount(0);
    await expect(
      dialogo.getByRole('button', { name: 'Guardar cambios pendientes' }),
    ).toHaveCount(0);
    await comprobarSinOverflow(page);
    await capturarDialogo(
      page,
      dialogo,
      testInfo.outputPath(`importar-exito-${viewport.width}.png`),
    );

    await dialogo.locator('.p-dialog-header-close').click();
    await expect(page).toHaveURL(
      /\/app\/planificacion\/planificacion-mensual$/,
    );
    await page
      .getByRole('button', { name: 'Importar o publicar semanas' })
      .click();
    const dialogoReabierto = page.getByRole('dialog', {
      name: 'Importar semanas',
    });
    await expect(dialogoReabierto.getByText('Excel importado')).toBeVisible();
    await expect(dialogoReabierto).toContainText('Semana 37 · 07/09/2026');
    expect(api.preparaciones()).toBe(1);
    expect(api.publicaciones()).toBe(1);
  });

  test(`si publicar falla, el reintento no prepara otra carga en ${viewport.name}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    const api = await prepararAdmin(page, { fallosPublicacion: 1 });
    const dialogo = await subirExcel(page);

    await dialogo.getByRole('button', { name: 'Importar semanas' }).click();
    await expect.poll(api.preparaciones).toBe(1);
    await expect.poll(api.publicaciones).toBe(1);
    await expect(dialogo.getByText('Excel importado')).toHaveCount(0);
    await expect(dialogo.getByText('Importación sin terminar')).toBeVisible();
    await expect(dialogo).toContainText('La publicación no respondió.');
    await comprobarSinOverflow(page);
    await capturarDialogo(
      page,
      dialogo,
      testInfo.outputPath(`importar-publicacion-fallida-${viewport.width}.png`),
    );

    await dialogo
      .getByRole('button', { name: 'Continuar importación' })
      .click();
    await expect.poll(api.publicaciones).toBe(2);
    expect(api.preparaciones()).toBe(1);
    await expect(dialogo.getByText('Excel importado')).toBeVisible();
    await expect(dialogo).toContainText('Semana 37 · 07/09/2026');
    await comprobarSinOverflow(page);
    await capturarDialogo(
      page,
      dialogo,
      testInfo.outputPath(`importar-reintento-${viewport.width}.png`),
    );
  });

  test(`un Excel inválido bloquea la importación con celdas localizadas en ${viewport.name}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    const api = await prepararAdmin(page);
    await page.route('**/importaciones/plantillas/pendiente/preview', (route) =>
      route.fulfill({
        status: 422,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 'CARGA_EXCEL_INVALIDO',
          message: 'Corrige los errores localizados del Excel.',
          preview: {
            fileName: 'semanas-qa.xlsx',
            fileHash: 'f'.repeat(64),
            puedeAplicar: false,
            yaAplicado: false,
            requiereConfirmacionSobrescritura: false,
            sobrescrituras: [],
            totales: {
              hojas: 1,
              semanas: 0,
              bloques: 0,
              entrenamientos: 0,
              errores: 1,
            },
            hojas: [
              {
                hoja: 'CMI6-8',
                valida: false,
                totalBloques: 0,
                totalEntrenamientos: 0,
                semanas: [],
                errores: [
                  {
                    hoja: 'CMI6-8',
                    semana: 37,
                    dia: 'Lunes',
                    filaExcel: 12,
                    celdas: ['A12', 'C12'],
                    campo: 'fecha',
                    mensaje: 'La fecha no es válida.',
                  },
                ],
                warnings: [
                  {
                    hoja: 'CMI6-8',
                    semana: 37,
                    mensaje: 'Se copiaron metadatos de la pestaña.',
                  },
                ],
              },
            ],
          },
        }),
      }),
    );
    const dialogo = await subirExcelInvalido(page);

    await expect(dialogo).toContainText(
      'Corrige estos errores del Excel. No se ha importado nada.',
    );
    await expect(dialogo).toContainText('Fila 12');
    await expect(dialogo).toContainText('Celdas A12, C12');
    await expect(dialogo).toContainText('La fecha no es válida.');
    await expect(
      dialogo.getByRole('button', { name: 'Importar semanas' }),
    ).toHaveCount(0);
    const avisos = dialogo.locator('details.carga-directa__avisos');
    await expect(avisos.locator('summary')).toContainText(
      'Avisos del Excel (1)',
    );
    expect(
      await avisos.evaluate(
        (elemento) => (elemento as HTMLDetailsElement).open,
      ),
    ).toBe(false);
    expect(api.preparaciones()).toBe(0);
    expect(api.publicaciones()).toBe(0);
    await comprobarSinOverflow(page);
    await capturarDialogo(
      page,
      dialogo,
      testInfo.outputPath(`importar-invalido-${viewport.width}.png`),
    );
  });
}

for (const caso of [
  { status: 409 as const, nombre: '409' },
  { status: 422 as const, nombre: '422 con celdas' },
]) {
  for (const viewport of [
    { name: 'escritorio 1440', width: 1440, height: 900 },
    { name: 'móvil 390', width: 390, height: 844 },
  ]) {
    test(`una publicación terminal ${caso.nombre} solo permite descartar en ${viewport.name}`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      const api = await prepararAdmin(page, {
        errorPublicacion: caso.status,
      });
      const dialogo = await subirExcel(page);

      await dialogo.getByRole('button', { name: 'Importar semanas' }).click();
      await expect.poll(api.preparaciones).toBe(1);
      await expect.poll(api.publicaciones).toBe(1);
      await expect(dialogo.getByText('Excel importado')).toHaveCount(0);
      await expect(dialogo.getByText('Importación sin terminar')).toBeVisible();
      await expect(dialogo).toContainText('semanas-qa.xlsx');
      await expect(dialogo).toContainText(
        'Comunidad de Madrid · Iniciación · 6-8 horas',
      );
      await expect(dialogo).toContainText('07/09/2026');
      await expect(dialogo).toContainText('Descarta esta importación');
      await expect(
        dialogo.getByRole('button', { name: 'Continuar importación' }),
      ).toHaveCount(0);
      await expect(
        dialogo.getByRole('button', { name: 'Descartar' }),
      ).toBeVisible();
      if (caso.status === 422) {
        await expect(dialogo).toContainText('Fila 12');
        await expect(dialogo).toContainText('Celdas A12, C12');
        await expect(dialogo).toContainText('La fecha no es válida.');
      }
      await comprobarSinOverflow(page);
      await capturarDialogo(
        page,
        dialogo,
        testInfo.outputPath(
          `importar-terminal-${caso.status}-${viewport.width}.png`,
        ),
      );

      await dialogo.locator('.p-dialog-header-close').click();
      await expect(page).toHaveURL(
        /\/app\/planificacion\/planificacion-mensual$/,
      );
      await page
        .getByRole('button', { name: 'Importar o publicar semanas' })
        .click();
      const dialogoReabierto = page.getByRole('dialog', {
        name: 'Importar semanas',
      });
      await expect(
        dialogoReabierto.getByText('Importación sin terminar'),
      ).toBeVisible();
      await expect(dialogoReabierto).toContainText('07/09/2026');
      await expect(dialogoReabierto).toContainText('Descarta esta importación');
      await expect(
        dialogoReabierto.getByRole('button', { name: 'Continuar importación' }),
      ).toHaveCount(0);
      await expect(
        dialogoReabierto.getByRole('button', { name: 'Descartar' }),
      ).toBeVisible();
      expect(api.preparaciones()).toBe(1);
      expect(api.publicaciones()).toBe(1);
      await comprobarSinOverflow(page);
    });
  }
}

async function subirExcelInvalido(page: Page) {
  await page
    .locator('input[aria-label="Archivo Excel con semanas"]')
    .setInputFiles({
      name: 'semanas-qa.xlsx',
      mimeType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from('excel-invalido'),
    });
  const dialogo = page.getByRole('dialog', { name: 'Importar semanas' });
  await expect(dialogo).toContainText(
    'Corrige estos errores del Excel. No se ha importado nada.',
  );
  return dialogo;
}
