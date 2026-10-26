import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import {
  expect,
  test,
  type Locator,
  type Page,
  type TestInfo,
} from '@playwright/test';
import { loginAsAdminMock, loginAsRoleMock } from './helpers/auth.helper';

const PLAN_ID = 88003;
const hoy = new Date();
hoy.setHours(7, 0, 0, 0);
const fechaHoy = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;

const TITULO_LARGO_COMPACTO =
  'Compacto B con un título deliberadamente largo que debe ocupar una sola línea';
const TITULO_LARGO_COMPACTO_SIN_DESC =
  'Título compacto muy largo sin comentarios que debe recortarse a una sola línea con tooltip';
const TITULO_LARGO_NORMAL =
  'Normal 60 con un título largo que puede ocupar hasta dos líneas dentro de la tarjeta';
const COMENTARIO_MARKDOWN = [
  '**Negrita en tarjeta** con [enlace de prueba](https://example.test/detalle).',
  '',
  '- Primer punto de la lista',
  '- Segundo punto de la lista',
  '',
  'Párrafo final que se recorta en la tarjeta pero se conserva en el tooltip.',
].join('\n');
const COMENTARIO_COMPLETO = [
  '**Todo cabe.**',
  '',
  '- Primer punto completo',
  '- Segundo punto completo',
  '',
  '[Enlace completo](https://example.test/completo).',
].join('\n');

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

function minutos(offset: number): Date {
  return new Date(hoy.getTime() + offset * 60_000);
}

function subBloquesSinteticos() {
  const base = {
    planificacionId: PLAN_ID,
    color: '#f59e0b',
    comentarios: '',
    realizado: false,
    comentariosAlumno: '',
  };
  return [
    {
      ...base,
      id: 9310,
      nombre: TITULO_LARGO_COMPACTO_SIN_DESC,
      horaInicio: minutos(-30).toISOString(),
      duracion: 30,
      color: '#0ea5e9',
    },
    {
      ...base,
      id: 9301,
      nombre: 'Compacto A',
      horaInicio: minutos(0).toISOString(),
      duracion: 30,
    },
    {
      ...base,
      id: 9302,
      nombre: TITULO_LARGO_COMPACTO,
      horaInicio: minutos(30).toISOString(),
      duracion: 30,
      comentarios: COMENTARIO_MARKDOWN,
    },
    {
      ...base,
      id: 9309,
      nombre: 'Corto 15',
      horaInicio: minutos(90).toISOString(),
      duracion: 15,
      color: '#22c55e',
    },
    {
      ...base,
      id: 9303,
      nombre: 'Normal 60',
      horaInicio: minutos(120).toISOString(),
      duracion: 60,
      comentarios: 'Descripción breve del evento normal.',
    },
    {
      ...base,
      id: 9304,
      nombre: TITULO_LARGO_NORMAL,
      horaInicio: minutos(180).toISOString(),
      duracion: 60,
      comentarios: COMENTARIO_MARKDOWN,
    },
    {
      ...base,
      id: 9305,
      nombre: 'Alto 120',
      horaInicio: minutos(300).toISOString(),
      duracion: 120,
      comentarios: COMENTARIO_COMPLETO,
    },
    {
      ...base,
      id: 9306,
      nombre: 'Fisico 30',
      horaInicio: minutos(420).toISOString(),
      duracion: 30,
      esEntrenamientoFisico: true,
      color: '#34d399',
      comentarios: 'Entrenamiento vinculado con descripción.',
    },
    {
      ...base,
      id: 9307,
      nombre: 'Solapado A',
      horaInicio: minutos(540).toISOString(),
      duracion: 60,
      color: '#60a5fa',
    },
    {
      ...base,
      id: 9308,
      nombre: 'Solapado B',
      horaInicio: minutos(540).toISOString(),
      duracion: 60,
      color: '#c084fc',
    },
  ];
}

function eventosPersonalizados() {
  return [
    {
      id: 9501,
      planificacionId: PLAN_ID,
      nombre: 'Personal 45',
      descripcion: '**Personal** con nota libre.',
      horaInicio: minutos(480).toISOString(),
      duracion: 45,
      color: '#4caf50',
      importante: false,
      tiempoAviso: null,
      realizado: false,
    },
  ];
}

async function prepararCalendario(
  page: Page,
  role: 'ALUMNO' | 'ADMIN' = 'ALUMNO',
) {
  const peticionesSinInterceptar: string[] = [];
  const cambiosProgreso: unknown[] = [];
  const cambiosPersonales: unknown[] = [];

  await page.route('**/*', async (route) => {
    const tipo = route.request().resourceType();
    if (tipo === 'xhr' || tipo === 'fetch') {
      peticionesSinInterceptar.push(route.request().url());
      await route.abort();
      return;
    }
    await route.continue();
  });

  await page.route(
    `**/planificaciones/planificaciones-mensuales/${PLAN_ID}`,
    (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          id: PLAN_ID,
          identificador: 'QA-PRESENTACION',
          descripcion: 'Calendario sintético de presentación',
          mes: hoy.getMonth() + 1,
          ano: hoy.getFullYear(),
          relevancia: [],
          esPorDefecto: false,
          tipoDePlanificacion: 'FRANJA_CUATRO_A_SEIS_HORAS',
          subBloques: subBloquesSinteticos(),
        }),
      }),
  );
  await page.route(
    `**/planificaciones/eventos-personalizados/${PLAN_ID}`,
    (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(eventosPersonalizados()),
      }),
  );
  await page.route('**/planificacion-fisica/resumen-dias**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify([
        {
          fecha: fechaHoy,
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
  await page.route('**/planificaciones/configuracion', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        estado: 'REQUIERE_CONFIGURACION',
        preferenciasPrecargadas: {
          oposicion: 'GENERAL',
          nivel: null,
          franja: 'FRANJA_CUATRO_A_SEIS_HORAS',
        },
        oposicionesPermitidas: ['GENERAL'],
        configuracionActiva: null,
        estadoTest: null,
      }),
    }),
  );
  await page.route('**/cursos/mios', (route) =>
    route.fulfill({ contentType: 'application/json', body: '[]' }),
  );
  await page.route('**/user/tutores', (route) =>
    route.fulfill({ contentType: 'application/json', body: '[]' }),
  );
  await page.route(
    '**/planificaciones/count-planificationes-asignadas',
    (route) => route.fulfill({ contentType: 'application/json', body: '0' }),
  );
  await page.route(`**/adjuntos/PLANIFICACION_MENSUAL/${PLAN_ID}`, (route) =>
    route.fulfill({ contentType: 'application/json', body: '[]' }),
  );
  await page.route(
    '**/planificaciones/actualizar-progreso-subbloque',
    async (route) => {
      cambiosProgreso.push(route.request().postDataJSON());
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: '{}',
      });
    },
  );
  await page.route(
    '**/eventos-personalizados/actualizar-realizado',
    async (route) => {
      cambiosPersonales.push(route.request().postDataJSON());
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: '{}',
      });
    },
  );

  if (role === 'ADMIN') {
    await loginAsAdminMock(page);
  } else {
    await loginAsRoleMock(page, {
      rol: 'ALUMNO',
      email: 'alumno@test.com',
      userFixture: usuarioAlumno,
    });
  }

  return { peticionesSinInterceptar, cambiosProgreso, cambiosPersonales };
}

async function abrirCalendario(
  page: Page,
  width: number,
  height: number,
  role: 'ALUMNO' | 'ADMIN' = 'ALUMNO',
) {
  await page.setViewportSize({ width, height });
  const ruta =
    role === 'ADMIN'
      ? `/app/planificacion/planificacion-mensual/${PLAN_ID}`
      : `/app/planificacion/planificacion-mensual-alumno/${PLAN_ID}`;
  await page.goto(ruta);
  await expect(page.locator('app-vista-semanal')).toBeVisible();
  await expect(page.locator('.event-title strong').first()).toBeVisible();
}

function tarjeta(page: Page, titulo: string): Locator {
  return page
    .locator('.wrapper')
    .filter({ has: page.locator('.event-title strong', { hasText: titulo }) })
    .first();
}

async function cajaDe(locator: Locator) {
  const caja = await locator.boundingBox();
  expect(caja).not.toBeNull();
  return caja!;
}

async function comprobarControlDentro(
  page: Page,
  tarjetaEvento: Locator,
  testId: string,
  minimo: number,
) {
  await tarjetaEvento.scrollIntoViewIfNeeded();
  const card = tarjetaEvento.locator('.custom-event-template');
  const control = tarjetaEvento.getByTestId(testId);
  const cajaCard = await cajaDe(card);
  const cajaControl = await cajaDe(control);
  expect(cajaControl.width).toBeGreaterThanOrEqual(minimo - 0.1);
  expect(cajaControl.height).toBeGreaterThanOrEqual(minimo - 0.1);
  expect(cajaControl.x).toBeGreaterThanOrEqual(cajaCard.x - 0.5);
  expect(cajaControl.y).toBeGreaterThanOrEqual(cajaCard.y - 0.5);
  expect(cajaControl.x + cajaControl.width).toBeLessThanOrEqual(
    cajaCard.x + cajaCard.width + 0.5,
  );
  expect(cajaControl.y + cajaControl.height).toBeLessThanOrEqual(
    cajaCard.y + cajaCard.height + 0.5,
  );

  const aciertos = await control.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const puntos: Array<[number, number]> = [
      [rect.x + rect.width / 2, rect.y + rect.height / 2],
      [rect.x + 2, rect.y + 2],
      [rect.right - 2, rect.y + 2],
      [rect.x + 2, rect.bottom - 2],
      [rect.right - 2, rect.bottom - 2],
    ];
    return puntos.map(([x, y]) => {
      const objetivo = document.elementFromPoint(x, y);
      return !!objetivo && (objetivo === element || element.contains(objetivo));
    });
  });
  expect(aciertos.every(Boolean)).toBe(true);
  return { cajaCard, cajaControl };
}

async function comprobarSeparacionAcciones(
  tarjetaEvento: Locator,
): Promise<void> {
  const texto = await cajaDe(tarjetaEvento.locator('.event-text'));
  const acciones = await cajaDe(tarjetaEvento.locator('.event-actions'));
  expect(texto.x + texto.width).toBeLessThanOrEqual(acciones.x + 1);
}

async function capturar(page: Page, testInfo: TestInfo, nombre: string) {
  const directorio = process.env['QA_EVIDENCE_DIR'];
  if (!directorio) return;
  await mkdir(directorio, { recursive: true });
  await page.screenshot({
    path: join(directorio, `${testInfo.project.name}-${nombre}.png`),
  });
}

test('densidad compacta/normal, marcas y markdown sin invadir acciones', async ({
  page,
}, testInfo) => {
  const api = await prepararCalendario(page);
  await abrirCalendario(page, 1440, 900);

  const compactoA = tarjeta(page, 'Compacto A');
  const compactoB = tarjeta(page, TITULO_LARGO_COMPACTO);
  const compactoSinDesc = tarjeta(page, TITULO_LARGO_COMPACTO_SIN_DESC);
  const corto15 = tarjeta(page, 'Corto 15');
  await expect(
    compactoA.locator('[data-testid="event-overflow-surface"]'),
  ).toHaveAttribute('data-compact', 'true');
  const cajaA = await cajaDe(compactoA.locator('.custom-event-template'));
  const cajaB = await cajaDe(compactoB.locator('.custom-event-template'));
  const caja15 = await cajaDe(corto15.locator('.custom-event-template'));
  const cajaSinDesc = await cajaDe(
    compactoSinDesc.locator('.custom-event-template'),
  );
  expect(cajaA.height).toBeCloseTo(26, 0);
  expect(cajaB.height).toBeCloseTo(26, 0);
  expect(caja15.height).toBeCloseTo(26, 0);
  expect(cajaSinDesc.height).toBeCloseTo(26, 0);
  const separacion = cajaB.y - (cajaA.y + cajaA.height);
  expect(separacion).toBeGreaterThan(3.5);
  expect(separacion).toBeLessThan(4.5);

  const compactoControl = await comprobarControlDentro(
    page,
    compactoA,
    'completion-toggle',
    24,
  );
  await comprobarControlDentro(page, compactoB, 'completion-toggle', 24);
  await comprobarControlDentro(page, corto15, 'completion-toggle', 24);
  await comprobarControlDentro(page, compactoSinDesc, 'completion-toggle', 24);
  await comprobarControlDentro(page, compactoA, 'event-comment-button', 24);
  await comprobarControlDentro(page, compactoB, 'event-comment-button', 24);
  await comprobarControlDentro(page, corto15, 'event-comment-button', 24);
  await comprobarSeparacionAcciones(compactoA);
  await comprobarSeparacionAcciones(compactoB);
  await comprobarSeparacionAcciones(corto15);
  await comprobarSeparacionAcciones(compactoSinDesc);

  const superficieCompactoB = compactoB.locator(
    '[data-testid="event-overflow-surface"]',
  );
  await expect(superficieCompactoB).toHaveAttribute('data-overflow', 'true');
  await expect(compactoB.locator('.event-comments')).toHaveCSS(
    'visibility',
    'hidden',
  );
  await expect(compactoB.getByTestId('event-overflow-indicator')).toBeVisible();
  await expect(superficieCompactoB).toHaveAttribute(
    'aria-label',
    /Párrafo final que se recorta/,
  );

  const tituloCompacto = compactoB.locator('.event-title strong');
  const metricaTitulo = await tituloCompacto.evaluate((element) => ({
    height: element.getBoundingClientRect().height,
    lineHeight: Number.parseFloat(getComputedStyle(element).lineHeight),
    clamp: getComputedStyle(element).webkitLineClamp,
  }));
  expect(metricaTitulo.clamp).toBe('1');
  expect(metricaTitulo.height).toBeLessThanOrEqual(
    metricaTitulo.lineHeight + 2,
  );

  const metricaSinDesc = await compactoSinDesc
    .locator('.event-title strong')
    .evaluate((element) => ({
      height: element.getBoundingClientRect().height,
      lineHeight: Number.parseFloat(getComputedStyle(element).lineHeight),
      clamp: getComputedStyle(element).webkitLineClamp,
    }));
  expect(metricaSinDesc.clamp).toBe('1');
  expect(metricaSinDesc.height).toBeLessThanOrEqual(
    metricaSinDesc.lineHeight + 2,
  );

  const normal = tarjeta(page, 'Normal 60');
  const cajaNormal = await cajaDe(normal.locator('.custom-event-template'));
  expect(cajaNormal.height).toBeCloseTo(56, 0);
  await comprobarControlDentro(page, normal, 'completion-toggle', 44);
  await comprobarControlDentro(page, normal, 'event-comment-button', 44);
  await comprobarSeparacionAcciones(normal);

  const solapadoA = tarjeta(page, 'Solapado A');
  const solapadoB = tarjeta(page, 'Solapado B');
  const cajaSolapadoA = await cajaDe(
    solapadoA.locator('.custom-event-template'),
  );
  const cajaSolapadoB = await cajaDe(
    solapadoB.locator('.custom-event-template'),
  );
  expect(Math.abs(cajaSolapadoA.y - cajaSolapadoB.y)).toBeLessThan(1);
  expect(cajaSolapadoA.x + cajaSolapadoA.width).toBeLessThanOrEqual(
    cajaSolapadoB.x + 1,
  );
  await comprobarControlDentro(page, solapadoA, 'completion-toggle', 44);
  await comprobarControlDentro(page, solapadoB, 'completion-toggle', 44);
  await comprobarControlDentro(page, solapadoA, 'event-comment-button', 44);
  await comprobarControlDentro(page, solapadoB, 'event-comment-button', 44);
  await comprobarSeparacionAcciones(solapadoA);
  await comprobarSeparacionAcciones(solapadoB);

  const largoNormal = tarjeta(page, TITULO_LARGO_NORMAL);
  await comprobarControlDentro(page, largoNormal, 'completion-toggle', 44);
  const metricaTituloNormal = await largoNormal
    .locator('.event-title strong')
    .evaluate((element) => ({
      height: element.getBoundingClientRect().height,
      lineHeight: Number.parseFloat(getComputedStyle(element).lineHeight),
      clamp: getComputedStyle(element).webkitLineClamp,
    }));
  expect(metricaTituloNormal.clamp).toBe('2');
  expect(metricaTituloNormal.height).toBeLessThanOrEqual(
    metricaTituloNormal.lineHeight * 2 + 2,
  );

  const alto = tarjeta(page, 'Alto 120');
  const cajaAlto = await cajaDe(alto.locator('.custom-event-template'));
  expect(cajaAlto.height).toBeCloseTo(116, 0);
  await comprobarControlDentro(page, alto, 'completion-toggle', 44);
  await comprobarControlDentro(page, alto, 'event-comment-button', 44);
  const superficieAlto = alto.locator('[data-testid="event-overflow-surface"]');
  await expect(superficieAlto).toHaveAttribute('data-overflow', 'false');
  const descripcionAlto = alto.locator('.event-comments');
  await expect(descripcionAlto.locator('strong')).toHaveText('Todo cabe.');
  await expect(descripcionAlto.locator('ul li')).toHaveCount(2);
  await expect(descripcionAlto.locator('a')).toHaveAttribute(
    'href',
    'https://example.test/completo',
  );

  const fisico = tarjeta(page, 'Fisico 30');
  await expect(
    fisico.locator('[data-testid="event-overflow-surface"]'),
  ).toHaveAttribute('data-compact', 'true');
  await comprobarControlDentro(page, fisico, 'fisica-vinculada-icono', 24);
  await comprobarControlDentro(page, fisico, 'completion-toggle', 24);
  await comprobarControlDentro(page, fisico, 'event-comment-button', 24);
  await comprobarSeparacionAcciones(fisico);
  await expect(
    fisico.getByRole('button', { name: 'Ver plan físico de este día' }),
  ).toBeVisible();

  const personal = tarjeta(page, 'Personal 45');
  await comprobarControlDentro(page, personal, 'completion-toggle', 24);
  await comprobarControlDentro(page, personal, 'event-delete-button', 24);
  await comprobarSeparacionAcciones(personal);

  const antesMarca = await cajaDe(compactoA.locator('.custom-event-template'));
  const casilla = compactoA.getByTestId('completion-toggle');
  await casilla.focus();
  await expect(casilla).toBeFocused();
  const duranteFoco = await cajaDe(compactoA.locator('.custom-event-template'));
  expect(Math.abs(duranteFoco.x - antesMarca.x)).toBeLessThan(0.5);
  expect(Math.abs(duranteFoco.y - antesMarca.y)).toBeLessThan(0.5);
  expect(Math.abs(duranteFoco.width - antesMarca.width)).toBeLessThan(0.5);
  expect(Math.abs(duranteFoco.height - antesMarca.height)).toBeLessThan(0.5);
  await casilla.click();
  await expect(casilla).toHaveAttribute('aria-checked', 'true');
  await expect(compactoA.locator('.custom-event-template')).toHaveClass(
    /event-card--completed/,
  );
  await expect.poll(() => api.cambiosProgreso.length).toBe(1);
  const despuesMarca = await cajaDe(
    compactoA.locator('.custom-event-template'),
  );
  expect(Math.abs(despuesMarca.x - antesMarca.x)).toBeLessThan(0.5);
  expect(Math.abs(despuesMarca.y - antesMarca.y)).toBeLessThan(0.5);
  expect(Math.abs(despuesMarca.width - antesMarca.width)).toBeLessThan(0.5);
  expect(Math.abs(despuesMarca.height - antesMarca.height)).toBeLessThan(0.5);
  await expect(
    page.locator('.progress-container small', {
      hasText: 'sub bloques completados',
    }),
  ).toContainText('1 de 11 sub bloques completados');
  await expect(page).toHaveURL(
    new RegExp(`/planificacion-mensual-alumno/${PLAN_ID}$`),
  );
  expect(compactoControl.cajaControl.width).toBeGreaterThanOrEqual(24);
  expect(api.peticionesSinInterceptar).toEqual([]);

  await capturar(page, testInfo, 'presentacion-desktop');
});

test('el detalle existente conserva el markdown y el tooltip solo aparece al recortar', async ({
  page,
}) => {
  const api = await prepararCalendario(page);
  await abrirCalendario(page, 1440, 900);

  const alto = tarjeta(page, 'Alto 120');
  await alto.scrollIntoViewIfNeeded();
  await page.mouse.move(1400, 4);
  await expect(page.locator('.p-tooltip:visible')).toHaveCount(0);
  await alto.locator('.event-title strong').hover();
  await page.waitForTimeout(250);
  await expect(page.locator('.p-tooltip:visible')).toHaveCount(0);
  await expect(
    alto.locator('[data-testid="event-overflow-surface"]'),
  ).toHaveAttribute('data-overflow', 'false');

  await alto.locator('.event-title strong').click();
  const dialogo = page.locator('.p-dialog:visible').last();
  await expect(dialogo).toBeVisible();
  const detalle = dialogo.locator('markdown');
  await expect(detalle.locator('strong')).toHaveText('Todo cabe.');
  await expect(detalle.locator('ul li')).toHaveCount(2);
  await expect(detalle.locator('a')).toHaveAttribute(
    'href',
    'https://example.test/completo',
  );
  await page.keyboard.press('Escape');
  await expect(dialogo).toBeHidden();

  const compactoSinDesc = tarjeta(page, TITULO_LARGO_COMPACTO_SIN_DESC);
  const superficieSinDesc = compactoSinDesc.locator(
    '[data-testid="event-overflow-surface"]',
  );
  await expect(superficieSinDesc).toHaveAttribute('data-compact', 'true');
  await expect(superficieSinDesc).toHaveAttribute('data-overflow', 'true');
  await compactoSinDesc.scrollIntoViewIfNeeded();
  await page.mouse.move(1400, 4);
  await expect(page.locator('.p-tooltip:visible')).toHaveCount(0);
  await superficieSinDesc.hover();
  const tooltipSinDesc = page.locator('.p-tooltip:visible');
  await expect(tooltipSinDesc).toBeVisible();
  await expect(tooltipSinDesc).toContainText(TITULO_LARGO_COMPACTO_SIN_DESC);
  await page.keyboard.press('Escape');
  await expect(tooltipSinDesc).toBeHidden();

  const normalLargo = tarjeta(page, TITULO_LARGO_NORMAL);
  const superficie = normalLargo.locator(
    '[data-testid="event-overflow-surface"]',
  );
  await expect(superficie).toHaveAttribute('data-overflow', 'true');
  await normalLargo.scrollIntoViewIfNeeded();
  await page.mouse.move(1400, 4);
  await expect(page.locator('.p-tooltip:visible')).toHaveCount(0);
  await superficie.hover();
  const tooltip = page.locator('.p-tooltip:visible');
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toContainText(TITULO_LARGO_NORMAL);
  await expect(tooltip).toContainText('Párrafo final que se recorta');
  await expect(
    tooltip.locator('strong', { hasText: 'Negrita en tarjeta' }),
  ).toBeVisible();
  await expect(tooltip.locator('ul li')).toHaveCount(2);
  await expect(tooltip.locator('a')).toHaveAttribute(
    'href',
    'https://example.test/detalle',
  );

  await page.keyboard.press('Escape');
  await expect(tooltip).toBeHidden();
  await superficie.focus();
  await expect(tooltip).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(tooltip).toBeHidden();
  expect(api.peticionesSinInterceptar).toEqual([]);
});

test('un evento personal actualiza su propia API y la barra diaria', async ({
  page,
}) => {
  const api = await prepararCalendario(page);
  await abrirCalendario(page, 1440, 900);

  const personal = tarjeta(page, 'Personal 45');
  await personal.scrollIntoViewIfNeeded();
  const casilla = personal.getByTestId('completion-toggle');
  await casilla.click();
  await expect(casilla).toHaveAttribute('aria-checked', 'true');
  await expect.poll(() => api.cambiosPersonales.length).toBe(1);
  expect(api.cambiosPersonales[0]).toMatchObject({
    id: 9501,
    planificacionId: PLAN_ID,
    realizado: true,
  });
  expect(api.cambiosProgreso).toEqual([]);
  await expect(
    page.locator('.progress-container small', {
      hasText: 'sub bloques completados',
    }),
  ).toContainText('1 de 11 sub bloques completados');
  await expect(page).toHaveURL(
    new RegExp(`/planificacion-mensual-alumno/${PLAN_ID}$`),
  );
  expect(api.peticionesSinInterceptar).toEqual([]);
});

test('el escritorio de 1280 mantiene la densidad y los controles contenidos', async ({
  page,
}) => {
  const api = await prepararCalendario(page);
  await abrirCalendario(page, 1280, 800);

  const compacto = tarjeta(page, 'Compacto A');
  const normal = tarjeta(page, 'Normal 60');
  const alto = tarjeta(page, 'Alto 120');
  const cajaCompacta = await cajaDe(compacto.locator('.custom-event-template'));
  const cajaNormal = await cajaDe(normal.locator('.custom-event-template'));
  const cajaAlta = await cajaDe(alto.locator('.custom-event-template'));
  expect(cajaCompacta.height).toBeCloseTo(26, 0);
  expect(cajaNormal.height).toBeCloseTo(56, 0);
  expect(cajaAlta.height).toBeCloseTo(116, 0);
  await comprobarControlDentro(page, compacto, 'completion-toggle', 24);
  await comprobarControlDentro(page, normal, 'completion-toggle', 44);
  await comprobarControlDentro(page, alto, 'completion-toggle', 44);
  await comprobarControlDentro(page, compacto, 'event-comment-button', 24);
  await comprobarControlDentro(page, normal, 'event-comment-button', 44);
  await comprobarControlDentro(page, alto, 'event-comment-button', 44);
  await comprobarSeparacionAcciones(compacto);
  await comprobarSeparacionAcciones(normal);
  await comprobarSeparacionAcciones(alto);
  expect(api.peticionesSinInterceptar).toEqual([]);
});

test('el calendario móvil mantiene los controles dentro de las tarjetas', async ({
  page,
}, testInfo) => {
  const api = await prepararCalendario(page);
  await abrirCalendario(page, 390, 844);

  const compacto = tarjeta(page, 'Compacto A');
  const corto15 = tarjeta(page, 'Corto 15');
  const normal = tarjeta(page, 'Normal 60');
  const alto = tarjeta(page, 'Alto 120');
  const personal = tarjeta(page, 'Personal 45');
  for (const [evento, minimo] of [
    [compacto, 24],
    [corto15, 24],
    [normal, 44],
    [alto, 44],
  ] as const) {
    const caja = await cajaDe(evento.locator('.custom-event-template'));
    expect(caja.x).toBeGreaterThanOrEqual(0);
    expect(caja.x + caja.width).toBeLessThanOrEqual(391);
    await comprobarControlDentro(page, evento, 'completion-toggle', minimo);
    await comprobarControlDentro(page, evento, 'event-comment-button', minimo);
    await comprobarSeparacionAcciones(evento);
  }
  await comprobarControlDentro(page, personal, 'completion-toggle', 24);
  await comprobarControlDentro(page, personal, 'event-delete-button', 24);
  await comprobarSeparacionAcciones(personal);

  // En móvil la tarjeta física compacta oculta resumen/chips, pero el
  // contexto completo sigue disponible en la etiqueta accesible y el tooltip.
  const fisico = tarjeta(page, 'Fisico 30');
  const superficieFisica = fisico.locator(
    '[data-testid="event-overflow-surface"]',
  );
  await expect(superficieFisica).toHaveAttribute('data-compact', 'true');
  await expect(superficieFisica).toHaveAttribute(
    'aria-label',
    /Plan físico: 0\/1/,
  );
  await expect(superficieFisica).toHaveAttribute(
    'aria-label',
    /Carrera \(pendiente\)/,
  );
  await expect(fisico.getByTestId('fisica-vinculada-estado')).toBeHidden();
  await expect(fisico.getByTestId('fisica-vinculada-disciplinas')).toBeHidden();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(391);
  await expect(page.locator('.progress-container small').first()).toContainText(
    '0 de 11 sub bloques completados',
  );
  await capturar(page, testInfo, 'presentacion-mobile');
  expect(api.peticionesSinInterceptar).toEqual([]);
});

test('el modo administrador conserva la acción de borrado dentro de la tarjeta', async ({
  page,
}) => {
  await prepararCalendario(page, 'ADMIN');
  await abrirCalendario(page, 1440, 900, 'ADMIN');

  const compacto = tarjeta(page, 'Compacto A');
  await expect(
    compacto.locator('[data-testid="event-overflow-surface"]'),
  ).toHaveAttribute('data-compact', 'true');
  await expect(compacto.getByTestId('completion-toggle')).toHaveCount(0);
  const borrar = compacto.locator('.event-delete-button');
  await expect(borrar).toBeVisible();
  const { cajaCard, cajaControl } = await comprobarControlDentro(
    page,
    compacto,
    'event-delete-button',
    24,
  );
  expect(cajaControl.y + cajaControl.height).toBeLessThanOrEqual(
    cajaCard.y + cajaCard.height,
  );
  await comprobarControlDentro(page, compacto, 'event-comment-button', 24);
  await comprobarSeparacionAcciones(compacto);

  const normal = tarjeta(page, 'Normal 60');
  await comprobarControlDentro(page, normal, 'event-delete-button', 44);
  await comprobarControlDentro(page, normal, 'event-comment-button', 44);
  await comprobarSeparacionAcciones(normal);
});
