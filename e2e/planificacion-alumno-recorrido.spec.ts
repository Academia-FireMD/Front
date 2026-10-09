import { expect, test, type Page } from '@playwright/test';
import { loginAsRoleMock } from './helpers/auth.helper';

const PLAN_ANTERIOR = {
  id: 199,
  identificador: 'PLAN-ANTERIOR',
  mes: 9,
  ano: 2026,
};
const PLAN_NUEVO = { id: 203, identificador: 'PLAN-NUEVO', mes: 10, ano: 2026 };
const HASH_PREVIO = 'a'.repeat(64);
const variante = {
  varianteId: 10,
  codigo: 'AYVA4-6',
  oposicion: 'VALENCIA_AYUNTAMIENTO',
  nivel: 'AVANZADO',
  franja: 'FRANJA_CUATRO_A_SEIS_HORAS',
  planificacionMensualId: PLAN_NUEVO.id,
  planificacionMensual: PLAN_NUEVO,
};
const inicio = new Date();
inicio.setHours(12, 0, 0, 0);

function configuracionActiva(plan = PLAN_ANTERIOR) {
  return {
    estado: 'ACTIVA',
    oposicionesPermitidas: ['VALENCIA_AYUNTAMIENTO'],
    disponibilidadOposiciones: [
      { oposicion: 'VALENCIA_AYUNTAMIENTO', estado: 'DISPONIBLE' },
    ],
    opcionesPermitidas: [variante],
    preferenciasPrecargadas: {
      oposicion: 'VALENCIA_AYUNTAMIENTO',
      nivel: 'AVANZADO',
      franja: 'FRANJA_CUATRO_A_SEIS_HORAS',
    },
    configuracionActiva: {
      variante: {
        ...variante,
        planificacionMensualId: PLAN_ANTERIOR.id,
        planificacionMensual: PLAN_ANTERIOR,
      },
      version: plan.id === PLAN_ANTERIOR.id ? 4 : 5,
      planificacionMensualId: plan.id,
      planificacionMensual: plan,
      origen: 'ALUMNO',
      fechaVigencia: '2026-09-01T00:00:00Z',
    },
    planActual: plan,
    planesPrevios: [PLAN_ANTERIOR, PLAN_NUEVO],
    planificacionManual: null,
    estadoPrevioHash:
      plan.id === PLAN_ANTERIOR.id ? HASH_PREVIO : 'b'.repeat(64),
    estadoTest: null,
    ultimaRecomendacion: null,
  };
}

async function mockRecorrido(page: Page) {
  let actual = configuracionActiva();
  const guardados: Array<Record<string, unknown>> = [];
  const json = (body: unknown, status = 200) => ({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });

  await page.route('**/planificaciones/configuracion', async (route) => {
    if (route.request().method() === 'PUT') {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      guardados.push(body);
      actual = configuracionActiva(PLAN_NUEVO);
      return route.fulfill(json(actual));
    }
    return route.fulfill(json(actual));
  });
  await page.route(
    '**/planificaciones/planificaciones-mensuales/*',
    (route) => {
      const id = Number(
        new URL(route.request().url()).pathname.split('/').at(-1),
      );
      const plan = id === PLAN_NUEVO.id ? PLAN_NUEVO : PLAN_ANTERIOR;
      return route.fulfill(
        json({
          ...plan,
          relevancia: [],
          esPorDefecto: false,
          tipoDePlanificacion: 'FRANJA_CUATRO_A_SEIS_HORAS',
          subBloques: [
            {
              id: 2991,
              planificacionId: plan.id,
              nombre: 'ENTRENAMIENTO físico y estudio de resistencia',
              horaInicio: inicio.toISOString(),
              duracion: 60,
              color: '#f59e0b',
              comentarios: 'Progreso previo conservado',
              realizado: true,
              esEntrenamientoFisico: true,
            },
          ],
        }),
      );
    },
  );
  await page.route(
    `**/planificaciones/eventos-personalizados/${PLAN_ANTERIOR.id}`,
    (route) => route.fulfill(json([])),
  );
  await page.route(
    `**/planificaciones/eventos-personalizados/${PLAN_NUEVO.id}`,
    (route) => route.fulfill(json([])),
  );
  await page.route('**/planificacion-fisica/resumen-dias**', (route) =>
    route.fulfill(json([])),
  );
  await page.route('**/planificaciones/cuestionario-nivel', (route) =>
    route.fulfill(json({ version: 2, preguntas: [] })),
  );

  await loginAsRoleMock(page, {
    rol: 'ALUMNO',
    email: 'alumno@test.com',
    userFixture: {
      id: 1,
      email: 'alumno@test.com',
      nombre: 'Test',
      apellidos: 'Alumno',
      rol: 'ALUMNO',
      validated: true,
      onboardingCompletado: true,
      oposiciones: [],
      suscripciones: [{ id: 1, tipo: 'PREMIUM', status: 'ACTIVE' }],
    },
  });
  return { guardados };
}

async function abrirWizardDesdeCalendario(page: Page, planId: number) {
  await page.goto('/app/planificacion/configuracion-alumno');
  await expect(page).toHaveURL(
    new RegExp(`/app/planificacion/planificacion-mensual-alumno/${planId}$`),
  );
  await expect(page.locator('app-vista-semanal')).toBeVisible();
  const progreso = page.getByTestId('completion-toggle');
  await expect(progreso).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('button', { name: 'Cambiar mi planificación' }).click();
  await expect(page).toHaveURL(/configuracion-alumno\?modo=cambiar/);
  await expect(
    page.getByRole('button', { name: /Plan específico/ }),
  ).toBeVisible();
  return progreso;
}

test('plan activo abre el calendario; cancelar el cambio vuelve sin tocar progreso ni guardar', async ({
  page,
}) => {
  const api = await mockRecorrido(page);
  const progreso = await abrirWizardDesdeCalendario(page, PLAN_ANTERIOR.id);

  await page.getByRole('button', { name: 'Cancelar' }).first().click();
  await expect(page).toHaveURL(
    new RegExp(
      `/app/planificacion/planificacion-mensual-alumno/${PLAN_ANTERIOR.id}$`,
    ),
  );
  await expect(page.getByTestId('completion-toggle')).toHaveAttribute(
    'aria-checked',
    'true',
  );
  expect(api.guardados).toHaveLength(0);
  await expect(progreso).toHaveAttribute('aria-checked', 'true');
});

test('confirmar cambio usa versión/hash actuales y conserva la marca del calendario', async ({
  page,
}) => {
  const api = await mockRecorrido(page);
  await abrirWizardDesdeCalendario(page, PLAN_ANTERIOR.id);

  await page.getByRole('button', { name: 'Continuar' }).first().click();
  await page.locator('#wizardNivel').click();
  await page.getByRole('option', { name: 'Avanzado' }).click();
  await page.getByRole('button', { name: 'Continuar' }).last().click();
  await expect(
    page.getByText(/Tu progreso anterior se conserva/),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Confirmar planificación' }),
  ).toBeDisabled();
  await page.locator('label[for="confirmarReemplazoPlan"]').click();
  await page.getByRole('button', { name: 'Confirmar planificación' }).click();

  await expect(page).toHaveURL(
    new RegExp(
      `/app/planificacion/planificacion-mensual-alumno/${PLAN_NUEVO.id}$`,
    ),
  );
  await expect(page.getByTestId('completion-toggle')).toHaveAttribute(
    'aria-checked',
    'true',
  );
  expect(api.guardados).toHaveLength(1);
  expect(api.guardados[0]).toMatchObject({
    version: 4,
    planificacionIdEsperada: PLAN_NUEVO.id,
    estadoPrevioHash: HASH_PREVIO,
    confirmarReemplazo: true,
    oposicion: 'VALENCIA_AYUNTAMIENTO',
    nivel: 'AVANZADO',
    franja: 'FRANJA_CUATRO_A_SEIS_HORAS',
  });
});
