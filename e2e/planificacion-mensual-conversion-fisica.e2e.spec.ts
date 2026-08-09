import { expect, test } from '@playwright/test';
import userAdminFixture from './fixtures/user-admin.json';
import { loginAsAdminMock } from './helpers/auth.helper';

const PLANIFICACION_ID = 199;

const planificacion = {
  id: PLANIFICACION_ID,
  identificador: 'PLAN-FISICA-199',
  descripcion: 'Planificación para normalizar física',
  ano: 2026,
  mes: 8,
  relevancia: [],
  esPorDefecto: false,
  tipoDePlanificacion: 'FRANJA_CUATRO_A_SEIS_HORAS',
  subBloques: [
    {
      id: 901,
      nombre: 'ENTRENAMIENTO',
      horaInicio: '2026-08-03T08:00:00.000Z',
      duracion: 60,
      color: '#f8c471',
      realizado: false,
      esEntrenamientoFisico: true,
    },
  ],
};

test('admin confirma la normalización de física y el editor recarga el plan', async ({
  page,
}) => {
  let cargasPlan = 0;
  let conversiones = 0;

  await loginAsAdminMock(page, userAdminFixture);

  await page.route(
    `**/planificaciones/planificaciones-mensuales/${PLANIFICACION_ID}`,
    (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      cargasPlan++;
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(planificacion),
      });
    },
  );
  await page.route(
    `**/planificaciones/planificacion-mensual/${PLANIFICACION_ID}/convertir-bloques-fisica`,
    (route) => {
      expect(route.request().method()).toBe('POST');
      expect(route.request().postDataJSON()).toEqual({});
      conversiones++;
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          actualizados: 0,
          ignorados: 1,
          sinCoincidencia: 0,
          desmarcados: 2,
        }),
      });
    },
  );

  await page.goto(
    `/app/planificacion/planificacion-mensual/${PLANIFICACION_ID}`,
  );
  await expect(page.locator('p-speeddial .p-speeddial-button')).toBeVisible();

  await page.locator('p-speeddial .p-speeddial-button').click();
  // PrimeNG SpeedDial no expone el tooltip como nombre accesible: el icono es
  // el selector estable de la acción de física.
  await page.locator('.p-speeddial-action:has(.pi-bolt)').click();

  const dialogo = page.getByRole('alertdialog', {
    name: 'Convertir bloques a física',
  });
  await expect(dialogo).toContainText(
    'se conservará uno y los demás se desvincularán',
  );
  await dialogo.getByRole('button', { name: 'Convertir' }).click();

  await expect(page.locator('.toast-success')).toContainText(
    'Se normalizaron 2 duplicados',
  );
  await expect.poll(() => conversiones).toBe(1);
  await expect.poll(() => cargasPlan).toBe(2);
});
