import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { loginAsRoleMock } from './helpers/auth.helper';

const PLAN_ID = 88002;
const hoy = new Date();
hoy.setHours(10, 0, 0, 0);
const DESCRIPCION_LARGA = [
  '**Markdown destacado** con [un enlace](https://example.test/) y un párrafo que debe ajustarse a la altura y anchura reales del evento.',
  'Otro párrafo con una palabra deliberadamente interminable: ' +
    'extraordinariamente'.repeat(5),
  ...Array.from(
    { length: 14 },
    (_, index) =>
      `Párrafo de prueba ${index + 1}: contenido largo para comprobar el recorte del calendario semanal sin tapar el evento siguiente.`,
  ),
  'FIN COMPLETO DE LA DESCRIPCIÓN',
].join('\n\n');
const TITULO_LARGO =
  'TÍTULO-MUY-LARGO-SIN-ESPACIOS-' + 'extraordinariamente'.repeat(4);

function bloquesSinteticos() {
  return [
    {
      id: 9101,
      planificacionId: PLAN_ID,
      nombre: 'Evento corto',
      horaInicio: hoy.toISOString(),
      duracion: 60,
      color: '#f59e0b',
      comentarios: DESCRIPCION_LARGA,
      realizado: false,
      comentariosAlumno: '',
    },
    {
      id: 9102,
      planificacionId: PLAN_ID,
      nombre: 'Evento siguiente',
      esEntrenamientoFisico: true,
      horaInicio: new Date(hoy.getTime() + 60 * 60_000).toISOString(),
      duracion: 60,
      color: '#34d399',
      comentarios: 'Contenido del siguiente evento.',
      realizado: false,
      comentariosAlumno: '',
    },
    {
      id: 9103,
      planificacionId: PLAN_ID,
      nombre: 'Evento alto',
      horaInicio: new Date(hoy.getTime() + 3 * 60 * 60_000).toISOString(),
      duracion: 240,
      color: '#60a5fa',
      comentarios:
        '**Todo cabe.**\n\nEste contenido debe aparecer completo en el bloque alto.',
      realizado: false,
      comentariosAlumno: '',
    },
    {
      id: 9104,
      planificacionId: PLAN_ID,
      nombre: TITULO_LARGO,
      horaInicio: new Date(
        hoy.getTime() + 24 * 60 * 60_000 + 8 * 60 * 60_000,
      ).toISOString(),
      duracion: 60,
      color: '#c084fc',
      comentarios: '',
      realizado: false,
      comentariosAlumno: '',
    },
    {
      id: 9105,
      planificacionId: PLAN_ID,
      nombre: 'Fisico corto 15',
      esEntrenamientoFisico: true,
      horaInicio: new Date(hoy.getTime() - 60 * 60_000).toISOString(),
      duracion: 15,
      color: '#34d399',
      comentarios: '',
      realizado: false,
      comentariosAlumno: '',
    },
    {
      id: 9106,
      planificacionId: PLAN_ID,
      nombre: 'Fisico 60',
      esEntrenamientoFisico: true,
      horaInicio: new Date(hoy.getTime() + 2 * 60 * 60_000).toISOString(),
      duracion: 60,
      color: '#34d399',
      comentarios: '',
      realizado: false,
      comentariosAlumno: '',
    },
    {
      id: 9107,
      planificacionId: PLAN_ID,
      nombre: 'Quince A',
      horaInicio: new Date(hoy.getTime() - 3 * 60 * 60_000).toISOString(),
      duracion: 15,
      color: '#f59e0b',
      comentarios: '',
      realizado: false,
      comentariosAlumno: '',
    },
    {
      id: 9108,
      planificacionId: PLAN_ID,
      nombre: 'Quince B',
      horaInicio: new Date(hoy.getTime() - 2.75 * 60 * 60_000).toISOString(),
      duracion: 15,
      color: '#34d399',
      comentarios: '',
      realizado: false,
      comentariosAlumno: '',
    },
  ];
}

async function prepararCalendario(page: Page) {
  const peticionesSinInterceptar: string[] = [];
  // Ninguna llamada de datos sale a la red: las rutas conocidas se registran
  // después y cualquier XHR/fetch no cubierto queda abortado y contabilizado.
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
          identificador: 'QA-OVERFLOW',
          descripcion: 'Calendario sintético aislado',
          mes: hoy.getMonth() + 1,
          ano: hoy.getFullYear(),
          relevancia: [],
          esPorDefecto: false,
          tipoDePlanificacion: 'FRANJA_CUATRO_A_SEIS_HORAS',
          subBloques: bloquesSinteticos(),
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
          fecha: `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`,
          bloqueId: 77,
          disciplinas: [
            {
              nombre: 'Carrera de fondo',
              grupo: 'CARRERA',
              color: '#123456',
              realizado: true,
            },
            {
              nombre: 'Cuerda doble',
              grupo: 'CUERDA',
              color: '#9fe2d0',
              realizado: false,
            },
            {
              nombre: 'Natación técnica',
              grupo: 'NATACION',
              color: '#60a5fa',
              realizado: true,
            },
            {
              nombre: 'Circuito de fuerza',
              grupo: 'FUERZA',
              color: '#f59e0b',
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
  await page.route('**/adjuntos/PLANIFICACION_MENSUAL/88002', (route) =>
    route.fulfill({ contentType: 'application/json', body: '[]' }),
  );

  const cambiosProgreso: unknown[] = [];
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
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      suscripciones: [{ id: 1, tipo: 'PREMIUM', status: 'ACTIVE' }],
      oposiciones: [],
    },
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/app/planificacion/planificacion-mensual-alumno/${PLAN_ID}`);
  await expect(page.locator('app-vista-semanal')).toBeVisible();
  return {
    cambiosProgreso,
    peticionesSinInterceptar,
  };
}

function evento(page: Page, titulo: string) {
  return page
    .locator('.wrapper')
    .filter({ has: page.locator('.event-title strong', { hasText: titulo }) })
    .first();
}

async function capturarEvidencia(page: Page, nombre: string): Promise<void> {
  const directory = process.env['QA_EVIDENCE_DIR'];
  if (!directory) return;
  await mkdir(directory, { recursive: true });
  await page.screenshot({ path: join(directory, nombre) });
}

async function moverPunteroAZonaNeutra(page: Page): Promise<void> {
  const viewport = page.viewportSize();
  if (!viewport) throw new Error('El viewport de Playwright no está definido');
  await page.mouse.move(viewport.width - 16, 2);
}

async function hoverSinTooltipPrevio(
  page: Page,
  target: Locator,
): Promise<void> {
  await moverPunteroAZonaNeutra(page);
  await expect(page.locator('.p-tooltip:visible')).toHaveCount(0);
  await target.scrollIntoViewIfNeeded();
  let previous = await target.boundingBox();
  await expect
    .poll(async () => {
      const current = await target.boundingBox();
      if (!current || !previous) {
        previous = current;
        return false;
      }
      const stable =
        Math.abs(previous.x - current.x) < 1 &&
        Math.abs(previous.y - current.y) < 1;
      previous = current;
      return stable;
    })
    .toBe(true);
  const bounds = await target.boundingBox();
  expect(bounds).not.toBeNull();
  await target.hover({
    position: {
      x: Math.min(20, bounds!.width - 2),
      y: Math.min(200, Math.max(8, bounds!.height / 2)),
    },
  });
}

test('recorta por el espacio real, ofrece tooltip accesible y no interfiere con acciones', async ({
  page,
}) => {
  const api = await prepararCalendario(page);
  const corto = evento(page, 'Evento corto');
  const cortoContenido = corto.locator(
    '[data-testid="event-overflow-surface"]',
  );
  const descripcion = corto.locator('.event-comments');

  await expect(corto).toBeVisible();
  await expect(corto.locator('.event-title strong')).toBeVisible();
  const cajaEvento = await cortoContenido.boundingBox();
  const cajaDescripcion = await descripcion.boundingBox();
  expect(cajaEvento).not.toBeNull();
  expect(cajaDescripcion).not.toBeNull();
  expect(cajaDescripcion!.y + cajaDescripcion!.height).toBeLessThanOrEqual(
    cajaEvento!.y + cajaEvento!.height + 1,
  );
  const indicador = cortoContenido.getByTestId('event-overflow-indicator');
  await expect(indicador).toBeVisible();
  const cajaIndicador = await indicador.boundingBox();
  expect(cajaIndicador).not.toBeNull();
  expect(cajaIndicador!.y + cajaIndicador!.height).toBeLessThanOrEqual(
    cajaEvento!.y + cajaEvento!.height,
  );
  await moverPunteroAZonaNeutra(page);
  await page.waitForTimeout(150);
  await capturarEvidencia(page, 'event-overflow-clipped.png');

  await hoverSinTooltipPrevio(page, cortoContenido);
  const tooltip = page.locator('.p-tooltip');
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toContainText('Evento corto');
  await expect(tooltip).toContainText('FIN COMPLETO DE LA DESCRIPCIÓN');
  await expect(
    tooltip.locator('strong', { hasText: 'Markdown destacado' }),
  ).toBeVisible();
  await expect(tooltip.locator('a')).toHaveAttribute(
    'href',
    'https://example.test/',
  );
  const tooltipText = tooltip.locator('.calendar-event-overflow-tooltip');
  const tooltipScrollRegion = tooltip.locator(':scope > .p-tooltip-text');
  await tooltip.hover();
  await expect(tooltip).toBeVisible();
  await tooltipScrollRegion.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect(
    tooltipText.getByText('FIN COMPLETO DE LA DESCRIPCIÓN'),
  ).toBeInViewport();
  await expect(tooltip).toHaveCSS('opacity', '1');
  await capturarEvidencia(page, 'event-overflow-tooltip.png');
  expect(api.peticionesSinInterceptar).toEqual([]);

  await moverPunteroAZonaNeutra(page);
  await cortoContenido.focus();
  await expect(tooltip).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(tooltip).toBeHidden();

  const siguiente = evento(page, 'Evento siguiente');
  await expect(siguiente.locator('.event-title strong')).toBeVisible();
  await expect(siguiente.locator('.event-comments')).toContainText(
    'Contenido del siguiente evento.',
  );

  const casilla = corto.getByTestId('completion-toggle');
  await casilla.click();
  await expect(casilla).toHaveAttribute('aria-checked', 'true');
  expect(api.cambiosProgreso).toEqual([
    { subBloqueId: 9101, planificacionId: PLAN_ID, realizado: true },
  ]);
  await expect(page.locator('.p-dialog')).toBeHidden();
});

test('no muestra tooltip cuando cabe y recalcula al cambiar ancho y alto del evento', async ({
  page,
}) => {
  const api = await prepararCalendario(page);
  const alto = evento(page, 'Evento alto');
  const altoContenido = alto.locator('[data-testid="event-overflow-surface"]');
  await hoverSinTooltipPrevio(page, altoContenido);
  await expect(page.locator('.p-tooltip:visible')).toHaveCount(0);
  await expect(altoContenido).toHaveAttribute('data-overflow', 'false');
  await expect(alto.locator('.event-comments')).toContainText('Todo cabe.');
  expect(api.peticionesSinInterceptar).toEqual([]);

  const resizeEventHeight = (height: number) =>
    altoContenido.evaluate((element, nextHeight) => {
      const event = element.closest(
        '.cal-event-container',
      ) as HTMLElement | null;
      if (!event)
        throw new Error('No se encontró el contenedor real del evento');
      event.style.height = `${nextHeight}px`;
    }, height);

  await resizeEventHeight(60);
  await expect
    .poll(async () => (await altoContenido.boundingBox())?.height)
    .toBeLessThan(100);
  await expect(altoContenido).toHaveAttribute('data-overflow', 'true');
  await hoverSinTooltipPrevio(page, altoContenido);
  const tooltip = page.locator('.p-tooltip');
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toContainText('Todo cabe.');

  await resizeEventHeight(900);
  await expect
    .poll(async () => (await altoContenido.boundingBox())?.height)
    .toBeGreaterThan(800);
  await expect(altoContenido).toHaveAttribute('data-overflow', 'false');
  await expect(page.locator('.p-tooltip:visible')).toHaveCount(0);
  expect(api.peticionesSinInterceptar).toEqual([]);
});

test('recorta títulos largos y permite abrir el evento sin convertir el hover en un clic', async ({
  page,
}) => {
  const api = await prepararCalendario(page);
  const largo = evento(page, TITULO_LARGO);
  const superficie = largo.locator('[data-testid="event-overflow-surface"]');
  const titulo = largo.locator('.event-title strong');

  await expect(titulo).toBeVisible();
  const titleBounds = await titulo.boundingBox();
  const titleLineHeight = await titulo.evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).lineHeight),
  );
  expect(titleBounds).not.toBeNull();
  expect(titleBounds!.height).toBeLessThanOrEqual(titleLineHeight * 2 + 2);
  await moverPunteroAZonaNeutra(page);
  await page.waitForTimeout(150);
  await superficie.scrollIntoViewIfNeeded();
  await capturarEvidencia(page, 'event-overflow-long-title.png');
  await hoverSinTooltipPrevio(page, superficie);
  const tooltip = page.locator('.p-tooltip');
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toContainText(TITULO_LARGO);
  await expect(page.locator('.p-dialog')).toBeHidden();

  const resizeEventWidth = (width: number) =>
    superficie.evaluate((element, nextWidth) => {
      const event = element.closest(
        '.cal-event-container',
      ) as HTMLElement | null;
      if (!event)
        throw new Error('No se encontró el contenedor real del evento');
      event.style.width = `${nextWidth}px`;
    }, width);

  await resizeEventWidth(1000);
  await expect(superficie).toHaveAttribute('data-overflow', 'false');
  await expect(page.locator('.p-tooltip:visible')).toHaveCount(0);

  await resizeEventWidth(160);
  await expect(superficie).toHaveAttribute('data-overflow', 'true');
  await hoverSinTooltipPrevio(page, superficie);
  await expect(tooltip).toBeVisible();

  await resizeEventWidth(1000);
  await expect(superficie).toHaveAttribute('data-overflow', 'false');
  await expect(page.locator('.p-tooltip:visible')).toHaveCount(0);

  await largo.click();
  await expect(page.locator('.p-dialog')).toBeVisible();
  expect(api.peticionesSinInterceptar).toEqual([]);
});

test('mantiene el acceso al plan físico dentro de un evento de una hora', async ({
  page,
}) => {
  const api = await prepararCalendario(page);
  const vinculado = evento(page, 'Evento siguiente');
  const link = vinculado.getByRole('button', {
    name: 'Ver plan físico de este día',
  });
  await vinculado.scrollIntoViewIfNeeded();
  await expect(vinculado.getByTestId('completion-toggle')).toBeVisible();
  const initialLink = await link.boundingBox();
  expect(initialLink).not.toBeNull();
  expect(initialLink!.width).toBeGreaterThanOrEqual(44);
  expect(initialLink!.height).toBeGreaterThanOrEqual(44);
  const initialCard = await vinculado.boundingBox();
  expect(initialCard).not.toBeNull();
  expect(initialLink!.y + initialLink!.height).toBeLessThanOrEqual(
    initialCard!.y + initialCard!.height,
  );
  const title = vinculado.locator('.event-title strong');
  const status = vinculado.getByTestId('fisica-vinculada-estado');
  await expect(title).toBeVisible();
  await expect(status).toContainText('Plan físico: 2/4');
  const titleBounds = await title.boundingBox();
  const statusBounds = await status.boundingBox();
  expect(titleBounds).not.toBeNull();
  expect(statusBounds).not.toBeNull();
  expect(statusBounds!.y).toBeGreaterThanOrEqual(
    titleBounds!.y + titleBounds!.height - 1,
  );
  await link.click({ trial: true, timeout: 2500 });
  await capturarEvidencia(page, 'event-overflow-physical-actions.png');
  const caja = await link.boundingBox();
  const tarjeta = await vinculado.boundingBox();
  expect(caja).not.toBeNull();
  expect(tarjeta).not.toBeNull();
  expect(caja!.y + caja!.height).toBeLessThanOrEqual(
    tarjeta!.y + tarjeta!.height,
  );
  expect(api.cambiosProgreso).toEqual([]);
  expect(api.peticionesSinInterceptar).toEqual([]);
});

test('conserva el contexto físico completo en compacto y cuando la tarjeta lo recorta', async ({
  page,
}) => {
  const api = await prepararCalendario(page);

  const compacto = evento(page, 'Fisico corto 15');
  const compactoSuperficie = compacto.locator(
    '[data-testid="event-overflow-surface"]',
  );
  await compacto.scrollIntoViewIfNeeded();
  await expect(compactoSuperficie).toHaveAttribute('data-compact', 'true');
  await expect(compactoSuperficie).toHaveAttribute('data-overflow', 'true');
  // En compacto el resumen y los chips están ocultos por CSS...
  await expect(compacto.getByTestId('fisica-vinculada-estado')).toBeHidden();
  await expect(
    compacto.getByTestId('fisica-vinculada-disciplinas'),
  ).toBeHidden();
  // ...pero el texto accesible conserva todo el contexto.
  await expect(compactoSuperficie).toHaveAttribute(
    'aria-label',
    /Plan físico: 2\/4/,
  );
  await expect(compactoSuperficie).toHaveAttribute(
    'aria-label',
    /Carrera de fondo \(realizada\)/,
  );
  await expect(compactoSuperficie).toHaveAttribute(
    'aria-label',
    /Cuerda doble \(pendiente\)/,
  );

  await hoverSinTooltipPrevio(page, compactoSuperficie);
  const tooltip = page.locator('.p-tooltip');
  await expect(tooltip).toBeVisible();
  const contexto = tooltip.locator('.event-context-text');
  await expect(contexto).toContainText('Plan físico: 2/4');
  for (const disciplina of [
    'Carrera de fondo (realizada)',
    'Cuerda doble (pendiente)',
    'Natación técnica (realizada)',
    'Circuito de fuerza (pendiente)',
  ]) {
    await expect(contexto).toContainText(disciplina);
  }
  await expect(tooltip).toHaveCSS('opacity', '1');
  await capturarEvidencia(page, 'correction-contexto-fisico-compacto.png');
  await page.keyboard.press('Escape');
  await expect(tooltip).toBeHidden();

  await moverPunteroAZonaNeutra(page);
  await compactoSuperficie.focus();
  await expect(tooltip).toBeVisible();
  await expect(tooltip.locator('.event-context-text')).toContainText(
    'Plan físico: 2/4',
  );
  await page.keyboard.press('Escape');
  await expect(tooltip).toBeHidden();

  const normal = evento(page, 'Fisico 60');
  const normalSuperficie = normal.locator(
    '[data-testid="event-overflow-surface"]',
  );
  await normal.scrollIntoViewIfNeeded();
  await expect(normalSuperficie).toHaveAttribute('data-compact', 'false');
  // Sin comentarios y con el título corto: el recorte lo provoca el contexto.
  await expect(normalSuperficie).toHaveAttribute('data-overflow', 'true');
  await expect(normal.getByTestId('fisica-vinculada-estado')).toBeVisible();
  await expect(normal.getByTestId('fisica-vinculada-estado')).toContainText(
    'Plan físico: 2/4',
  );
  await hoverSinTooltipPrevio(page, normalSuperficie);
  await expect(tooltip).toBeVisible();
  await expect(tooltip.locator('.event-context-text')).toContainText(
    'Circuito de fuerza (pendiente)',
  );
  await expect(tooltip).toHaveCSS('opacity', '1');
  await capturarEvidencia(page, 'correction-contexto-fisico-normal.png');
  await page.keyboard.press('Escape');

  // Con altura suficiente todo el contexto visible cabe: no hay tooltip.
  const alto = 200;
  await normalSuperficie.evaluate((element, nextHeight) => {
    const container = element.closest(
      '.cal-event-container',
    ) as HTMLElement | null;
    if (!container) throw new Error('No se encontró el contenedor del evento');
    container.style.height = `${nextHeight}px`;
  }, alto);
  await expect
    .poll(async () => (await normalSuperficie.boundingBox())?.height)
    .toBeGreaterThan(alto - 20);
  await expect(normalSuperficie).toHaveAttribute('data-overflow', 'false');
  await moverPunteroAZonaNeutra(page);
  await expect(page.locator('.p-tooltip:visible')).toHaveCount(0);
  expect(api.peticionesSinInterceptar).toEqual([]);
});

test('refresca el contexto físico cuando cambia el resumen del día', async ({
  page,
}) => {
  const api = await prepararCalendario(page);
  const compacto = evento(page, 'Fisico corto 15');
  const superficie = compacto.locator('[data-testid="event-overflow-surface"]');
  await expect(superficie).toHaveAttribute('aria-label', /Plan físico: 2\/4/);

  await page.evaluate(() => {
    interface DisciplinaResumen {
      nombre: string;
      grupo: string;
      color: string;
      realizado: boolean;
    }
    interface ResumenFisico {
      fecha: string;
      bloqueId: number;
      disciplinas: DisciplinaResumen[];
    }
    interface SignalResumenFisico {
      (): ResumenFisico[];
      set(value: ResumenFisico[]): void;
    }
    interface AngularDebug {
      getComponent(
        element: Element | null,
      ): { resumenFisica: SignalResumenFisico } | null;
      applyChanges(component: unknown): void;
    }
    const angular = (window as unknown as { ng?: AngularDebug }).ng;
    const planificacion = angular?.getComponent(
      document.querySelector('app-planificacion-mensual-edit'),
    );
    if (!angular || !planificacion) {
      throw new Error('No se encontró el componente de planificación');
    }
    const fecha = planificacion.resumenFisica()[0]?.fecha;
    if (!fecha) throw new Error('No hay resumen físico cargado');
    planificacion.resumenFisica.set([
      {
        fecha,
        bloqueId: 77,
        disciplinas: [
          {
            nombre: 'Carrera de fondo',
            grupo: 'CARRERA',
            color: '#123456',
            realizado: true,
          },
          {
            nombre: 'Cuerda doble',
            grupo: 'CUERDA',
            color: '#9fe2d0',
            realizado: true,
          },
        ],
      },
    ]);
    angular.applyChanges(planificacion);
  });

  await expect(superficie).toHaveAttribute('aria-label', /Plan físico: 2\/2/);
  await expect(superficie).toHaveAttribute(
    'aria-label',
    /Cuerda doble \(realizada\)/,
  );
  await hoverSinTooltipPrevio(page, superficie);
  const tooltip = page.locator('.p-tooltip');
  await expect(tooltip).toBeVisible();
  const contexto = tooltip.locator('.event-context-text');
  await expect(contexto).toContainText('Plan físico: 2/2');
  await expect(contexto).toContainText('Carrera de fondo (realizada)');
  await expect(contexto).toContainText('Cuerda doble (realizada)');
  await expect(contexto).not.toContainText('Natación técnica');
  expect(api.peticionesSinInterceptar).toEqual([]);
});

interface Rectangulo {
  x: number;
  y: number;
  width: number;
  height: number;
}

function seSolapan(a: Rectangulo, b: Rectangulo): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

async function comprobarControlHastaBordes(
  control: Locator,
  minimo: number,
): Promise<Rectangulo> {
  const caja = await control.boundingBox();
  expect(caja).not.toBeNull();
  expect(caja!.width).toBeGreaterThanOrEqual(minimo - 0.1);
  expect(caja!.height).toBeGreaterThanOrEqual(minimo - 0.1);
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
  return caja!;
}

async function estadoPersistidoDeEventos(page: Page, ids: number[]) {
  return page.evaluate((eventIds) => {
    interface EventoConMeta {
      title?: string;
      start: Date | string;
      end?: Date | string | null;
      meta?: { subBloque?: { id?: number; duracion?: number } };
    }
    const angular = (
      window as unknown as {
        ng?: {
          getComponent: (
            el: Element | null,
          ) => { events?: EventoConMeta[] } | null;
        };
      }
    ).ng;
    const componente = angular?.getComponent(
      document.querySelector('app-vista-semanal'),
    );
    return (componente?.events ?? [])
      .filter((calendarEvent) =>
        eventIds.includes(calendarEvent.meta?.subBloque?.id ?? -1),
      )
      .map((calendarEvent) => ({
        id: calendarEvent.meta?.subBloque?.id,
        title: calendarEvent.title,
        start: new Date(calendarEvent.start).toISOString(),
        end: calendarEvent.end
          ? new Date(calendarEvent.end).toISOString()
          : null,
        duracion: calendarEvent.meta?.subBloque?.duracion,
      }))
      .sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
  }, ids);
}

test('dos eventos consecutivos de 15 min no se cubren ni alteran sus horas', async ({
  page,
}) => {
  const api = await prepararCalendario(page);
  const quinceA = evento(page, 'Quince A');
  const quinceB = evento(page, 'Quince B');
  await quinceA.scrollIntoViewIfNeeded();
  await expect(quinceA.locator('.event-title strong')).toBeVisible();
  await expect(quinceB.locator('.event-title strong')).toBeVisible();

  const tarjetaA = await quinceA
    .locator('.custom-event-template')
    .boundingBox();
  const tarjetaB = await quinceB
    .locator('.custom-event-template')
    .boundingBox();
  expect(tarjetaA).not.toBeNull();
  expect(tarjetaB).not.toBeNull();
  expect(seSolapan(tarjetaA!, tarjetaB!)).toBe(false);
  // La cuadrícula conserva la escala: 15 min siguen siendo 15px de separación.
  expect(tarjetaB!.y - tarjetaA!.y).toBeCloseTo(15, 0);

  const controlesA: Rectangulo[] = [];
  const controlesB: Rectangulo[] = [];
  for (const [tarjeta, controles, prefijo] of [
    [quinceA, controlesA, 'A'],
    [quinceB, controlesB, 'B'],
  ] as const) {
    const cajaTarjeta = await tarjeta
      .locator('.custom-event-template')
      .boundingBox();
    expect(cajaTarjeta).not.toBeNull();
    for (const testId of ['completion-toggle', 'event-comment-button']) {
      const caja = await comprobarControlHastaBordes(
        tarjeta.getByTestId(testId),
        24,
      );
      expect(caja.x).toBeGreaterThanOrEqual(cajaTarjeta!.x - 0.5);
      expect(caja.y).toBeGreaterThanOrEqual(cajaTarjeta!.y - 0.5);
      expect(caja.x + caja.width).toBeLessThanOrEqual(
        cajaTarjeta!.x + cajaTarjeta!.width + 0.5,
      );
      expect(caja.y + caja.height).toBeLessThanOrEqual(
        cajaTarjeta!.y + cajaTarjeta!.height + 0.5,
      );
      if (prefijo === 'A') controlesA.push(caja);
      else controlesB.push(caja);
    }
  }
  for (const controlA of controlesA) {
    for (const controlB of controlesB) {
      expect(seSolapan(controlA, controlB)).toBe(false);
    }
  }

  const antes = await estadoPersistidoDeEventos(page, [9107, 9108]);
  expect(antes).toHaveLength(2);
  expect(
    antes.map((calendarEvent) => ({
      id: calendarEvent.id,
      duracion: calendarEvent.duracion,
    })),
  ).toEqual([
    { id: 9107, duracion: 15 },
    { id: 9108, duracion: 15 },
  ]);

  await quinceA.getByTestId('completion-toggle').click();
  await expect(quinceA.getByTestId('completion-toggle')).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await quinceB.getByTestId('completion-toggle').click();
  await expect(quinceB.getByTestId('completion-toggle')).toHaveAttribute(
    'aria-checked',
    'true',
  );

  expect(api.cambiosProgreso).toEqual([
    { subBloqueId: 9107, planificacionId: PLAN_ID, realizado: true },
    { subBloqueId: 9108, planificacionId: PLAN_ID, realizado: true },
  ]);
  const despues = await estadoPersistidoDeEventos(page, [9107, 9108]);
  expect(despues).toEqual(antes);
  expect(api.peticionesSinInterceptar).toEqual([]);
});
