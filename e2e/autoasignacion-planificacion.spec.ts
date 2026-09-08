import { expect, test } from '@playwright/test';
import userAlumnoFixture from './fixtures/user-alumno.json';
import { loginAsRoleMock } from './helpers/auth.helper';

const alumnoConPlan = {
  ...userAlumnoFixture,
  suscripciones: [
    {
      ...userAlumnoFixture.suscripciones[0],
      tipo: 'ADVANCED',
    },
  ],
};

const configuracionActiva = {
  estado: 'ACTIVA',
  preferenciasPrecargadas: {
    oposicion: 'GENERAL',
    nivel: 'AVANZADO',
    franja: 'FRANJA_CUATRO_A_SEIS_HORAS',
  },
  oposicionesPermitidas: ['GENERAL'],
  configuracionActiva: {
    variante: {
      id: 11,
      codigo: 'GA4-6',
      oposicion: 'GENERAL',
      nivel: 'AVANZADO',
      franja: 'FRANJA_CUATRO_A_SEIS_HORAS',
    },
    planificacionMensual: {
      id: 321,
      identificador: 'AGOSTO-GA4-6',
      mes: 8,
      ano: 2026,
    },
    version: 1,
    fechaVigencia: '2026-08-20T00:00:00.000Z',
    origen: 'ALUMNO',
  },
  ultimaRecomendacion: null,
};

const configuracionInicial = {
  estado: 'REQUIERE_CONFIGURACION',
  preferenciasPrecargadas: {
    oposicion: null,
    nivel: null,
    franja: null,
  },
  oposicionesPermitidas: ['MADRID'],
  configuracionActiva: null,
  ultimaRecomendacion: null,
};

const cuestionarioNivel = {
  version: 1,
  preguntas: [
    '¿Cuánto tiempo llevas estudiando el temario?',
    '¿Cómo valoras tu dominio actual del temario?',
    '¿Has aprobado algún examen o parcial recientemente?',
    '¿Cuántas horas a la semana dedicas al estudio?',
    '¿Cómo te sientes con los simulacros y tests?',
  ].map((texto, indice) => ({
    id: `nivel-${indice + 1}`,
    texto,
    opciones: [
      { valor: 0, etiqueta: 'Nada' },
      { valor: 1, etiqueta: 'Poco' },
      { valor: 2, etiqueta: 'Algo' },
      { valor: 3, etiqueta: 'Mucho' },
    ],
  })),
};

async function loginAlumno(page: Parameters<typeof loginAsRoleMock>[0]) {
  await page.route('**/planificaciones/cuestionario-nivel', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(cuestionarioNivel),
    }),
  );
  await loginAsRoleMock(page, {
    rol: 'ALUMNO',
    email: 'alumno-plan@test.com',
    userFixture: alumnoConPlan,
    modulos: { PLANIFICACION_AUTOASIGNACION: true },
  });
}

test('shell activo enlaza directamente al plan mensual canónico', async ({
  page,
}) => {
  await page.route('**/planificaciones/configuracion', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(configuracionActiva),
    }),
  );
  await page.route(
    '**/planificaciones/planificaciones-mensuales/321',
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 321, identificador: 'AGOSTO-GA4-6' }),
      }),
  );

  await loginAlumno(page);
  await page.goto('/app/planificacion/configuracion-alumno');

  await expect(page).toHaveURL(/planificacion-mensual-alumno\/321$/);
});

test('shell pendiente de publicación no obliga a repetir preferencias', async ({
  page,
}) => {
  await page.route('**/planificaciones/configuracion', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ...configuracionActiva,
        estado: 'PENDIENTE_PUBLICACION',
        configuracionActiva: {
          ...configuracionActiva.configuracionActiva,
          planificacionMensual: null,
        },
      }),
    }),
  );

  await loginAlumno(page);
  await page.goto('/app/planificacion/configuracion-alumno');

  await expect(
    page.getByText('Tu planificación está pendiente de publicación'),
  ).toBeVisible();
  await expect(page.getByText('No necesitas repetir tus datos')).toBeVisible();
  await page.getByRole('button', { name: 'Cambiar preferencias' }).click();
  await expect(
    page.getByRole('heading', { name: 'Tu planificación', exact: true }),
  ).toBeVisible();
  await expect(page.locator('#wizardPreferenciasOposicion')).toContainText(
    'General',
  );
  await expect(page.locator('#wizardPreferenciasFranja')).toContainText(
    '4-6 Horas',
  );
});

test('primera entrada permite completar wizard, activar version 0 y abrir calendario', async ({
  page,
}) => {
  let lecturasConfiguracion = 0;
  await page.route('**/planificaciones/configuracion', (route) => {
    if (route.request().method() === 'PUT') {
      expect(route.request().postDataJSON()).toEqual({
        oposicion: 'MADRID',
        nivel: 'AVANZADO',
        franja: 'FRANJA_CUATRO_A_SEIS_HORAS',
        version: 0,
      });
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(configuracionActiva),
      });
    }
    lecturasConfiguracion++;
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        lecturasConfiguracion === 1
          ? configuracionInicial
          : configuracionActiva,
      ),
    });
  });
  await page.route('**/planificaciones/recomendacion-nivel', (route) => {
    expect(route.request().method()).toBe('POST');
    expect(route.request().postDataJSON()).toEqual({
      respuestas: [2, 2, 2, 2, 2],
      versionCuestionario: 1,
    });
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ puntuacion: 12, nivelRecomendado: 'AVANZADO' }),
    });
  });
  await page.route(
    '**/planificaciones/planificaciones-mensuales/321',
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 321, identificador: 'AGOSTO-GA4-6' }),
      }),
  );

  await loginAlumno(page);
  await page.goto('/app/planificacion/configuracion-alumno');

  const oposicion = page.locator('#wizardPreferenciasOposicion');
  await oposicion.click();
  await page.locator('.p-dropdown-panel').last().getByText('Madrid').click();
  const franja = page.locator('#wizardPreferenciasFranja');
  await franja.click();
  await page.locator('.p-dropdown-panel').last().getByText('4-6 horas').click();
  await page.getByRole('button', { name: 'Continuar' }).click();

  // El cuestionario no tiene defaults: responde las cinco preguntas con
  // opciones reales antes de pedir la recomendación.
  const respuestas = page.locator('.p-radiobutton-box');
  for (let pregunta = 0; pregunta < 5; pregunta++) {
    await respuestas.nth(pregunta * 4 + 2).click();
  }
  const screenshotPath = process.env['AUTOASSIGN_SCREENSHOT_PATH'];
  if (screenshotPath) {
    await page.locator('app-planificacion-configuracion-wizard').screenshot({
      path: screenshotPath,
    });
  }
  await page.getByRole('button', { name: 'Obtener recomendación' }).click();
  await page.getByRole('button', { name: 'Aceptar recomendación' }).click();
  await page.getByRole('button', { name: 'Activar planificación' }).click();

  await expect(page).toHaveURL(/planificacion-mensual-alumno\/321$/);
});
