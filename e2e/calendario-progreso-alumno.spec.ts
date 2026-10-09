import { expect, test, type Page } from '@playwright/test';
import { loginAsRoleMock } from './helpers/auth.helper';

const PLAN_ID = 9876;
const inicio = new Date();
inicio.setHours(12, 0, 0, 0);
const fecha = `${inicio.getFullYear()}-${String(inicio.getMonth() + 1).padStart(2, '0')}-${String(inicio.getDate()).padStart(2, '0')}`;
const TITULO_LARGO =
  'ENTRENAMIENTO físico de resistencia y fuerza con un título deliberadamente muy largo para comprobar la casilla';

const usuarioAlumno = {
  id: 1,
  email: 'alumno@test.com',
  nombre: 'Test',
  apellidos: 'Alumno',
  rol: 'ALUMNO',
  validated: true,
  onboardingCompletado: true,
  suscripciones: [{ id: 1, tipo: 'PREMIUM', status: 'ACTIVE' }],
  oposiciones: [],
};

async function mockCalendario(
  page: Page,
  options?: { retenerGuardado?: boolean },
) {
  let realizado = false;
  let guardados: Array<Record<string, unknown>> = [];
  let liberarGuardado: (() => void) | undefined;

  await page.route(
    `**/planificaciones/planificaciones-mensuales/${PLAN_ID}`,
    (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          id: PLAN_ID,
          identificador: 'QA-CALENDARIO',
          descripcion: 'Prueba de calendario',
          mes: inicio.getMonth() + 1,
          ano: inicio.getFullYear(),
          relevancia: [],
          esPorDefecto: false,
          tipoDePlanificacion: 'FRANJA_CUATRO_A_SEIS_HORAS',
          subBloques: [
            {
              id: 98761,
              planificacionId: PLAN_ID,
              nombre: TITULO_LARGO,
              horaInicio: inicio.toISOString(),
              duracion: 60,
              color: '#f59e0b',
              comentarios: 'Indicaciones importantes de estudio',
              realizado,
              esEntrenamientoFisico: true,
            },
          ],
        }),
      }),
  );
  await page.route(
    `**/planificaciones/eventos-personalizados/${PLAN_ID}`,
    (route) => route.fulfill({ contentType: 'application/json', body: '[]' }),
  );
  await page.route('**/planificacion-fisica/resumen-dias**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify([
        {
          fecha,
          bloqueId: 77,
          disciplinas: [
            {
              nombre: 'Carrera',
              grupo: 'CARRERA',
              color: '#123456',
              realizado: false,
            },
          ],
        },
      ]),
    }),
  );
  await page.route(
    '**/planificaciones/actualizar-progreso-subbloque',
    async (route) => {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      guardados = [...guardados, body];
      if (options?.retenerGuardado) {
        await new Promise<void>((resolve) => (liberarGuardado = resolve));
        return route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Error de red simulado' }),
        });
      }
      realizado = Boolean(body['realizado']);
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: '{}',
      });
    },
  );

  await loginAsRoleMock(page, {
    rol: 'ALUMNO',
    email: 'alumno@test.com',
    userFixture: usuarioAlumno,
  });

  return {
    guardados: () => guardados,
    liberarGuardado: () => liberarGuardado?.(),
  };
}

async function abrirCalendario(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await page.goto(`/app/planificacion/planificacion-mensual-alumno/${PLAN_ID}`);
  await expect(page.locator('app-vista-semanal')).toBeVisible();
  const tarjeta = page
    .locator('.wrapper')
    .filter({ hasText: TITULO_LARGO })
    .first();
  const casilla = tarjeta.getByTestId('completion-toggle');
  await expect(casilla).toBeVisible();
  await casilla.scrollIntoViewIfNeeded();
  await expect(casilla).toHaveAttribute('aria-checked', 'false');
  const caja = await casilla.boundingBox();
  expect(caja).not.toBeNull();
  expect(caja!.width).toBeGreaterThanOrEqual(44);
  expect(caja!.height).toBeGreaterThanOrEqual(44);
  expect(caja!.x + caja!.width).toBeLessThanOrEqual(width + 1);
  return { tarjeta, casilla };
}

for (const viewport of [
  { name: 'escritorio', width: 1440, height: 900 },
  { name: 'movil', width: 375, height: 667 },
]) {
  test(`entrenamiento vinculado se marca, persiste y desmarca en ${viewport.name}`, async ({
    page,
  }) => {
    const api = await mockCalendario(page);
    const { tarjeta, casilla } = await abrirCalendario(
      page,
      viewport.width,
      viewport.height,
    );

    await expect(
      tarjeta.getByRole('button', { name: 'Ver plan físico de este día' }),
    ).toBeVisible();
    await expect(tarjeta.getByTestId('fisica-vinculada-estado')).toContainText(
      'Plan físico: 0/1',
    );
    await casilla.click();
    await expect(casilla).toHaveAttribute('aria-checked', 'true');
    await expect.poll(() => api.guardados().length).toBe(1);
    expect(api.guardados()[0]).toMatchObject({
      subBloqueId: 98761,
      planificacionId: PLAN_ID,
      realizado: true,
    });
    await expect(page).toHaveURL(
      new RegExp(`/planificacion-mensual-alumno/${PLAN_ID}$`),
    );

    await page.reload();
    const tarjetaRecargada = page
      .locator('.wrapper')
      .filter({ hasText: TITULO_LARGO })
      .first();
    const casillaRecargada = tarjetaRecargada.getByTestId('completion-toggle');
    await expect(casillaRecargada).toHaveAttribute('aria-checked', 'true');
    await casillaRecargada.click();
    await expect(casillaRecargada).toHaveAttribute('aria-checked', 'false');
    await expect.poll(() => api.guardados().length).toBe(2);
    expect(api.guardados()[1]).toMatchObject({
      subBloqueId: 98761,
      planificacionId: PLAN_ID,
      realizado: false,
    });
  });

  test(`fallo de red revierte la marca y los clics repetidos no duplican POST en ${viewport.name}`, async ({
    page,
  }) => {
    const api = await mockCalendario(page, { retenerGuardado: true });
    const { casilla } = await abrirCalendario(
      page,
      viewport.width,
      viewport.height,
    );

    await casilla.click();
    await expect.poll(() => api.guardados().length).toBe(1);
    await expect(casilla).toBeDisabled();
    await casilla.evaluate((element) => (element as HTMLButtonElement).click());
    expect(api.guardados()).toHaveLength(1);

    api.liberarGuardado();
    await expect(casilla).toHaveAttribute('aria-checked', 'false');
    await expect(casilla).toBeEnabled();
    expect(api.guardados()).toHaveLength(1);
    await expect(page).toHaveURL(
      new RegExp(`/planificacion-mensual-alumno/${PLAN_ID}$`),
    );
  });
}
