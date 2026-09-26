import { expect, Page, test } from '@playwright/test';
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
  planificacionAnteriorId: 17,
  varianteBorradorId: 7,
};

const reglas = [
  {
    id: 11,
    oposicionSuscripcion: 'MADRID',
    oposicionPlanificacion: 'MADRID',
    activa: true,
  },
  {
    id: 12,
    oposicionSuscripcion: 'VALENCIA_AYUNTAMIENTO',
    oposicionPlanificacion: 'VALENCIA_AYUNTAMIENTO',
    activa: false,
  },
];

async function mockDatosAdmin(
  page: Page,
  reglasRespuesta: typeof reglas = [],
): Promise<void> {
  await page.route('**/planificaciones/admin/variantes', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([variante]),
    }),
  );
  await page.route('**/planificaciones/admin/reglas', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(reglasRespuesta),
    }),
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
}

test('admin publica y asigna una release mediante la acción explícita', async ({
  page,
}, testInfo) => {
  let payloadPublicacion: unknown = null;
  await mockDatosAdmin(page);
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

  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Nueva variante' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Nueva variante' }),
  ).not.toHaveClass(/p-button-link/);
  await expect(page.locator('.variantes-list .p-tag-success')).toBeVisible();
  await page.locator('.variantes-list').screenshot({
    path: testInfo.outputPath('variantes-desktop.png'),
  });

  await page.getByRole('button', { name: 'Nueva variante' }).click();
  const alta = page.getByRole('dialog', { name: 'Nueva variante' });
  await expect(alta).toBeVisible();
  await alta.locator('.p-dialog-header-close').click();
  await expect(alta).toHaveCount(0);

  await page
    .getByRole('button', { name: 'Editar variante GA4-6', exact: true })
    .click();
  const dialogo = page.getByRole('dialog', { name: 'Editar variante' });
  await expect(dialogo).toBeVisible();
  const releaseDropdown = dialogo.locator('p-dropdown').last();
  await releaseDropdown.click();
  await page
    .locator('.p-dropdown-panel')
    .last()
    .getByText(/GENERAL-SEPTIEMBRE v2.*BORRADOR/)
    .click();

  await expect(
    dialogo.getByText(
      'Este borrador debe validarse y publicarse antes de asignarlo.',
    ),
  ).toBeVisible();
  await expect(
    dialogo.getByRole('button', { name: 'Publicar y asignar' }),
  ).toBeVisible();
  await expect(dialogo.getByRole('button', { name: 'Guardar' })).toBeDisabled();

  const screenshotPath = process.env['PLAN_RELEASE_SCREENSHOT_PATH'];
  if (screenshotPath) {
    await page.locator('.planificacion-admin-tabs').screenshot({
      path: screenshotPath,
    });
  }

  await dialogo.getByRole('button', { name: 'Publicar y asignar' }).click();
  const confirmacion = page.getByRole('alertdialog');
  await expect(confirmacion).toContainText(
    'Los alumnos actuales recibirán esta versión, conservando el progreso',
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

test('la rejilla y el alta de variantes caben en móvil', async ({
  page,
}, testInfo) => {
  let cambiosEstado = 0;
  await page.setViewportSize({ width: 375, height: 667 });
  await mockDatosAdmin(page);
  await page.route('**/planificaciones/admin/variantes/7', (route) => {
    cambiosEstado += 1;
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...variante, activa: false }),
    });
  });
  await loginAsRoleMock(page, {
    rol: 'ADMIN',
    email: 'admin@test.com',
    userFixture: userAdminFixture,
    modulos: { PLANIFICACION_AUTOASIGNACION: true },
  });
  await page.goto('/app/planificacion/admin-planificacion');

  await expect(page.getByText('GA4-6', { exact: true })).toBeVisible();
  const fila = page.locator('.variantes-list .item-container');
  const medidas = await fila.evaluate((elemento) => ({
    alto: elemento.clientHeight,
    contenido: elemento.scrollHeight,
    maximo: getComputedStyle(elemento).maxHeight,
    scrollLista: elemento.closest('.list-generic')?.scrollTop ?? 0,
  }));
  expect(medidas.contenido, JSON.stringify(medidas)).toBeLessThanOrEqual(
    medidas.alto,
  );
  expect(medidas.scrollLista).toBe(0);
  await page.locator('.variantes-list').screenshot({
    path: testInfo.outputPath('variantes-mobile.png'),
  });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(375);

  await page.locator('.variant-switch-target').click();
  await expect.poll(() => cambiosEstado).toBe(1);
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.getByRole('button', { name: 'Nueva variante' }).click();
  const dialogo = page.getByRole('dialog', { name: 'Nueva variante' });
  await expect(dialogo).toBeVisible();
  await expect(dialogo.locator('#variante-codigo')).toHaveAttribute(
    'readonly',
    '',
  );
  await dialogo.screenshot({
    path: testInfo.outputPath('variante-dialog-mobile.png'),
  });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(375);
  await dialogo.getByRole('button', { name: 'Cancelar' }).click();
  await expect(dialogo).toHaveCount(0);
});

test('reglas usan la rejilla compartida y el diálogo se cierra desde la X', async ({
  page,
}, testInfo) => {
  await mockDatosAdmin(page, reglas);
  await loginAsRoleMock(page, {
    rol: 'ADMIN',
    email: 'admin@test.com',
    userFixture: userAdminFixture,
    modulos: { PLANIFICACION_AUTOASIGNACION: true },
  });
  await page.goto('/app/planificacion/admin-planificacion');
  await page.getByRole('tab', { name: /Opciones por suscripción/ }).click();

  const lista = page.locator('.reglas-list');
  await expect(lista.locator('.item-container')).toHaveCount(2);
  await expect(lista.locator('.p-tag-success')).toBeVisible();
  await expect(lista.locator('.p-tag-secondary')).toBeVisible();
  await lista.screenshot({ path: testInfo.outputPath('reglas-desktop.png') });

  await page.setViewportSize({ width: 375, height: 667 });
  await page.reload();
  await page.getByRole('tab', { name: /Opciones por suscripción/ }).click();
  await expect(
    lista.locator('.item-container').first().locator('.identifier'),
  ).toBeInViewport();
  await expect(
    lista.locator('.item-container').first().locator('.regla-destino'),
  ).toBeInViewport();
  await lista.screenshot({ path: testInfo.outputPath('reglas-mobile.png') });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(375);

  await lista.getByRole('searchbox', { name: 'Buscar reglas' }).fill('Madrid');
  await expect(lista.locator('.item-container')).toHaveCount(1);
  await lista.getByRole('searchbox', { name: 'Buscar reglas' }).fill('');

  await lista.getByRole('button', { name: 'Filtros', exact: true }).click();
  const filtros = page.getByRole('dialog', { name: 'Filtros' });
  await filtros.locator('p-dropdown').nth(2).click();
  await page.getByRole('option', { name: 'Inactivas' }).click();
  await filtros.getByRole('button', { name: 'Aplicar' }).click();
  await expect(lista.locator('.item-container')).toHaveCount(1);
  await expect(lista.locator('.item-container')).toContainText(
    'Ayuntamiento de Valencia',
  );
  await lista.getByRole('button', { name: 'Filtros', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Filtros' })
    .getByRole('button', { name: 'Limpiar filtros' })
    .click();
  await expect(lista.locator('.item-container')).toHaveCount(2);

  await page.getByRole('button', { name: 'Nueva regla' }).click();
  const dialogo = page.getByRole('dialog', { name: 'Nueva regla' });
  await expect(dialogo).toBeVisible();
  await expect(dialogo.getByText('Selecciona oposición')).toBeVisible();
  await expect(
    dialogo.getByText('Elige antes la oposición contratada'),
  ).toBeVisible();
  await expect(dialogo.getByRole('button', { name: 'Guardar' })).toBeDisabled();
  await dialogo.screenshot({
    path: testInfo.outputPath('regla-dialog-mobile.png'),
  });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(375);
  await dialogo.locator('.p-dialog-header-close').click();
  await expect(dialogo).toHaveCount(0);

  await lista
    .locator('button[aria-label^="Editar regla Comunidad de Madrid"]')
    .click();
  await expect(
    page.getByRole('dialog', { name: 'Editar regla' }),
  ).toBeVisible();
});
