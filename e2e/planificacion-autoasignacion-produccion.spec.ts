import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { loginAsRoleMock } from './helpers/auth.helper';
import userAlumnoFixture from './fixtures/user-alumno.json';

const planAnterior = { id: 199, identificador: 'PAVA6-8H', mes: 9, ano: 2026 };
const planNuevo = { id: 203, identificador: 'PAVA4-6H', mes: 10, ano: 2026 };
const opcion = {
  varianteId: 10,
  codigo: 'AYVA4-6',
  oposicion: 'VALENCIA_AYUNTAMIENTO',
  nivel: 'AVANZADO',
  franja: 'FRANJA_CUATRO_A_SEIS_HORAS',
  planificacionMensualId: planNuevo.id,
  planificacionMensual: planNuevo,
};
const cuestionario = {
  version: 2,
  preguntas: Array.from({ length: 5 }, (_, i) => ({
    id: `nivel-${i + 1}`,
    texto: `Pregunta de nivel ${i + 1}`,
    opciones: Array.from({ length: 4 }, (_, valor) => ({
      valor,
      etiqueta: `Respuesta ${valor + 1}`,
    })),
  })),
};

function estado(plan = planAnterior) {
  return {
    estado: plan.id === planNuevo.id ? 'ACTIVA' : 'REQUIERE_CONFIGURACION',
    oposicionesPermitidas: ['VALENCIA_AYUNTAMIENTO'],
    disponibilidadOposiciones: [
      { oposicion: 'VALENCIA_AYUNTAMIENTO', estado: 'DISPONIBLE' },
    ],
    opcionesPermitidas: [opcion],
    preferenciasPrecargadas: {
      oposicion: 'VALENCIA_AYUNTAMIENTO',
      nivel: null,
      franja: null,
    },
    configuracionActiva:
      plan.id === planNuevo.id
        ? {
            variante: opcion,
            version: 1,
            planificacionMensualId: planNuevo.id,
            planificacionMensual: planNuevo,
            origen: 'ALUMNO',
            fechaVigencia: '2026-10-01T00:00:00Z',
          }
        : null,
    planActual: plan,
    planesPrevios:
      plan.id === planNuevo.id ? [planAnterior, planNuevo] : [planAnterior],
    planificacionManual: null,
    estadoPrevioHash: 'a'.repeat(64),
    estadoTest: null,
    ultimaRecomendacion: null,
  };
}

async function mockPlanificacion(page: Page) {
  let actual = estado();
  let guardado: Record<string, unknown> | null = null;
  const json = (body: unknown) => ({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
  await page.route('**/planificaciones/configuracion', async (route) => {
    if (route.request().method() === 'PUT') {
      guardado = route.request().postDataJSON();
      actual = estado(planNuevo);
      return route.fulfill(json(actual));
    }
    return route.fulfill(json(actual));
  });
  await page.route('**/planificaciones/cuestionario-nivel', (route) =>
    route.fulfill(json(cuestionario)),
  );
  await page.route('**/planificaciones/recomendacion-nivel', (route) =>
    route.fulfill(
      json({
        versionCuestionario: 2,
        puntuacion: 15,
        nivelRecomendado: 'AVANZADO',
      }),
    ),
  );
  await page.route(
    '**/planificaciones/planificaciones-mensuales/*',
    (route) => {
      const id = Number(
        new URL(route.request().url()).pathname.split('/').at(-1),
      );
      const plan = id === planNuevo.id ? planNuevo : planAnterior;
      return route.fulfill(
        json({
          ...plan,
          relevancia: [],
          esPorDefecto: false,
          tipoDePlanificacion: 'FRANJA_CUATRO_A_SEIS_HORAS',
          subBloques: [],
        }),
      );
    },
  );
  await page.route('**/planificaciones/eventos-personalizados/*', (route) =>
    route.fulfill(json([])),
  );
  await page.route('**/planificacion-fisica/resumen-dias**', (route) =>
    route.fulfill(json([])),
  );
  return { guardado: () => guardado };
}

async function captura(page: Page, nombre: string) {
  const directorio = process.env['AUTOASSIGN_QA_DIR'];
  if (!directorio) return;
  mkdirSync(directorio, { recursive: true });
  await page.screenshot({ path: join(directorio, nombre), fullPage: true });
}

async function loginAlumnoConPlanificacion(page: Page) {
  await loginAsRoleMock(page, {
    rol: 'ALUMNO',
    email: userAlumnoFixture.email,
    userFixture: {
      ...userAlumnoFixture,
      suscripciones: userAlumnoFixture.suscripciones.map((suscripcion) => ({
        ...suscripcion,
        tipo: 'ADVANCED',
      })),
    },
  });
}

test('el alumno sustituye explícitamente su plan existente tras el cuestionario', async ({
  page,
}) => {
  const api = await mockPlanificacion(page);
  await loginAlumnoConPlanificacion(page);
  await page.goto('/app/planificacion/configuracion-alumno');
  await expect(
    page.getByText('Ya tienes una planificación en curso.'),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Ver mi calendario' }),
  ).toHaveAttribute('href', /\/199$/);
  await captura(page, '01-plan-actual-desktop.png');
  await page.getByRole('button', { name: 'Cambiar mi planificación' }).click();
  await expect(
    page.getByRole('button', { name: /Plan específico/ }),
  ).toBeVisible();
  await page.locator('#wizardPreferenciasFranja').click();
  await page.getByRole('option', { name: /4-6/ }).click();
  await page.getByRole('button', { name: 'Continuar' }).first().click();
  await page.getByRole('button', { name: 'Hacer test de nivel' }).click();
  for (let i = 0; i < 5; i++) {
    await page.locator(`label[for="preguntaNivel${i}opcion3"]`).click();
  }
  await page.getByRole('button', { name: 'Obtener recomendación' }).click();
  await expect(page.getByText(/Te recomendamos el nivel/)).toBeVisible();
  await page.getByRole('button', { name: 'Aceptar recomendación' }).click();
  await page.getByRole('button', { name: 'Continuar' }).last().click();
  await expect(
    page.getByText(/Tu progreso anterior se conserva/),
  ).toBeVisible();
  await expect(
    page.getByText('Ya tienes una planificación en curso.'),
  ).toBeVisible();
  await captura(page, '02-confirmacion-desktop.png');
  await expect(
    page.getByRole('button', { name: 'Confirmar planificación' }),
  ).toBeDisabled();
  await page.locator('label[for="confirmarReemplazoPlan"]').click();
  await page.getByRole('button', { name: 'Confirmar planificación' }).click();
  await expect(page).toHaveURL(
    /\/app\/planificacion\/planificacion-mensual-alumno\/203$/,
  );
  await expect(page.locator('app-vista-semanal')).toBeVisible();
  expect(api.guardado()).toMatchObject({
    oposicion: 'VALENCIA_AYUNTAMIENTO',
    nivel: 'AVANZADO',
    franja: 'FRANJA_CUATRO_A_SEIS_HORAS',
    planificacionIdEsperada: 203,
    confirmarReemplazo: true,
    respuestasTest: [3, 3, 3, 3, 3],
    versionCuestionario: 2,
  });
  await captura(page, '03-plan-nuevo-desktop.png');
});

test('el asistente cabe en 375 px y no guarda al cancelar', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 667 });
  const api = await mockPlanificacion(page);
  await loginAlumnoConPlanificacion(page);
  await page.goto('/app/planificacion/configuracion-alumno');
  await page.getByRole('button', { name: 'Cambiar mi planificación' }).click();
  await expect(
    page.getByRole('button', { name: /Plan específico/ }),
  ).toBeVisible();
  await captura(page, '04-asistente-movil.png');
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(overflow).toBe(false);
  await page.getByRole('button', { name: 'Cancelar' }).first().click();
  await expect(
    page.getByRole('link', { name: 'Ver mi calendario' }),
  ).toHaveAttribute('href', /\/199$/);
  expect(api.guardado()).toBeNull();

  await page.getByRole('button', { name: 'Cambiar mi planificación' }).click();
  await page.locator('#wizardPreferenciasFranja').click();
  await page.getByRole('option', { name: /4-6/ }).click();
  await page.getByRole('button', { name: 'Continuar' }).first().click();
  await page.locator('#wizardNivel').click();
  await page.getByRole('option', { name: 'Avanzado' }).click();
  await page.getByRole('button', { name: 'Continuar' }).last().click();
  await expect(
    page.getByText(/Tu progreso anterior se conserva/),
  ).toBeVisible();
  await captura(page, '05-confirmacion-movil.png');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    ),
  ).toBe(false);
  await page.locator('label[for="confirmarReemplazoPlan"]').click();
  await page.getByRole('button', { name: 'Confirmar planificación' }).click();
  await expect(page).toHaveURL(
    /\/app\/planificacion\/planificacion-mensual-alumno\/203$/,
  );
  await expect(page.locator('app-vista-semanal')).toBeVisible();
  await captura(page, '06-plan-nuevo-movil.png');
});
