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

async function prepararPagina(page: Page) {
  let aplicaciones = 0;
  await page.route('**/planificaciones/catalogo-contenido', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ filas: [fila], trabajos: [] }),
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
          usos: 3,
          bloques: 1,
          plantillas: 0,
          borradores: 1,
          publicadas: 1,
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
  await expect(page.getByRole('heading', { name: 'Subbloques' })).toBeVisible();
  return () => aplicaciones;
}

for (const viewport of [
  { name: 'escritorio', width: 1280, height: 800 },
  { name: 'móvil 375 px', width: 375, height: 667 },
]) {
  test(`catálogo: previsualización, impacto y confirmación en ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    const aplicaciones = await prepararPagina(page);
    if (viewport.width === 375) {
      const busqueda = await page
        .getByRole('searchbox', { name: 'Buscar subbloques' })
        .boundingBox();
      const accion = await page
        .getByRole('button', { name: 'Importar catálogo' })
        .boundingBox();
      expect(busqueda?.width).toBeGreaterThan(280);
      expect(accion?.width).toBeGreaterThan(280);
      expect(Math.abs((busqueda?.x ?? 0) - (accion?.x ?? 0))).toBeLessThan(3);
    }
    await expect(page.getByText('Explicación completa')).toBeVisible();
    await page.getByRole('button', { name: 'Importar catálogo' }).click();
    const dialogo = page.getByRole('dialog', {
      name: 'Importar catálogo de subbloques',
    });
    await dialogo.locator('input[type="file"]').setInputFiles({
      name: 'catalogo.xlsx',
      mimeType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from('excel-de-prueba'),
    });
    await dialogo.getByRole('button', { name: 'Revisar Excel' }).click();
    await expect(dialogo.getByText('1 calendarios publicados')).toBeVisible();
    await expect(dialogo.getByRole('listitem').first()).toContainText(
      /L01.*Modificado.*explicación.*Antes: Explicación completa.*Después: Explicación nueva/,
    );
    expect(aplicaciones()).toBe(0);
    await expect(
      dialogo.getByRole('button', { name: 'Importar', exact: true }),
    ).toBeDisabled();
    await dialogo
      .getByText('Confirmo que quiero sustituir el contenido indicado.')
      .click();
    await dialogo
      .getByRole('button', { name: 'Importar', exact: true })
      .click();
    await expect.poll(aplicaciones).toBe(1);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
  });
}

test('catálogo: filtra y abre el editor Markdown compartido', async ({ page }, testInfo) => {
  await prepararPagina(page);
  await page.getByRole('searchbox', { name: 'Buscar subbloques' }).fill('sin coincidencias');
  await expect(page.getByText('L01 · Temario')).toHaveCount(0);
  await page.getByRole('searchbox', { name: 'Buscar subbloques' }).fill('explicación completa');
  await page.getByText('L01 · Temario').click();
  const dialogo = page.getByRole('dialog', { name: 'Editar L01' });
  await expect(dialogo).toBeVisible();
  await expect(dialogo.locator('.toastui-editor-defaultUI')).toHaveCount(2);
  await expect(dialogo.getByRole('button', { name: 'Guardar' })).toBeDisabled();
  await page.screenshot({ path: testInfo.outputPath('catalogo-editor-desktop.png') });
});

test('catálogo: editor Markdown usable en móvil sin desbordamiento', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await prepararPagina(page);
  await page.getByText('L01 · Temario').click();
  const dialogo = page.getByRole('dialog', { name: 'Editar L01' });
  await expect(dialogo.locator('.toastui-editor-defaultUI')).toHaveCount(2);
  await expect(dialogo.getByLabel('Código')).toBeInViewport();
  await expect(dialogo.getByText('Puntos importantes · Markdown')).toBeVisible();
  await expect(dialogo.getByRole('button', { name: 'Guardar' })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.screenshot({ path: testInfo.outputPath('catalogo-editor-mobile.png') });
});

test('Bloques: selector reutilizado añade dos usos y cancelar no crea filas', async ({ page }, testInfo) => {
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
  await page.route('**/planificaciones/catalogo-contenido/componer', (route) => {
    const codigo = route.request().postDataJSON().codigo as string;
    return route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ codigo, nombre: codigo, color: '#b8f6fb', comentarios: '**Contenido**' }) });
  });
  await page.route('**/planificaciones/24', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ id: 24, identificador: 'QA', descripcion: 'Bloque de prueba', subBloques: [] }) }),
  );
  await loginAsRoleMock(page, { rol: 'ADMIN', email: 'admin@test.com', userFixture: userAdminFixture });
  await page.goto('/app/planificacion/bloques/24');
  await page.getByRole('button', { name: 'Añadir subbloques' }).click();
  const opciones = page.getByRole('dialog', { name: 'Añadir subbloques' });
  await opciones.getByRole('button', { name: 'Crear manualmente' }).click();
  await expect(page.getByRole('dialog', { name: 'Editar Sub-Bloque' })).toBeVisible();
  await page.getByRole('dialog', { name: 'Editar Sub-Bloque' }).getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.getByText('Sin nombre')).toHaveCount(0);
  await page.getByRole('button', { name: 'Añadir subbloques' }).click();
  await page.getByRole('dialog', { name: 'Añadir subbloques' }).getByRole('button', { name: 'Seleccionar del catálogo' }).click();
  const selector = page.getByRole('dialog', { name: 'Seleccionar subbloques del catálogo' });
  await selector.getByRole('checkbox', { name: 'Seleccionar L01 · Temario' }).focus();
  await page.keyboard.press('Space');
  await expect(selector.getByText('1 seleccionado')).toBeVisible();
  await selector.getByText('L02 · Repaso').click();
  expect(new URL(page.url()).pathname).toBe('/app/planificacion/bloques/24');
  await selector.getByRole('button', { name: 'Añadir 2 al Bloque' }).click();
  await expect(page.getByText('L01', { exact: true })).toBeVisible();
  await expect(page.getByText('L02', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.screenshot({ path: testInfo.outputPath('bloque-selector-mobile.png') });
});
