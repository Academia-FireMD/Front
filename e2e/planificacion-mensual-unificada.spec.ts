import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import userAdminFixture from './fixtures/user-admin.json';
import { loginAsAdminMock } from './helpers/auth.helper';

const fecha = '2026-09-28T12:00:00.000Z';
const planManual = {
  id: 42,
  identificador: 'Plan personal QA',
  descripcion: 'Adaptación individual',
  ano: 2026,
  mes: 9,
  estado: 'BORRADOR',
  updatedAt: fecha,
  createdAt: fecha,
  relevancia: ['MADRID'],
  tipoDePlanificacion: 'FRANJA_CUATRO_A_SEIS_HORAS',
  esPorDefecto: false,
  varianteBorradorId: null,
  variantesAutoasignacion: [],
  subBloques: [
    {
      id: 501,
      nombre: 'Estudio individual',
      horaInicio: '2026-09-28T08:00:00.000Z',
      duracion: 60,
      color: '#e65b40',
      realizado: false,
      esEntrenamientoFisico: false,
    },
  ],
  bloques: [],
};

async function prepararAdmin(page: Page): Promise<void> {
  await loginAsAdminMock(page, userAdminFixture);
  await page.route('**/planificaciones/planificaciones-mensuales', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          planManual,
          {
            ...planManual,
            id: 43,
            identificador: 'Plan Madrid iniciación',
            estado: 'ARCHIVADA',
            varianteOrigenId: 3,
            varianteBorradorId: null,
          },
        ],
        pagination: { skip: 0, take: 10, count: 2 },
      }),
    }),
  );
}

async function guardarCapturaQa(page: Page, nombre: string): Promise<void> {
  const carpeta = process.env['QA_EVIDENCE_DIR'];
  if (!carpeta) return;
  mkdirSync(carpeta, { recursive: true });
  await page.waitForTimeout(250);
  await page.screenshot({ path: join(carpeta, nombre), fullPage: true });
}

for (const viewport of [
  { name: 'escritorio', width: 1440, height: 900 },
  { name: 'móvil', width: 375, height: 667 },
]) {
  test(`overview mensual unificado en ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    await prepararAdmin(page);
    await page.goto('/app/planificacion/planificacion-mensual');

    await expect(
      page.getByRole('button', { name: 'Crear plan personal' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Importar o publicar semanas/ }),
    ).toBeVisible();
    await expect(page.getByText('Plan personal QA')).toBeVisible();
    await expect(page.getByText('Plan Madrid iniciación')).toBeVisible();
    await expect(page.getByText('Automática', { exact: true })).toBeVisible();
    await expect(page.getByText('Personal', { exact: true })).toBeVisible();
    const buscador = page.getByRole('searchbox', {
      name: 'Buscar planificación',
    });
    await expect(buscador).toHaveValue('');
    await expect(buscador).toHaveAttribute('readonly', '');
    await buscador.focus();
    await expect(buscador).not.toHaveAttribute('readonly');
    await buscador.fill('Plan Madrid');
    await expect(buscador).toHaveValue('Plan Madrid');
    await buscador.fill('');
    await expect(page).toHaveURL(/searchTerm=$/);
    const layout = await page
      .locator('.monthly-row')
      .first()
      .evaluate((el) => ({
        direction: getComputedStyle(el).flexDirection,
        mainWidth:
          el.querySelector('.monthly-row__main')?.getBoundingClientRect()
            .width ?? 0,
        sideWidth:
          el.querySelector('.monthly-row__side')?.getBoundingClientRect()
            .width ?? 0,
        outerWidth: el.getBoundingClientRect().width,
      }));
    expect(layout.direction).toBe(viewport.width === 375 ? 'column' : 'row');
    expect(layout.sideWidth).toBeGreaterThan(
      viewport.width === 375 ? 300 : 220,
    );
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    expect(overflow).toBe(false);
    await guardarCapturaQa(page, `planificacion-overview-${viewport.name}.png`);
    await page.getByRole('button', { name: 'Crear plan personal' }).click();
    await expect(page).toHaveURL(/\/planificacion-mensual\/new$/);
    await expect(page.getByText(/NUEVO PLAN PERSONAL/)).toBeVisible();
  });
}

for (const viewport of [
  { name: 'escritorio', width: 1440, height: 900 },
  { name: 'móvil', width: 375, height: 667 },
]) {
  test(`crear plan personal abre la elección de alumno en ${viewport.name}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    await prepararAdmin(page);
    const creado = { ...planManual, id: 45, identificador: 'Plan QA nuevo' };
    let guardados = 0;
    await page.route('**/planificaciones/planificacion-mensual', (route) => {
      guardados++;
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(creado),
      });
    });
    await page.route(
      '**/planificaciones/planificaciones-mensuales/45',
      (route) =>
        route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify(creado),
        }),
    );
    await page.route('**/user/all', (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          data: [],
          pagination: { skip: 0, take: 10, count: 0 },
        }),
      }),
    );
    await page.goto('/app/planificacion/planificacion-mensual/new');
    await page.getByLabel('Identificador *').fill('Plan QA nuevo');
    await page.getByLabel('Descripción *').fill('Calendario individual');
    await page.getByRole('button', { name: 'Guardar y elegir alumno' }).click();
    await expect(page).toHaveURL(/planificacion-mensual\/45$/);
    await expect(
      page.getByRole('dialog', { name: 'Asignar plan personal' }),
    ).toBeVisible();
    await expect(page.getByText('Por defecto', { exact: true })).toHaveCount(0);
    expect(guardados).toBe(1);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
    await page.waitForTimeout(300);
    await page.screenshot({
      path: testInfo.outputPath(`plan-personal-nuevo-${viewport.width}.png`),
    });
  });
}

test('la acción de copiar crea un plan personal y no abre la fila original', async ({
  page,
}) => {
  await prepararAdmin(page);
  let solicitudes = 0;
  await page.route(
    '**/planificaciones/planificacion-mensual/43/clonar-manual',
    (route) => {
      solicitudes += 1;
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          nuevaPlanificacion: {
            ...planManual,
            id: 44,
            identificador: 'Plan Madrid iniciación-PERSONAL',
          },
        }),
      });
    },
  );
  await page.route('**/planificaciones/planificaciones-mensuales/44', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        ...planManual,
        id: 44,
        identificador: 'Plan Madrid iniciación-PERSONAL',
      }),
    }),
  );
  await page.goto('/app/planificacion/planificacion-mensual');
  await page
    .getByRole('button', { name: 'Crear una copia personal independiente' })
    .last()
    .click();
  await expect(page).toHaveURL(/\/planificacion-mensual\/44$/);
  expect(solicitudes).toBe(1);
});

for (const viewport of [
  { name: 'escritorio', width: 1440, height: 900 },
  { name: 'móvil', width: 375, height: 667 },
]) {
  test(`asignación manual en ${viewport.name} exige elegir alumno y confirmar`, async ({
    page,
  }) => {
    const conAutomatica = viewport.width !== 375;
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    await prepararAdmin(page);
    await page.route(
      '**/planificaciones/planificaciones-mensuales/42',
      (route) =>
        route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify(planManual),
        }),
    );
    await page.route('**/user/all', (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 140,
              email: 'alumno-qa@example.test',
              nombre: 'Alumno',
              apellidos: 'QA',
              rol: 'ALUMNO',
              validated: true,
              suscripciones: [
                { tipo: 'ADVANCED', status: 'ACTIVE', oposicion: 'MADRID' },
              ],
              createdAt: fecha,
              updatedAt: fecha,
            },
          ],
          pagination: { skip: 0, take: 10, count: 1 },
        }),
      }),
    );
    await page.route(
      '**/planificaciones/admin/alumnos/140/plan-manual',
      (route) =>
        route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            alumno: {
              id: 140,
              nombre: 'Alumno',
              apellidos: 'QA',
              email: 'alumno-qa@example.test',
            },
            automatica: conAutomatica
              ? {
                  id: 30,
                  identificador: 'Plan Madrid vigente',
                  estado: 'PUBLICADA',
                }
              : null,
            configuracion: conAutomatica
              ? { id: 5, version: 1, planificacionMensualId: 30 }
              : null,
            manual: null,
          }),
        }),
    );
    let publicaciones = 0;
    await page.route(
      '**/planificaciones/planificacion-mensual/42/publicar-manual',
      (route) => {
        publicaciones++;
        expect(route.request().postDataJSON()).toEqual({
          alumnoId: 140,
          motivo: 'Necesita una adaptación individual',
          versionExcepcion: 0,
          fechaPlanEsperada: fecha,
          configuracionIdEsperada: conAutomatica ? 5 : 0,
          versionConfiguracionEsperada: conAutomatica ? 1 : 0,
          planificacionAutomaticaEsperadaId: conAutomatica ? 30 : 0,
        });
        return route.fulfill({ contentType: 'application/json', body: '{}' });
      },
    );

    await page.goto('/app/planificacion/planificacion-mensual/42');
    await page.getByRole('button', { name: 'Asignar a un alumno' }).click();
    const dialogo = page.getByRole('dialog', { name: 'Asignar plan personal' });
    await expect(dialogo).toContainText('Paso 1 de 2');
    await guardarCapturaQa(
      page,
      `planificacion-manual-${viewport.name}-paso-1.png`,
    );
    await expect(
      dialogo.getByRole('button', { name: 'Continuar' }),
    ).toBeDisabled();
    await dialogo.getByText('alumno-qa@example.test').first().click();
    await expect(
      dialogo.getByRole('button', { name: 'Continuar' }),
    ).toBeEnabled();
    await dialogo.getByRole('button', { name: 'Continuar' }).click();
    await expect(dialogo).toContainText('Paso 2 de 2');
    await expect(dialogo).toContainText(
      conAutomatica ? 'Plan Madrid vigente' : 'Aún no configurado',
    );
    await guardarCapturaQa(
      page,
      `planificacion-manual-${viewport.name}-paso-2.png`,
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      ),
    ).toBe(false);
    await dialogo
      .locator('#motivo-plan-manual')
      .fill('Necesita una adaptación individual');
    await dialogo
      .getByRole('button', { name: 'Publicar y asignar a este alumno' })
      .click();
    await expect.poll(() => publicaciones).toBe(1);
  });
}
