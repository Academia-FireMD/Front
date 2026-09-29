import { expect, test, type Page } from '@playwright/test';
import userAdminFixture from './fixtures/user-admin.json';
import { loginAsRoleMock } from './helpers/auth.helper';

const fila = {
  id: 7,
  codigo: 'L01',
  nombreCorto: 'Temario',
  nombreDescriptivo: 'Explicación completa',
  puntosImportantes: 'Punto importante',
  color: '#b8f6fb',
  version: 1,
  activa: true,
};

async function prepararPagina(
  page: Page,
  filas = [fila],
  trabajos: Array<{
    trabajo: string;
    descripcion: string;
    version: number;
  }> = [],
) {
  let aplicaciones = 0;
  await page.route('**/planificaciones/catalogo-contenido', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ filas, trabajos }),
    }),
  );
  await page.route('**/catalogo-contenido/importar/preview', (route) =>
    route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        previewHash: 'a'.repeat(64),
        cambios: [
          {
            codigo: 'L01',
            estado: 'actualizada',
            camposCambiados: ['explicación'],
            anterior: fila,
            nueva: { ...fila, nombreDescriptivo: 'Explicación nueva' },
          },
        ],
        cambiosTrabajo: [],
        impacto: {
          usos: 0,
          bloques: 0,
          plantillas: 0,
          borradores: 0,
          publicadas: 0,
        },
        requiereConfirmacion: true,
        errores: [],
        warnings: [],
      }),
    }),
  );
  await page.route('**/catalogo-contenido/importar/apply', (route) => {
    aplicaciones++;
    return route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: '{}',
    });
  });
  await loginAsRoleMock(page, {
    rol: 'ADMIN',
    email: 'admin@test.com',
    userFixture: userAdminFixture,
  });
  await page.goto('/app/planificacion/subbloques');
  await expect(
    page.getByRole('searchbox', { name: 'Buscar subbloques' }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Subbloques' })).toHaveCount(
    0,
  );
  return () => aplicaciones;
}

for (const viewport of [
  { name: 'escritorio', width: 1280, height: 800 },
  { name: 'móvil', width: 375, height: 667 },
]) {
  test(`catálogo: indicaciones y composición visibles en ${viewport.name}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    await page.route('**/catalogo-contenido/componer', (route) =>
      route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          codigo: 'L01',
          nombre: 'Temario',
          color: '#b8f6fb',
          comentarios: '**Leer** el tema y después repasar.',
        }),
      }),
    );
    await prepararPagina(
      page,
      [fila],
      [
        { trabajo: 'ESTUDIO', descripcion: '**Leer** el tema.', version: 1 },
        { trabajo: 'R1', descripcion: 'Repasar con tarjetas.', version: 1 },
      ],
    );

    await page
      .getByRole('button', { name: 'Ver indicaciones de estudio' })
      .click();
    const indicaciones = page.getByRole('dialog', {
      name: 'Indicaciones de estudio',
    });
    await expect(indicaciones.getByText('Repasar con tarjetas.')).toBeVisible();
    await indicaciones
      .getByRole('button', { name: 'Editar indicación R1' })
      .click();
    await expect(
      indicaciones.locator('.toastui-editor-defaultUI'),
    ).toBeVisible();
    await expect(
      indicaciones
        .locator(
          '[contenteditable="true"][aria-label="Texto de la indicación de estudio"]',
        )
        .first(),
    ).toBeVisible();
    await expect
      .poll(() =>
        indicaciones
          .locator('.p-dialog-content')
          .evaluate((element) => element.scrollTop),
      )
      .toBe(0);
    await expect(
      indicaciones.getByRole('button', { name: 'Confirmar guardado' }),
    ).toBeDisabled();
    await page.screenshot({
      path: testInfo.outputPath(`indicaciones-${viewport.width}.png`),
    });
    await indicaciones
      .getByRole('button', { name: 'Volver sin guardar' })
      .click();
    await indicaciones.getByRole('button', { name: 'Cerrar' }).click();

    await page.getByText('L01 · Temario').click();
    const editor = page.getByRole('dialog', { name: 'Editar L01' });
    await expect(
      editor.getByText('Vista de una nueva actividad'),
    ).toBeVisible();
    await expect(
      editor.getByText('Leer el tema y después repasar.'),
    ).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath(`vista-compuesta-${viewport.width}.png`),
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
  });
}

test('catálogo: buscador flexible y paginador visible con muchas filas en escritorio', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const filas = Array.from({ length: 24 }, (_, index) => ({
    ...fila,
    id: index + 1,
    codigo: `Q${String(index + 1).padStart(2, '0')}`,
  }));
  await prepararPagina(page, filas);

  const search = await page
    .getByRole('searchbox', { name: 'Buscar subbloques' })
    .boundingBox();
  const actions = await page
    .getByRole('button', { name: 'Importar catálogo' })
    .boundingBox();
  expect(search?.width).toBeGreaterThan(480);
  expect(actions?.height ?? 0).toBeLessThan(44);

  const list = page.locator('app-catalogo-subbloques-list .list-generic');
  const paginator = page.locator('app-catalogo-subbloques-list p-paginator');
  await expect(paginator).toBeInViewport();
  expect(
    await list.evaluate(
      (element) => element.scrollHeight > element.clientHeight,
    ),
  ).toBe(true);
  await list.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect(paginator).toBeInViewport();
  await page.screenshot({
    path: testInfo.outputPath('catalogo-paginador-desktop.png'),
  });
});

for (const viewport of [
  { name: 'escritorio', width: 1280, height: 800 },
  { name: 'móvil 375 px', width: 375, height: 667 },
]) {
  test(`catálogo: previsualización y confirmación en ${viewport.name}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    const aplicaciones = await prepararPagina(page);
    const busqueda = await page
      .getByRole('searchbox', { name: 'Buscar subbloques' })
      .boundingBox();
    const accion = await page
      .getByRole('button', { name: 'Importar catálogo' })
      .boundingBox();
    const filtro = await page
      .getByRole('button', { name: 'Filtros' })
      .boundingBox();
    expect(busqueda).not.toBeNull();
    expect(accion).not.toBeNull();
    expect(filtro).not.toBeNull();
    expect(Math.abs((busqueda?.y ?? 0) - (accion?.y ?? 0))).toBeLessThan(5);
    expect(Math.abs((busqueda?.y ?? 0) - (filtro?.y ?? 0))).toBeLessThan(5);
    expect((busqueda?.x ?? 0) + (busqueda?.width ?? 0)).toBeLessThan(
      accion?.x ?? 0,
    );
    expect((accion?.x ?? 0) + (accion?.width ?? 0)).toBeLessThan(
      filtro?.x ?? 0,
    );
    if (viewport.width === 375) {
      expect(accion?.width).toBeGreaterThanOrEqual(44);
    }
    await expect(page.getByText('Explicación completa')).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath(`catalogo-overview-${viewport.width}.png`),
    });
    await page.getByRole('button', { name: 'Importar catálogo' }).click();
    const dialogo = page.getByRole('dialog', {
      name: 'Importar catálogo',
    });
    await expect(
      dialogo.getByText('1. Selecciona el Excel del catálogo'),
    ).toBeVisible();
    await dialogo.locator('input[type="file"]').setInputFiles({
      name: 'catalogo.xlsx',
      mimeType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from('excel-de-prueba'),
    });
    await dialogo.getByRole('button', { name: 'Revisar Excel' }).click();
    await expect(
      dialogo.getByText(
        'Los Bloques, plantillas y calendarios existentes no cambiarán.',
      ),
    ).toBeVisible();
    await expect(dialogo.getByRole('listitem').first()).toContainText(
      /L01.*Modificado.*explicación.*Antes: Explicación completa.*Después: Explicación nueva/,
    );
    await page.screenshot({
      path: testInfo.outputPath(`catalogo-importacion-${viewport.width}.png`),
    });
    expect(aplicaciones()).toBe(0);
    await expect(
      dialogo.getByRole('button', { name: 'Confirmar importación' }),
    ).toBeDisabled();
    await dialogo
      .getByText('Confirmo los cambios en las fichas indicadas.')
      .click();
    await dialogo
      .getByRole('button', { name: 'Confirmar importación' })
      .click();
    await expect.poll(aplicaciones).toBe(1);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
  });
}

test('catálogo: no se cierra ni cambia el archivo durante la aplicación', async ({
  page,
}) => {
  await prepararPagina(page);
  let liberarAplicacion!: () => void;
  const aplicacionPendiente = new Promise<void>((resolve) => {
    liberarAplicacion = resolve;
  });
  await page.route('**/catalogo-contenido/importar/apply', async (route) => {
    await aplicacionPendiente;
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: '{}',
    });
  });

  await page.getByRole('button', { name: 'Importar catálogo' }).click();
  const dialogo = page.getByRole('dialog', { name: 'Importar catálogo' });
  await dialogo.locator('input[type="file"]').setInputFiles({
    name: 'catalogo.xlsx',
    mimeType:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from('excel-de-prueba'),
  });
  await dialogo.getByRole('button', { name: 'Revisar Excel' }).click();
  await dialogo
    .getByText('Confirmo los cambios en las fichas indicadas.')
    .click();
  const solicitud = page.waitForRequest('**/catalogo-contenido/importar/apply');
  await dialogo.getByRole('button', { name: 'Confirmar importación' }).click();
  await solicitud;
  try {
    await expect(dialogo.locator('input[type="file"]')).toBeDisabled();
    await expect(
      dialogo.getByRole('button', { name: 'Cancelar' }),
    ).toBeDisabled();
    await expect(dialogo.locator('.p-dialog-header-close')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(dialogo).toBeVisible();
  } finally {
    liberarAplicacion();
  }
  await expect(dialogo).toBeHidden();
});

test('catálogo: filtra y abre el editor Markdown compartido', async ({
  page,
}, testInfo) => {
  await prepararPagina(page);
  await page
    .getByRole('searchbox', { name: 'Buscar subbloques' })
    .fill('sin coincidencias');
  await expect(page.getByText('L01 · Temario')).toHaveCount(0);
  await page
    .getByRole('searchbox', { name: 'Buscar subbloques' })
    .fill('explicación completa');
  await page.getByText('L01 · Temario').click();
  const dialogo = page.getByRole('dialog', { name: 'Editar L01' });
  await expect(dialogo).toBeVisible();
  await expect(dialogo.locator('.toastui-editor-defaultUI')).toHaveCount(2);
  await expect(
    dialogo.getByRole('button', { name: 'Revisar y guardar' }),
  ).toBeEnabled();
  await page.screenshot({
    path: testInfo.outputPath('catalogo-editor-desktop.png'),
  });
});

test('catálogo: editor Markdown usable en móvil sin desbordamiento', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await prepararPagina(page);
  await page.getByText('L01 · Temario').click();
  const dialogo = page.getByRole('dialog', { name: 'Editar L01' });
  await expect(dialogo.locator('.toastui-editor-defaultUI')).toHaveCount(2);
  await expect(dialogo.getByLabel('Código')).toBeInViewport();
  await expect(
    dialogo.getByText('Puntos importantes · Markdown'),
  ).toBeVisible();
  await expect(
    dialogo.getByRole('button', { name: 'Guardar' }),
  ).toBeInViewport();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  await page.screenshot({
    path: testInfo.outputPath('catalogo-editor-mobile.png'),
  });
});

test('Bloques: selector reutilizado añade dos usos y cancelar no crea filas', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.route('**/planificaciones/catalogo-contenido', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        filas: [fila, { ...fila, id: 8, codigo: 'L02', nombreCorto: 'Repaso' }],
        trabajos: [{ trabajo: 'R1', descripcion: 'Repaso', version: 1 }],
      }),
    }),
  );
  await page.route(
    '**/planificaciones/catalogo-contenido/componer',
    (route) => {
      const codigo = route.request().postDataJSON().codigo as string;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          codigo,
          nombre: codigo,
          color: '#b8f6fb',
          comentarios: '**Contenido**',
        }),
      });
    },
  );
  await page.route('**/planificaciones/24', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 24,
        identificador: 'QA',
        descripcion: 'Bloque de prueba',
        subBloques: [],
      }),
    }),
  );
  await loginAsRoleMock(page, {
    rol: 'ADMIN',
    email: 'admin@test.com',
    userFixture: userAdminFixture,
  });
  await page.goto('/app/planificacion/bloques/24');
  await page.getByRole('button', { name: 'Añadir subbloques' }).click();
  const opciones = page.getByRole('dialog', { name: 'Añadir subbloques' });
  await opciones.getByRole('button', { name: 'Crear manualmente' }).click();
  await expect(
    page.getByRole('dialog', { name: 'Editar Sub-Bloque' }),
  ).toBeVisible();
  await page
    .getByRole('dialog', { name: 'Editar Sub-Bloque' })
    .getByRole('button', { name: 'Cancelar' })
    .click();
  await expect(page.getByText('Sin nombre')).toHaveCount(0);
  await page.getByRole('button', { name: 'Añadir subbloques' }).click();
  await page
    .getByRole('dialog', { name: 'Añadir subbloques' })
    .getByRole('button', { name: 'Seleccionar existentes' })
    .click();
  const selector = page.getByRole('dialog', {
    name: 'Seleccionar subbloques',
  });
  await selector
    .getByRole('checkbox', { name: 'Seleccionar L01 · Temario' })
    .focus();
  await page.keyboard.press('Space');
  await expect(selector.getByText('1 seleccionado')).toBeVisible();
  await selector.getByText('L02 · Repaso').click();
  expect(new URL(page.url()).pathname).toBe('/app/planificacion/bloques/24');
  await page.screenshot({
    path: testInfo.outputPath('selector-paso-1-mobile.png'),
  });
  await selector.getByRole('button', { name: 'Continuar' }).click();
  await expect(selector.getByText('Duración (minutos)')).toHaveCount(2);
  await page.screenshot({
    path: testInfo.outputPath('selector-paso-2-mobile.png'),
  });
  await selector.getByRole('button', { name: 'Añadir copias' }).click();
  await expect(selector).toBeHidden();
  await expect(page.getByText('L01', { exact: true })).toBeVisible();
  await expect(page.getByText('L02', { exact: true })).toBeVisible();
  await expect(page.locator('app-markdown-content strong')).toHaveCount(2);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  await page.screenshot({
    path: testInfo.outputPath('bloque-selector-mobile.png'),
  });
});
