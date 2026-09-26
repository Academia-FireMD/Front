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
