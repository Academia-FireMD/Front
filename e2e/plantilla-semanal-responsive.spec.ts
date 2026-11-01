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

const plantillaSinDescripcion = {
  ...plantilla,
  id: 8,
  identificador: 'Repaso sin descripción',
  descripcion: '',
};

type CuerpoGuardado = {
  id?: number;
  identificador: string;
  descripcion: string;
  subBloques: Array<{ nombre: string }>;
};

function seSolapan(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return !(
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y
  );
}

async function prepararApiPlantillas(
  page: Page,
): Promise<{ cuerpoGuardado: () => CuerpoGuardado | null }> {
  let cuerpoGuardado: CuerpoGuardado | null = null;

  await page.route('**/planificaciones/plantillas-semanales/7', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(plantilla),
    }),
  );
  await page.route('**/planificaciones/plantillas-semanales/8', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(plantillaSinDescripcion),
    }),
  );

  await page.route('**/planificaciones/plantilla-semanal', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    cuerpoGuardado = route.request().postDataJSON() as CuerpoGuardado;
    const id = cuerpoGuardado.id ?? 7;
    const base = id === 8 ? plantillaSinDescripcion : plantilla;
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        ...base,
        id,
        identificador: cuerpoGuardado.identificador,
        descripcion: cuerpoGuardado.descripcion,
      }),
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
  await expect(descripcion).not.toHaveAttribute('required', '');
  await expect(descripcion).not.toHaveAttribute('aria-required', 'true');
  await expect(nombre).toHaveAttribute(
    'placeholder',
    'Ej. Repaso de hidráulica',
  );
  await expect(descripcion).toHaveAttribute(
    'placeholder',
    'Objetivo de esta semana',
  );

  const guardar = page.getByRole('button', { name: 'Guardar plantilla' });
  await expect(guardar).toHaveCount(1);
  await expect(guardar).toBeInViewport({ ratio: 1 });

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

test('guardar plantilla con descripción vacía conserva la actividad y no publica', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAsAdminMock(page, userAdminFixture);
  const api = await prepararApiPlantillas(page);
  await page.goto('/app/planificacion/plantillas-semanales/new');

  const guardar = page.getByRole('button', { name: 'Guardar plantilla' });
  await expect(guardar).toBeDisabled();
  await expect(guardar).toBeInViewport({ ratio: 1 });

  await page.getByRole('button', { name: 'Añadir actividad' }).click();
  await page.getByRole('menuitem', { name: 'Añadir nuevo' }).click();
  const dialogo = page.getByRole('dialog').filter({ hasText: 'Sub-Bloque' });
  await expect(dialogo).toBeVisible();
  await dialogo.getByLabel('Nombre', { exact: true }).fill('Actividad QA');
  await dialogo.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(dialogo).toBeHidden();

  await page.getByLabel('Nombre de la plantilla').fill('Repaso de hidráulica');
  await expect(page.getByLabel('Descripción')).toHaveValue('');
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
    descripcion: '',
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
  await expect(
    page.getByRole('button', { name: 'Guardar plantilla' }),
  ).toBeInViewport({ ratio: 1 });
});

test('editar con descripción vacía sigue siendo válido y conserva sus actividades', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAsAdminMock(page, userAdminFixture);
  const api = await prepararApiPlantillas(page);
  await page.goto('/app/planificacion/plantillas-semanales/8');

  await expect(
    page.getByRole('heading', { level: 1, name: 'Editar plantilla semanal' }),
  ).toBeVisible();
  const descripcion = page.getByLabel('Descripción');
  const guardar = page.getByRole('button', { name: 'Guardar plantilla' });
  await expect(descripcion).toHaveValue('');
  await expect(descripcion).toBeEditable();
  await expect(descripcion).not.toHaveAttribute('aria-required', 'true');
  await expect(page.locator('.plantilla-editor [role="alert"]')).toHaveCount(0);
  await expect(guardar).toBeEnabled();
  await expect(guardar).toBeInViewport({ ratio: 1 });

  await guardar.click();

  await expect(page).toHaveURL(
    /\/app\/planificacion\/plantillas-semanales\/8$/,
  );
  expect(api.cuerpoGuardado()).toMatchObject({
    id: 8,
    descripcion: '',
    subBloques: [expect.objectContaining({ nombre: 'Hidráulica y mecánica' })],
  });
});

test('en 375x812 la barra es accesible desde el inicio y no tapa contenido', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await entrarEnNuevaPlantilla(page);

  const nombre = page.getByLabel('Nombre de la plantilla');
  const descripcion = page.getByLabel('Descripción');
  const guardar = page.getByRole('button', { name: 'Guardar plantilla' });
  const barra = page.locator('.plantilla-acciones');
  const zonaScroll = page.locator('.plantilla-editor__contenido');

  await expect(guardar).toHaveCount(1);
  await expect(guardar).toBeInViewport({ ratio: 1 });

  const cajaGuardarInicial = await guardar.boundingBox();
  const cajaBarraInicial = await barra.boundingBox();
  const cajaZonaInicial = await zonaScroll.boundingBox();
  expect(cajaGuardarInicial).not.toBeNull();
  expect(cajaBarraInicial).not.toBeNull();
  expect(cajaZonaInicial).not.toBeNull();
  expect(cajaGuardarInicial!.height).toBeGreaterThanOrEqual(44);
  expect(cajaZonaInicial!.y + cajaZonaInicial!.height).toBeLessThanOrEqual(
    cajaBarraInicial!.y + 1,
  );
  expect(cajaBarraInicial!.y + cajaBarraInicial!.height).toBeLessThanOrEqual(
    812 + 1,
  );
  expect(
    await zonaScroll.evaluate((el) => getComputedStyle(el).overflowY),
  ).toBe('auto');

  await expect(descripcion).toBeVisible();
  await expect(descripcion).toBeEditable();
  await expect(descripcion).not.toHaveAttribute('required', '');
  await expect(descripcion).not.toHaveAttribute('aria-required', 'true');
  await nombre.fill('Repaso de hidráulica');
  await descripcion.fill('Objetivo de esta semana');
  await expect(descripcion).toHaveValue('Objetivo de esta semana');
  await expect(guardar).toBeEnabled();

  const cajaZonaActual = await zonaScroll.boundingBox();
  expect(cajaZonaActual).not.toBeNull();
  for (const tamano of [56, 72]) {
    await page.evaluate((size) => {
      const launcher = document.createElement('button');
      launcher.id = 'qa-launcher-sintetico';
      launcher.setAttribute('aria-label', 'Launcher sintético QA');
      launcher.style.position = 'fixed';
      launcher.style.right = '20px';
      launcher.style.bottom = '20px';
      launcher.style.width = `${size}px`;
      launcher.style.height = `${size}px`;
      launcher.style.zIndex = '9999';
      launcher.style.borderRadius = '50%';
      launcher.style.background = 'rgba(0, 0, 0, 0.02)';
      document.body.appendChild(launcher);
    }, tamano);
    const cajaLauncher = await page
      .locator('#qa-launcher-sintetico')
      .boundingBox();
    const cajaGuardarActual = await guardar.boundingBox();
    expect(cajaLauncher).not.toBeNull();
    expect(cajaGuardarActual).not.toBeNull();
    expect(seSolapan(cajaGuardarActual!, cajaLauncher!)).toBe(false);
    expect(cajaLauncher!.y).toBeGreaterThanOrEqual(
      cajaZonaActual!.y + cajaZonaActual!.height - 1,
    );
    await page.evaluate(() =>
      document.getElementById('qa-launcher-sintetico')?.remove(),
    );
  }

  const guardarDescubierto = await page.evaluate(() => {
    const boton = document.querySelector(
      'app-async-button button',
    ) as HTMLElement | null;
    if (!boton) return false;
    const caja = boton.getBoundingClientRect();
    const encima = document.elementFromPoint(
      caja.left + caja.width / 2,
      caja.top + caja.height / 2,
    );
    return boton === encima || boton.contains(encima);
  });
  expect(guardarDescubierto).toBe(true);

  const cajaNombre = await nombre.boundingBox();
  const cajaDescripcion = await descripcion.boundingBox();
  expect(cajaNombre).not.toBeNull();
  expect(cajaDescripcion).not.toBeNull();
  expect(cajaNombre!.y + cajaNombre!.height).toBeLessThanOrEqual(
    cajaDescripcion!.y + 1,
  );
  expect(cajaDescripcion!.height).toBeGreaterThanOrEqual(44);
  expect(cajaDescripcion!.y + cajaDescripcion!.height).toBeLessThanOrEqual(
    cajaBarraInicial!.y + 1,
  );

  const sinScrollHorizontal = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth + 1,
  );
  expect(sinScrollHorizontal).toBe(true);
  expect(
    await zonaScroll.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
  ).toBe(true);

  const cta = page.getByRole('button', { name: 'Añadir actividad' });
  await cta.focus();
  const cajaCta = await cta.boundingBox();
  expect(cajaCta).not.toBeNull();
  expect(cajaCta!.height).toBeGreaterThanOrEqual(44);
  expect(cajaCta!.y + cajaCta!.height).toBeLessThanOrEqual(
    cajaBarraInicial!.y + 1,
  );
  await cta.click();
  await expect(
    page.getByRole('menuitem', { name: 'Añadir nuevo' }),
  ).toBeVisible();
  await page.keyboard.press('Escape');

  await zonaScroll.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  const cajaBarraFinal = await barra.boundingBox();
  const cajaZonaFinal = await zonaScroll.boundingBox();
  expect(cajaBarraFinal).not.toBeNull();
  expect(cajaZonaFinal).not.toBeNull();
  expect(cajaZonaFinal!.y + cajaZonaFinal!.height).toBeLessThanOrEqual(
    cajaBarraFinal!.y + 1,
  );
  await expect(guardar).toBeInViewport({ ratio: 1 });
  expect(await zonaScroll.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);

  await page.goto('/app/planificacion/plantillas-semanales/7');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Editar plantilla semanal' }),
  ).toBeVisible();
  const cajaBarraEdicion = await barra.boundingBox();
  expect(cajaBarraEdicion).not.toBeNull();

  const evento = page.locator('.cal-event-container').first();
  await evento.scrollIntoViewIfNeeded();
  const cajaEvento = await evento.boundingBox();
  expect(cajaEvento).not.toBeNull();
  expect(cajaEvento!.y + cajaEvento!.height).toBeLessThanOrEqual(
    cajaBarraEdicion!.y + 1,
  );

  await expect(guardar).toBeInViewport({ ratio: 1 });
});
