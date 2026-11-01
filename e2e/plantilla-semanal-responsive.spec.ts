import { expect, test, type Page } from '@playwright/test';
import userAdminFixture from './fixtures/user-admin.json';
import { loginAsAdminMock } from './helpers/auth.helper';

const fecha = '2026-10-28T09:00:00.000Z';

const plantilla = {
  id: 7,
  identificador: 'Repaso de hidráulica',
  descripcion: 'Objetivo de la semana',
  subBloques: [
    {
      id: 501,
      nombre: 'Hidráulica y mecánica',
      horaInicio: '2026-10-28T09:00:00.000Z',
      duracion: 60,
      color: '#e65b40',
      comentarios: '',
    },
  ],
  planificaciones: [],
  createdAt: fecha,
  updatedAt: fecha,
};

async function prepararApiPlantillas(
  page: Page,
): Promise<{ cuerpoGuardado: () => unknown }> {
  let cuerpoGuardado: unknown = null;

  await page.route('**/planificaciones/plantillas-semanales/7', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(plantilla),
    }),
  );

  await page.route('**/planificaciones/plantilla-semanal', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    cuerpoGuardado = route.request().postDataJSON();
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ ...plantilla, id: 7 }),
    });
  });

  return { cuerpoGuardado: () => cuerpoGuardado };
}

async function entrarEnNuevaPlantilla(page: Page): Promise<void> {
  await loginAsAdminMock(page, userAdminFixture);
  await prepararApiPlantillas(page);
  await page.goto('/app/planificacion/plantillas-semanales/new');
}

test('el editor nuevo muestra contexto, campos asociados y el menú existente', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await entrarEnNuevaPlantilla(page);

  await expect(
    page.getByRole('heading', { level: 1, name: 'Nueva plantilla semanal' }),
  ).toBeVisible();
  const migas = page.locator('.plantilla-migas');
  await expect(migas).toContainText('Planificación');
  await expect(
    migas.getByRole('link', { name: /Plantillas semanales/ }),
  ).toBeVisible();

  const nombre = page.getByLabel('Nombre de la plantilla');
  const descripcion = page.getByLabel('Descripción');
  await expect(nombre).toBeVisible();
  await expect(descripcion).toBeVisible();
  await expect(descripcion).toBeEditable();
  await expect(nombre).toHaveAttribute(
    'placeholder',
    'Ej. Repaso de hidráulica',
  );
  await expect(descripcion).toHaveAttribute(
    'placeholder',
    'Objetivo de esta semana',
  );

  await expect(
    page.getByRole('heading', { name: 'Contenido de la semana' }),
  ).toBeVisible();
  await expect(
    page.getByText('También puedes pulsar una hora del calendario.'),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Añadir actividad' }).click();
  const anadirNuevo = page.getByRole('menuitem', { name: 'Añadir nuevo' });
  await expect(anadirNuevo).toBeVisible();
  await anadirNuevo.click();
  const dialogo = page.getByRole('dialog').filter({ hasText: 'Sub-Bloque' });
  await expect(dialogo).toBeVisible();
  await expect(dialogo).toContainText('Sub-Bloque');
  await page.keyboard.press('Escape');
});

test('guardar plantilla usa el flujo existente y no publica en planes', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAsAdminMock(page, userAdminFixture);
  const api = await prepararApiPlantillas(page);
  await page.goto('/app/planificacion/plantillas-semanales/new');

  const guardar = page.getByRole('button', { name: 'Guardar plantilla' });
  await expect(guardar).toBeDisabled();

  await page.getByRole('button', { name: 'Añadir actividad' }).click();
  await page.getByRole('menuitem', { name: 'Añadir nuevo' }).click();
  const dialogo = page.getByRole('dialog').filter({ hasText: 'Sub-Bloque' });
  await expect(dialogo).toBeVisible();
  await dialogo.getByLabel('Nombre', { exact: true }).fill('Actividad QA');
  await dialogo.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(dialogo).toBeHidden();

  await page.getByLabel('Nombre de la plantilla').fill('Repaso de hidráulica');
  await page.getByLabel('Descripción').fill('Objetivo de la semana');
  await expect(guardar).toBeEnabled();

  await guardar.click();

  await expect(page).toHaveURL(
    /\/app\/planificacion\/plantillas-semanales\/7$/,
  );
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'Editar plantilla semanal',
  );
  expect(api.cuerpoGuardado()).toMatchObject({
    identificador: 'Repaso de hidráulica',
    descripcion: 'Objetivo de la semana',
    subBloques: [expect.objectContaining({ nombre: 'Actividad QA' })],
  });
});

test('editar conserva el identificador existente y permite cambiar la descripción', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAsAdminMock(page, userAdminFixture);
  await prepararApiPlantillas(page);
  await page.goto('/app/planificacion/plantillas-semanales/7');

  await expect(
    page.getByRole('heading', { level: 1, name: 'Editar plantilla semanal' }),
  ).toBeVisible();
  const nombre = page.getByLabel('Nombre de la plantilla');
  const descripcion = page.getByLabel('Descripción');
  await expect(nombre).toHaveValue('Repaso de hidráulica');
  await expect(nombre).toHaveAttribute('readonly', '');
  await expect(descripcion).toHaveValue('Objetivo de la semana');
  await expect(descripcion).toBeEditable();
});

test('en 375 px los campos se apilan, la descripción sigue editable y guardar queda fuera del contenido', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await entrarEnNuevaPlantilla(page);

  const nombre = page.getByLabel('Nombre de la plantilla');
  const descripcion = page.getByLabel('Descripción');
  await expect(descripcion).toBeVisible();
  await expect(descripcion).toBeEditable();
  await descripcion.fill('Objetivo de esta semana');
  await expect(descripcion).toHaveValue('Objetivo de esta semana');

  const cajaNombre = await nombre.boundingBox();
  const cajaDescripcion = await descripcion.boundingBox();
  expect(cajaNombre).not.toBeNull();
  expect(cajaDescripcion).not.toBeNull();
  expect(cajaNombre!.y + cajaNombre!.height).toBeLessThanOrEqual(
    cajaDescripcion!.y + 1,
  );
  expect(cajaDescripcion!.height).toBeGreaterThanOrEqual(44);

  const sinScrollHorizontal = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth + 1,
  );
  expect(sinScrollHorizontal).toBe(true);

  const cta = page.getByRole('button', { name: 'Añadir actividad' });
  const cajaCta = await cta.boundingBox();
  expect(cajaCta).not.toBeNull();
  expect(cajaCta!.height).toBeGreaterThanOrEqual(44);

  const posicionBarra = await page
    .locator('.plantilla-acciones')
    .evaluate((el) => getComputedStyle(el).position);
  expect(posicionBarra).not.toBe('fixed');
  expect(posicionBarra).not.toBe('sticky');

  const calendario = await page.locator('app-vista-semanal').boundingBox();
  const acciones = await page.locator('.plantilla-acciones').boundingBox();
  expect(calendario).not.toBeNull();
  expect(acciones).not.toBeNull();
  expect(acciones!.y).toBeGreaterThanOrEqual(
    calendario!.y + calendario!.height - 1,
  );

  const guardar = page.getByRole('button', { name: 'Guardar plantilla' });
  await guardar.scrollIntoViewIfNeeded();
  await expect(guardar).toBeVisible();
  const cajaGuardar = await guardar.boundingBox();
  expect(cajaGuardar).not.toBeNull();
  expect(cajaGuardar!.height).toBeGreaterThanOrEqual(44);

  await page.getByRole('button', { name: 'Añadir actividad' }).click();
  await expect(
    page.getByRole('menuitem', { name: 'Añadir nuevo' }),
  ).toBeVisible();
});
