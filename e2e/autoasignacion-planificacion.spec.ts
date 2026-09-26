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
  disponibilidadOposiciones: [{ oposicion: 'GENERAL', estado: 'DISPONIBLE' }],
  opcionesPermitidas: [
    {
      oposicion: 'GENERAL',
      nivel: 'AVANZADO',
      franja: 'FRANJA_CUATRO_A_SEIS_HORAS',
      varianteId: 11,
      planificacionMensual: {
        id: 321,
        identificador: 'AGOSTO-PGCVA4-6H',
        mes: 8,
        ano: 2026,
      },
    },
  ],
  configuracionActiva: {
    variante: {
      id: 11,
      codigo: 'PGCVA4-6H',
      oposicion: 'GENERAL',
      nivel: 'AVANZADO',
      franja: 'FRANJA_CUATRO_A_SEIS_HORAS',
    },
    planificacionMensual: {
      id: 321,
      identificador: 'AGOSTO-PGCVA4-6H',
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
  disponibilidadOposiciones: [{ oposicion: 'MADRID', estado: 'DISPONIBLE' }],
  opcionesPermitidas: [
    {
      oposicion: 'MADRID',
      nivel: 'AVANZADO',
      franja: 'FRANJA_CUATRO_A_SEIS_HORAS',
      varianteId: 12,
      planificacionMensual: {
        id: 321,
        identificador: 'AGOSTO-PCMA4-6H',
        mes: 8,
        ano: 2026,
      },
    },
  ],
  configuracionActiva: null,
  ultimaRecomendacion: null,
};

const configuracionVariasOposiciones = {
  ...configuracionInicial,
  oposicionesPermitidas: [
    'GENERAL',
    'VALENCIA_AYUNTAMIENTO',
    'ALICANTE_CPBA',
    'MADRID',
  ],
  disponibilidadOposiciones: [
    { oposicion: 'GENERAL', estado: 'DISPONIBLE' },
    { oposicion: 'VALENCIA_AYUNTAMIENTO', estado: 'DISPONIBLE' },
    { oposicion: 'ALICANTE_CPBA', estado: 'DISPONIBLE' },
    { oposicion: 'MADRID', estado: 'DISPONIBLE' },
  ],
  opcionesPermitidas: [
    ...configuracionInicial.opcionesPermitidas,
    {
      ...configuracionInicial.opcionesPermitidas[0],
      oposicion: 'GENERAL',
      varianteId: 13,
    },
    {
      ...configuracionInicial.opcionesPermitidas[0],
      oposicion: 'VALENCIA_AYUNTAMIENTO',
      varianteId: 14,
    },
    {
      ...configuracionInicial.opcionesPermitidas[0],
      oposicion: 'ALICANTE_CPBA',
      varianteId: 15,
    },
  ],
};

const cuestionarioNivel = {
  // El Front consume el contrato dinámico; no debe fijar la versión ni el copy.
  version: 42,
  preguntas: Array.from({ length: 5 }, (_, indice) => ({
    id: `nivel-${indice + 1}`,
    texto: `Pregunta dinámica ${indice + 1} con un enunciado suficientemente largo`,
    opciones: [
      { valor: 0, etiqueta: 'Respuesta dinámica cero' },
      { valor: 1, etiqueta: 'Respuesta dinámica uno' },
      {
        valor: 2,
        etiqueta:
          'Respuesta dinámica dos suficientemente larga para validar el ajuste responsive',
      },
      { valor: 3, etiqueta: 'Respuesta dinámica tres' },
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
  await page.route('**/adjuntos/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  );
  await page.route('**/planificaciones/eventos-personalizados/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  );
  await loginAsRoleMock(page, {
    rol: 'ALUMNO',
    email: 'alumno-plan@test.com',
    userFixture: alumnoConPlan,
    modulos: {
      PLANIFICACION_AUTOASIGNACION: true,
      PLANIFICACION_FISICA: false,
    },
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
        body: JSON.stringify({ id: 321, identificador: 'AGOSTO-PGCVA4-6H' }),
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
    'General Comunidad Valenciana',
  );
  await expect(page.locator('#wizardPreferenciasFranja')).toContainText(
    '4-6 Horas',
  );
});

test('el asistente usa el selector compartido con semántica de planificación', async ({
  page,
}) => {
  await page.route('**/planificaciones/configuracion', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(configuracionVariasOposiciones),
    }),
  );

  await loginAlumno(page);
  await page.goto('/app/planificacion/configuracion-alumno');

  await expect(page.locator('#wizardPreferenciasOposicion')).toHaveAttribute(
    'aria-label',
    'Oposición. Solo se muestran las oposiciones incluidas en tus suscripciones activas.',
  );
  await expect(
    page.getByText(
      'Solo se muestran las oposiciones incluidas en tus suscripciones activas.',
    ),
  ).toBeVisible();
  await page.locator('#wizardPreferenciasOposicion').click();

  for (const opcion of [
    'General Comunidad Valenciana',
    'Ayuntamiento de Valencia',
    'Consorcio de Alicante',
    'Comunidad de Madrid',
  ]) {
    await expect(page.getByRole('option', { name: opcion })).toBeVisible();
  }
  await expect(
    page.getByRole('option', { name: 'Todas las oposiciones' }),
  ).toHaveCount(0);
});

test('primera entrada permite completar wizard, activar version 0 y abrir calendario', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let configuracionConfirmada = false;
  await page.route('**/planificaciones/configuracion', (route) => {
    if (route.request().method() === 'PUT') {
      expect(route.request().postDataJSON()).toEqual({
        oposicion: 'MADRID',
        nivel: 'AVANZADO',
        franja: 'FRANJA_CUATRO_A_SEIS_HORAS',
        version: 0,
      });
      configuracionConfirmada = true;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(configuracionActiva),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        configuracionConfirmada ? configuracionActiva : configuracionInicial,
      ),
    });
  });
  await page.route('**/planificaciones/recomendacion-nivel', (route) => {
    expect(route.request().method()).toBe('POST');
    expect(route.request().postDataJSON()).toEqual({
      respuestas: [2, 2, 2, 2, 2],
      versionCuestionario: cuestionarioNivel.version,
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
        body: JSON.stringify({ id: 321, identificador: 'AGOSTO-PGCVA4-6H' }),
      }),
  );

  await loginAlumno(page);
  await page.goto('/app/planificacion/configuracion-alumno');

  const oposicion = page.locator('#wizardPreferenciasOposicion');
  const franja = page.locator('#wizardPreferenciasFranja');
  await expect(oposicion).toHaveAttribute('role', 'combobox');
  const [oposicionBox, franjaBox] = await Promise.all([
    oposicion.boundingBox(),
    franja.boundingBox(),
  ]);
  expect(oposicionBox).not.toBeNull();
  expect(franjaBox).not.toBeNull();
  expect(Math.abs(oposicionBox!.x - franjaBox!.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(oposicionBox!.width - franjaBox!.width)).toBeLessThanOrEqual(
    1,
  );
  expect(
    Math.abs(oposicionBox!.height - franjaBox!.height),
  ).toBeLessThanOrEqual(1);

  await oposicion.click();
  await page
    .getByRole('option', { name: 'Comunidad de Madrid', exact: true })
    .waitFor();
  await page
    .getByRole('option', { name: 'Comunidad de Madrid', exact: true })
    .click();
  await franja.click();
  await page.locator('.p-dropdown-panel').last().getByText('4-6 horas').click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(
    page.getByRole('heading', { name: 'Nivel de estudio' }),
  ).toBeVisible();

  const nav = page.locator('.p-stepper-nav');
  const confirmar = page.locator('.p-stepper-title', { hasText: 'Confirmar' });
  await expect(confirmar).toBeVisible();
  const [navBox, confirmarBox] = await Promise.all([
    nav.boundingBox(),
    confirmar.boundingBox(),
  ]);
  expect(navBox).not.toBeNull();
  expect(confirmarBox).not.toBeNull();
  expect(confirmarBox!.x + confirmarBox!.width).toBeLessThanOrEqual(
    navBox!.x + navBox!.width + 1,
  );
  const dimensiones = await page
    .locator('app-planificacion-configuracion-wizard')
    .evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
  expect(dimensiones.scrollWidth).toBeLessThanOrEqual(
    dimensiones.clientWidth + 1,
  );

  // El cuestionario no tiene defaults: responde las cinco preguntas con
  // opciones reales antes de pedir la recomendación.
  await page.getByRole('button', { name: 'Hacer test de nivel' }).click();
  await expect(page.getByText(/1\. Pregunta dinámica 1/)).toBeVisible();
  const [cuestionarioBox, obtenerRecomendacionBox] = await Promise.all([
    page.getByTestId('cuestionario-nivel').boundingBox(),
    page.getByRole('button', { name: 'Obtener recomendación' }).boundingBox(),
  ]);
  expect(cuestionarioBox).not.toBeNull();
  expect(obtenerRecomendacionBox).not.toBeNull();
  expect(
    Math.abs(cuestionarioBox!.width - obtenerRecomendacionBox!.width),
  ).toBeLessThanOrEqual(1);
  expect(obtenerRecomendacionBox!.height).toBeGreaterThanOrEqual(44);
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
  await expect(
    page.getByText('Te recomendamos el nivel Avanzado.'),
  ).toBeVisible();
  await expect(page.getByText(/puntuación/i)).toHaveCount(0);
  await page.getByRole('button', { name: 'Aceptar recomendación' }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(
    page.getByRole('heading', { name: 'Confirma tu planificación' }),
  ).toBeVisible();
  const [navConfirmacionBox, confirmarActivoBox] = await Promise.all([
    nav.boundingBox(),
    confirmar.boundingBox(),
  ]);
  expect(navConfirmacionBox).not.toBeNull();
  expect(confirmarActivoBox).not.toBeNull();
  expect(confirmarActivoBox!.x).toBeGreaterThanOrEqual(navConfirmacionBox!.x);
  expect(confirmarActivoBox!.x + confirmarActivoBox!.width).toBeLessThanOrEqual(
    navConfirmacionBox!.x + navConfirmacionBox!.width + 1,
  );
  await page.getByRole('button', { name: 'Confirmar planificación' }).click();

  await expect(page).toHaveURL(/planificacion-mensual-alumno\/321$/);
});
