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

const PLAN_ID = 88101;
const hoy = new Date();
hoy.setHours(9, 0, 0, 0);
const fechaHoy = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
const TITULO_ASIGNADA = 'Tarea asignada';
const TITULO_OTRA = 'Otra tarea';
const TITULO_LARGA = 'Evento largo con instrucciones extensas';
const TITULO_FISICA = 'Entrenamiento del día';
const TITULO_PERSONAL = 'Personal con nota';

const INSTRUCCIONES = [
  '**Instrucción destacada** con [enlace de apoyo](https://example.test/apoyo).',
  '',
  '- Primer paso del temario',
  '- Segundo paso del temario',
  '- Tercer paso del temario',
  '',
  ...Array.from(
    { length: 24 },
    (_, indice) =>
      `Párrafo ${indice + 1}: contenido completo que debe conservarse en el panel, sin recortar ni sustituir por un resumen.`,
  ),
  'FIN DE LAS INSTRUCCIONES COMPLETAS',
].join('\n\n');

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

function subBloques() {
  return [
    {
      id: 7101,
      planificacionId: PLAN_ID,
      nombre: TITULO_ASIGNADA,
      horaInicio: minutos(0).toISOString(),
      duracion: 60,
      color: '#f59e0b',
      comentarios: INSTRUCCIONES,
      comentariosAlumno: 'Comentario previo',
      realizado: false,
      importante: true,
      tiempoAviso: 30,
    },
    {
      id: 7102,
      planificacionId: PLAN_ID,
      nombre: TITULO_OTRA,
      horaInicio: minutos(60).toISOString(),
      duracion: 60,
      color: '#60a5fa',
      comentarios: 'Otra descripción breve.',
      comentariosAlumno: '',
      realizado: false,
    },
    {
      id: 7103,
      planificacionId: PLAN_ID,
      nombre: TITULO_FISICA,
      horaInicio: minutos(120).toISOString(),
      duracion: 60,
      color: '#34d399',
      comentarios: 'Entrenamiento vinculado del día.',
      comentariosAlumno: '',
      realizado: false,
      esEntrenamientoFisico: true,
    },
    {
      id: 7104,
      planificacionId: PLAN_ID,
      nombre: TITULO_LARGA,
      horaInicio: minutos(180).toISOString(),
      duracion: 120,
      color: '#c084fc',
      comentarios: INSTRUCCIONES,
      comentariosAlumno: '',
      realizado: false,
    },
  ];
}

function eventosPersonalizados() {
  return [
    {
      id: 7201,
      planificacionId: PLAN_ID,
      nombre: TITULO_PERSONAL,
      descripcion: '**Nota personal** con detalle libre.',
      horaInicio: minutos(300).toISOString(),
      duracion: 45,
      color: '#4caf50',
      importante: false,
      tiempoAviso: null,
      realizado: false,
    },
  ];
}

interface ComentarioRetenido {
  body: Record<string, unknown>;
  resolver: (status: number) => void;
}

interface BorradoRetenido {
  id: string;
  resolver: (status: number) => void;
}

interface ControlApi {
  peticionesSinInterceptar: string[];
  progreso: Array<Record<string, unknown>>;
  personales: Array<Record<string, unknown>>;
  borradosPersonales: string[];
  comentariosRetenidos: ComentarioRetenido[];
  borradosRetenidos: BorradoRetenido[];
  retenerComentarios: boolean;
  retenerBorrados: boolean;
  completados: number;
  borradosCompletados: number;
  liberarComentario: (status?: number, indice?: number) => Promise<void>;
  liberarBorrado: (status?: number) => Promise<void>;
}

async function prepararCalendario(
  page: Page,
  role: 'ALUMNO' | 'ADMIN' = 'ALUMNO',
): Promise<ControlApi> {
  const control: ControlApi = {
    peticionesSinInterceptar: [],
    progreso: [],
    personales: [],
    borradosPersonales: [],
    comentariosRetenidos: [],
    borradosRetenidos: [],
    retenerComentarios: false,
    retenerBorrados: false,
    completados: 0,
    borradosCompletados: 0,
    liberarComentario: async (status = 201, indice = 0) => {
      const [retenido] = control.comentariosRetenidos.splice(indice, 1);
      if (!retenido) throw new Error('No hay comentario retenido');
      const objetivo = control.completados + 1;
      retenido.resolver(status);
      await expect
        .poll(() => control.completados)
        .toBeGreaterThanOrEqual(objetivo);
    },
    liberarBorrado: async (status = 200) => {
      const retenido = control.borradosRetenidos.shift();
      if (!retenido) throw new Error('No hay borrado retenido');
      const objetivo = control.borradosCompletados + 1;
      retenido.resolver(status);
      await expect
        .poll(() => control.borradosCompletados)
        .toBeGreaterThanOrEqual(objetivo);
    },
  };

  await page.route('**/*', async (route) => {
    const tipo = route.request().resourceType();
    if (tipo === 'xhr' || tipo === 'fetch') {
      control.peticionesSinInterceptar.push(route.request().url());
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
          identificador: 'QA-EVENT-SHEET',
          descripcion: 'Calendario sintético del panel de evento',
          mes: hoy.getMonth() + 1,
          ano: hoy.getFullYear(),
          relevancia: [],
          esPorDefecto: false,
          tipoDePlanificacion: 'FRANJA_CUATRO_A_SEIS_HORAS',
          subBloques: subBloques(),
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
              realizado: true,
            },
            {
              nombre: 'Cuerda',
              grupo: 'CUERDA',
              color: '#9fe2d0',
              realizado: false,
            },
            {
              nombre: 'Natación',
              grupo: 'NATACION',
              color: '#60a5fa',
              realizado: true,
            },
            {
              nombre: 'Fuerza',
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
  await page.route(`**/adjuntos/PLANIFICACION_MENSUAL/${PLAN_ID}`, (route) =>
    route.fulfill({ contentType: 'application/json', body: '[]' }),
  );

  await page.route(
    '**/planificaciones/actualizar-progreso-subbloque',
    async (route) => {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      control.progreso.push(body);
      if (
        control.retenerComentarios &&
        body['comentariosAlumno'] !== undefined
      ) {
        const status = await new Promise<number>((resolver) => {
          control.comentariosRetenidos.push({ body, resolver });
        });
        await route.fulfill({
          status,
          contentType: 'application/json',
          body:
            status >= 400
              ? JSON.stringify({ message: 'Error de red simulado' })
              : '{}',
        });
        control.completados += 1;
        return;
      }
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
      control.personales.push(
        route.request().postDataJSON() as Record<string, unknown>,
      );
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: '{}',
      });
    },
  );
  await page.route('**/eventos-personalizados/actualizar', async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    control.personales.push(body);
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ ...body, id: body['id'] ?? 7201 }),
    });
  });
  await page.route('**/eventos-personalizados/7201', async (route) => {
    if (route.request().method() !== 'DELETE') return route.continue();
    control.borradosPersonales.push('7201');
    if (control.retenerBorrados) {
      const status = await new Promise<number>((resolver) => {
        control.borradosRetenidos.push({ id: '7201', resolver });
      });
      await route.fulfill({
        status,
        contentType: 'application/json',
        body: status >= 400 ? JSON.stringify({ message: 'error' }) : '{}',
      });
      control.borradosCompletados += 1;
      return;
    }
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.route('**/planificacion-fisica/mis-bloques', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify([]),
    }),
  );
  await page.route('**/planificacion-fisica/mi-plan**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        bloque: {
          id: 77,
          identificador: 'BLOQUE-QA',
          comentarioGeneral: null,
          fechaInicioSemana1: fechaHoy,
          numSemanas: 1,
          relevancia: [],
          estado: 'PUBLICADO',
        },
        hoy: fechaHoy,
        semanas: [],
      }),
    }),
  );
  await page.route('**/planificacion-fisica/dia/**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        fecha: fechaHoy,
        comentarioSemana: null,
        comentarioGeneral: null,
        intensidad: 50,
        numeroSemana: 1,
        identificadorBloque: 'BLOQUE-QA',
        tipoPlan: 'PREMIUM',
        soloLectura: false,
        esHoy: true,
        disciplinas: [],
      }),
    }),
  );

  if (role === 'ADMIN') {
    await loginAsAdminMock(page, usuarioAlumno);
  } else {
    await loginAsRoleMock(page, {
      rol: 'ALUMNO',
      email: 'alumno@test.com',
      userFixture: usuarioAlumno,
    });
  }

  return control;
}

async function abrirCalendario(
  page: Page,
  role: 'ALUMNO' | 'ADMIN' = 'ALUMNO',
  viewport = { width: 1440, height: 900 },
) {
  await page.setViewportSize(viewport);
  const ruta =
    role === 'ADMIN'
      ? `/app/planificacion/planificacion-mensual/${PLAN_ID}`
      : `/app/planificacion/planificacion-mensual-alumno/${PLAN_ID}`;
  await page.goto(ruta);
  await expect(page.locator('app-vista-semanal')).toBeVisible();
  await expect(page.locator('.event-title strong').first()).toBeVisible();
  const vista = page.viewportSize();
  if (vista) await page.mouse.move(vista.width - 16, 2);
}

function tarjeta(page: Page, titulo: string): Locator {
  return page
    .locator('.wrapper')
    .filter({ has: page.locator('.event-title strong', { hasText: titulo }) })
    .first();
}

async function abrirPanel(page: Page, titulo: string) {
  const evento = tarjeta(page, titulo);
  await evento.scrollIntoViewIfNeeded();
  await evento.locator('.event-text').click();
  const panel = page.locator('.event-sheet-dialog');
  await expect(panel).toBeVisible();
  await expect(panel).not.toHaveClass(/ng-animating/);
  return { evento, panel };
}

async function capturar(page: Page, testInfo: TestInfo, nombre: string) {
  const directorio = process.env['QA_EVIDENCE_DIR'];
  if (!directorio) return;
  await mkdir(directorio, { recursive: true });
  await page.screenshot({
    path: join(directorio, `${testInfo.project.name}-${nombre}.png`),
  });
}

function caja(locator: Locator) {
  return locator.boundingBox();
}

test.describe('panel de evento del calendario', () => {
  test.use({ hasTouch: true });

  test('la tarjeta deja el checkbox arriba a la izquierda y el panel muestra el detalle completo', async ({
    page,
  }, testInfo) => {
    const api = await prepararCalendario(page);
    await abrirCalendario(page);

    const evento = tarjeta(page, TITULO_ASIGNADA);
    await evento.scrollIntoViewIfNeeded();
    await expect(evento.locator('.event-actions')).toHaveCount(0);
    await expect(evento.getByTestId('event-comment-button')).toHaveCount(0);
    await expect(evento.getByTestId('event-delete-button')).toHaveCount(0);
    await expect(evento.getByTestId('fisica-vinculada-icono')).toHaveCount(0);

    const cajaTarjeta = await caja(evento.locator('.custom-event-template'));
    const cajaCasilla = await caja(evento.getByTestId('completion-toggle'));
    const cajaVisible = await caja(evento.getByTestId('completion-box'));
    const cajaTitulo = await caja(evento.locator('.event-title strong'));
    expect(cajaTarjeta).not.toBeNull();
    expect(cajaCasilla).not.toBeNull();
    expect(cajaVisible).not.toBeNull();
    expect(cajaTitulo).not.toBeNull();
    expect(cajaCasilla!.width).toBeGreaterThanOrEqual(44);
    expect(cajaCasilla!.height).toBeGreaterThanOrEqual(44);
    expect(cajaVisible!.width).toBeCloseTo(18, 0);
    expect(cajaVisible!.height).toBeCloseTo(18, 0);
    expect(cajaVisible!.x).toBeGreaterThanOrEqual(cajaTarjeta!.x);
    expect(cajaVisible!.y).toBeGreaterThanOrEqual(cajaTarjeta!.y);
    expect(Math.abs(cajaVisible!.y - cajaTitulo!.y)).toBeLessThanOrEqual(1.5);
    expect(cajaVisible!.x + cajaVisible!.width).toBeLessThan(cajaTitulo!.x);

    const trigger = evento.locator('.event-text');
    await trigger.focus();
    await page.keyboard.press('Enter');
    const panel = page.locator('.event-sheet-dialog');
    await expect(panel).toBeVisible();
    await expect(panel).not.toHaveClass(/ng-animating/);
    await expect(panel.getByTestId('event-sheet-title')).toHaveText(
      TITULO_ASIGNADA,
    );
    await expect(panel.getByTestId('event-sheet-status')).toHaveText(
      'Pendiente',
    );
    await expect(panel.getByTestId('event-sheet-type')).toHaveText(
      'Tarea del plan',
    );
    await expect(panel.getByTestId('event-sheet-important')).toHaveText(
      'Importante',
    );
    await expect(panel.getByTestId('event-sheet-notice')).toHaveText(
      'Aviso 30 min',
    );
    await expect(panel.getByTestId('event-sheet-when')).toContainText('60 min');
    const instrucciones = panel.getByTestId('event-sheet-instructions');
    await expect(instrucciones).toContainText(
      'FIN DE LAS INSTRUCCIONES COMPLETAS',
    );
    await expect(instrucciones.locator('strong')).toHaveText(
      'Instrucción destacada',
    );
    await expect(instrucciones.locator('ul li')).toHaveCount(3);
    await expect(instrucciones.locator('a')).toHaveAttribute(
      'href',
      'https://example.test/apoyo',
    );
    const clamp = await instrucciones.evaluate(
      (element) => getComputedStyle(element).webkitLineClamp,
    );
    expect(clamp).toBe('none');

    const comentario = panel.getByTestId('event-sheet-comment');
    await expect(comentario).toHaveValue('Comentario previo');
    await expect(panel.getByTestId('event-sheet-comment-save')).toBeDisabled();
    await expect(page.getByTestId('event-sheet-edit')).toHaveCount(0);
    await expect(page.getByTestId('event-sheet-delete')).toHaveCount(0);

    const footer = panel.locator('.p-dialog-footer');
    const cajaPanel = await caja(panel);
    const cajaFooter = await caja(footer);
    expect(cajaPanel).not.toBeNull();
    expect(cajaFooter).not.toBeNull();
    expect(cajaPanel!.y + cajaPanel!.height).toBeLessThanOrEqual(901);
    expect(cajaFooter!.y + cajaFooter!.height).toBeLessThanOrEqual(901);
    expect(
      await page
        .locator('.weekly-calendar')
        .evaluate((el) => getComputedStyle(el).overflow),
    ).toBe('hidden');

    const scrollAntes = await page
      .locator('.weekly-calendar')
      .evaluate((el) => el.scrollTop);
    await page.mouse.move(200, 500);
    await page.mouse.wheel(0, 400);
    expect(
      await page.locator('.weekly-calendar').evaluate((el) => el.scrollTop),
    ).toBe(scrollAntes);
    await capturar(page, testInfo, 'event-sheet-1440-comentario');

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('event-sheet-content')).toBeHidden();
    await expect(trigger).toBeFocused();
    expect(api.peticionesSinInterceptar).toEqual([]);
  });

  test('marcar y comentar desde el panel usan las APIs existentes y mantienen la tarjeta', async ({
    page,
  }, testInfo) => {
    const api = await prepararCalendario(page);
    await abrirCalendario(page);
    const { evento, panel } = await abrirPanel(page, TITULO_ASIGNADA);

    const casilla = evento.getByTestId('completion-toggle');
    await panel.getByTestId('event-sheet-toggle').click();
    await expect(panel.getByTestId('event-sheet-status')).toHaveText(
      'Realizada',
    );
    await expect(casilla).toHaveAttribute('aria-checked', 'true');
    expect(api.progreso).toContainEqual({
      subBloqueId: 7101,
      planificacionId: PLAN_ID,
      realizado: true,
    });

    api.retenerComentarios = true;
    const comentario = panel.getByTestId('event-sheet-comment');
    await comentario.fill('Comentario desde el panel');
    await panel.getByTestId('event-sheet-comment-save').click();
    await expect(panel.getByTestId('event-sheet-comment-saving')).toBeVisible();
    await expect(comentario).toBeDisabled();
    await expect.poll(() => api.comentariosRetenidos.length).toBe(1);
    await panel
      .getByTestId('event-sheet-comment-save')
      .evaluate((element) => (element as HTMLButtonElement).click());
    expect(
      api.progreso.filter((body) => body['comentariosAlumno'] !== undefined),
    ).toHaveLength(1);

    await api.liberarComentario(201);
    await expect(panel.getByTestId('event-sheet-comment-saved')).toBeVisible();
    await expect(comentario).toBeEnabled();
    await expect(panel.getByTestId('event-sheet-comment-save')).toBeDisabled();
    expect(api.progreso).toContainEqual({
      subBloqueId: 7101,
      planificacionId: PLAN_ID,
      comentariosAlumno: 'Comentario desde el panel',
    });

    await capturar(page, testInfo, 'event-sheet-1440-comentario-guardado');
    await panel.getByTestId('event-sheet-close').click();
    await expect(page.getByTestId('event-sheet-content')).toBeHidden();
    await abrirPanel(page, TITULO_ASIGNADA);
    await expect(
      page
        .getByTestId('event-sheet-content')
        .getByTestId('event-sheet-comment'),
    ).toHaveValue('Comentario desde el panel');
    expect(api.peticionesSinInterceptar).toEqual([]);
  });

  test('un error de comentario conserva el borrador, permite reintentar y no duplica peticiones', async ({
    page,
  }, testInfo) => {
    const api = await prepararCalendario(page);
    await abrirCalendario(page);
    const { panel } = await abrirPanel(page, TITULO_ASIGNADA);

    api.retenerComentarios = true;
    const comentario = panel.getByTestId('event-sheet-comment');
    await comentario.fill('Comentario que falla');
    await panel.getByTestId('event-sheet-comment-save').click();
    await expect.poll(() => api.comentariosRetenidos.length).toBe(1);
    await api.liberarComentario(503);

    await expect(panel.getByTestId('event-sheet-comment-error')).toContainText(
      'No se pudo guardar el comentario',
    );
    await expect(comentario).toHaveValue('Comentario que falla');
    await expect(comentario).toBeEnabled();
    await expect(panel.getByTestId('event-sheet-comment-save')).toBeEnabled();
    await expect(panel.getByTestId('event-sheet-comment-saved')).toHaveCount(0);
    await panel
      .getByTestId('event-sheet-comment-save')
      .scrollIntoViewIfNeeded();
    await capturar(page, testInfo, 'event-sheet-1440-comentario-error');

    await comentario.fill('Comentario reintentado');
    await panel.getByTestId('event-sheet-comment-save').click();
    await expect.poll(() => api.comentariosRetenidos.length).toBe(1);
    await api.liberarComentario(201);
    await expect(panel.getByTestId('event-sheet-comment-error')).toHaveCount(0);
    await expect(panel.getByTestId('event-sheet-comment-saved')).toBeVisible();
    expect(api.progreso).toContainEqual({
      subBloqueId: 7101,
      planificacionId: PLAN_ID,
      comentariosAlumno: 'Comentario reintentado',
    });
    expect(api.peticionesSinInterceptar).toEqual([]);
  });

  test('cerrar el panel y abrir otro evento mientras guarda no aplica la respuesta al evento equivocado', async ({
    page,
  }) => {
    const api = await prepararCalendario(page);
    await abrirCalendario(page);
    const primera = await abrirPanel(page, TITULO_ASIGNADA);

    api.retenerComentarios = true;
    await primera.panel.getByTestId('event-sheet-comment').fill('Comentario A');
    await primera.panel.getByTestId('event-sheet-comment-save').click();
    await expect.poll(() => api.comentariosRetenidos.length).toBe(1);
    await primera.panel.getByTestId('event-sheet-close').click();
    await expect(page.getByTestId('event-sheet-content')).toBeHidden();

    const segunda = await abrirPanel(page, TITULO_OTRA);
    await segunda.panel.getByTestId('event-sheet-comment').fill('Comentario B');
    await segunda.panel.getByTestId('event-sheet-comment-save').click();
    await expect.poll(() => api.comentariosRetenidos.length).toBe(2);

    await api.liberarComentario(201);
    await expect(segunda.panel.getByTestId('event-sheet-comment')).toHaveValue(
      'Comentario B',
    );
    await expect(
      segunda.panel.getByTestId('event-sheet-comment-saved'),
    ).toHaveCount(0);

    await api.liberarComentario(201);
    await expect(
      segunda.panel.getByTestId('event-sheet-comment-saved'),
    ).toBeVisible();
    await segunda.panel.getByTestId('event-sheet-close').click();
    await expect(page.getByTestId('event-sheet-content')).toBeHidden();

    await abrirPanel(page, TITULO_ASIGNADA);
    await expect(
      page
        .getByTestId('event-sheet-content')
        .getByTestId('event-sheet-comment'),
    ).toHaveValue('Comentario A');
    expect(api.peticionesSinInterceptar).toEqual([]);
  });

  test('un ACK tardío de A no retira el feedback ya mostrado para B', async ({
    page,
  }) => {
    const api = await prepararCalendario(page);
    await abrirCalendario(page);
    api.retenerComentarios = true;

    const primera = await abrirPanel(page, TITULO_ASIGNADA);
    await primera.panel.getByTestId('event-sheet-comment').fill('Comentario A');
    await primera.panel.getByTestId('event-sheet-comment-save').click();
    await expect.poll(() => api.comentariosRetenidos.length).toBe(1);
    await primera.panel.getByTestId('event-sheet-close').click();
    await expect(page.getByTestId('event-sheet-content')).toBeHidden();

    const segunda = await abrirPanel(page, TITULO_OTRA);
    await segunda.panel.getByTestId('event-sheet-comment').fill('Comentario B');
    await segunda.panel.getByTestId('event-sheet-comment-save').click();
    await expect.poll(() => api.comentariosRetenidos.length).toBe(2);

    // B responde primero y muestra su feedback; el ACK viejo de A llega después.
    await api.liberarComentario(201, 1);
    await expect(
      segunda.panel.getByTestId('event-sheet-comment-saved'),
    ).toBeVisible();
    await api.liberarComentario(201, 0);

    await expect(
      segunda.panel.getByTestId('event-sheet-comment-saved'),
    ).toBeVisible();
    await expect(segunda.panel.getByTestId('event-sheet-comment')).toHaveValue(
      'Comentario B',
    );
    await expect(segunda.panel.getByTestId('event-sheet-title')).toHaveText(
      TITULO_OTRA,
    );
    expect(api.peticionesSinInterceptar).toEqual([]);
  });

  test('el DELETE personal pendiente no cierra B ni se duplica al reabrir A', async ({
    page,
  }, testInfo) => {
    const api = await prepararCalendario(page);
    await abrirCalendario(page);
    const personal = await abrirPanel(page, TITULO_PERSONAL);
    api.retenerBorrados = true;

    await page.getByTestId('event-sheet-delete').click();
    await page.getByTestId('event-sheet-delete-confirm-button').click();
    await expect.poll(() => api.borradosRetenidos.length).toBe(1);
    await expect(
      page.getByTestId('event-sheet-delete-confirm-button'),
    ).toBeDisabled();

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('event-sheet-content')).toBeHidden();
    await abrirPanel(page, TITULO_PERSONAL);
    await expect(page.getByTestId('event-sheet-delete')).toBeDisabled();
    expect(api.borradosPersonales).toEqual(['7201']);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('event-sheet-content')).toBeHidden();

    const otra = await abrirPanel(page, TITULO_OTRA);
    await otra.panel.getByTestId('event-sheet-comment').fill('Borrador B');
    await api.liberarBorrado(200);

    await expect(page.getByTestId('event-sheet-content')).toBeVisible();
    await expect(otra.panel.getByTestId('event-sheet-title')).toHaveText(
      TITULO_OTRA,
    );
    await expect(otra.panel.getByTestId('event-sheet-comment')).toHaveValue(
      'Borrador B',
    );
    await expect(page.getByTestId('event-sheet-delete-confirm')).toHaveCount(0);
    await expect(tarjeta(page, TITULO_PERSONAL)).toHaveCount(0);
    await capturar(page, testInfo, 'event-sheet-1440-delete-pendiente');

    await otra.panel.getByTestId('event-sheet-close').click();
    await expect(page.getByTestId('event-sheet-content')).toBeHidden();
    await abrirPanel(page, TITULO_OTRA);
    await expect(
      page
        .getByTestId('event-sheet-content')
        .getByTestId('event-sheet-comment'),
    ).toHaveValue('Borrador B');
    expect(api.borradosPersonales).toEqual(['7201']);
    expect(api.peticionesSinInterceptar).toEqual([]);
  });

  test('un drag real no abre el panel, pero el click siguiente sí', async ({
    page,
  }) => {
    const api = await prepararCalendario(page);
    await abrirCalendario(page);
    const evento = tarjeta(page, TITULO_ASIGNADA);
    await evento.scrollIntoViewIfNeeded();
    // Drag válido: mueve el evento y no abre el panel al soltar.
    const antesDrag = await evento.boundingBox();
    expect(antesDrag).not.toBeNull();
    await page.mouse.move(
      antesDrag!.x + antesDrag!.width / 2,
      antesDrag!.y + 20,
    );
    await page.mouse.down();
    await page.mouse.move(
      antesDrag!.x + antesDrag!.width / 2,
      antesDrag!.y + 80,
      { steps: 6 },
    );
    await page.mouse.up();
    await expect(page.getByTestId('event-sheet-content')).toBeHidden();
    await expect.poll(() => api.progreso.length).toBe(1);
    expect(api.progreso[0]).toMatchObject({
      subBloqueId: 7101,
      planificacionId: PLAN_ID,
    });
    expect(api.progreso[0]['posicionPersonalizada']).toBeTruthy();

    const despues = await evento.boundingBox();
    expect(despues).not.toBeNull();
    await page.mouse.click(despues!.x + despues!.width / 2, despues!.y + 20);
    await expect(page.locator('.event-sheet-dialog')).toBeVisible();
    expect(api.peticionesSinInterceptar).toEqual([]);
  });

  test('la casilla admite teclado y touch/pan sin abrir el panel', async ({
    page,
  }, testInfo) => {
    const api = await prepararCalendario(page);
    await abrirCalendario(page, 'ALUMNO', { width: 390, height: 844 });
    const evento = tarjeta(page, TITULO_ASIGNADA);
    await evento.scrollIntoViewIfNeeded();
    const casilla = evento.getByTestId('completion-toggle');

    await casilla.focus();
    await page.keyboard.press('Space');
    await expect(casilla).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('event-sheet-content')).toBeHidden();
    await expect.poll(() => api.progreso.length).toBe(1);
    expect(api.progreso[0]).toMatchObject({
      subBloqueId: 7101,
      planificacionId: PLAN_ID,
      realizado: true,
    });

    const cajaEvento = await evento.boundingBox();
    expect(cajaEvento).not.toBeNull();
    await page.touchscreen.tap(
      cajaEvento!.x + cajaEvento!.width / 2,
      cajaEvento!.y + 20,
    );
    const panel = page.locator('.event-sheet-dialog');
    await expect(panel).toBeVisible();
    await expect(panel).not.toHaveClass(/ng-animating/);
    await expect(panel).toHaveCSS('width', '390px');
    await expect(panel.getByTestId('event-sheet-title')).toHaveText(
      TITULO_ASIGNADA,
    );
    expect((await panel.boundingBox())!.height).toBeLessThanOrEqual(844 * 0.86);
    const footer = await panel.locator('.p-dialog-footer').boundingBox();
    expect(footer).not.toBeNull();
    expect(footer!.y + footer!.height).toBeLessThanOrEqual(845);
    expect(
      await panel
        .locator('.p-dialog-content')
        .evaluate((element) => element.scrollHeight > element.clientHeight),
    ).toBe(true);
    await capturar(page, testInfo, 'event-sheet-390');
    await panel
      .locator('.p-dialog-content')
      .evaluate((element) => (element.scrollTop = element.scrollHeight));
    await capturar(page, testInfo, 'event-sheet-390-comentario');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('event-sheet-content')).toBeHidden();

    const cajaCasilla = await casilla.boundingBox();
    expect(cajaCasilla).not.toBeNull();
    await page.touchscreen.tap(
      cajaCasilla!.x + cajaCasilla!.width / 2,
      cajaCasilla!.y + cajaCasilla!.height / 2,
    );
    await expect(casilla).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByTestId('event-sheet-content')).toBeHidden();
    await expect.poll(() => api.progreso.length).toBe(2);

    const cliente = await page.context().newCDPSession(page);
    const cajaTarjeta = await evento.boundingBox();
    expect(cajaTarjeta).not.toBeNull();
    const x = cajaTarjeta!.x + cajaTarjeta!.width / 2;
    const y = cajaTarjeta!.y + 20;
    await cliente.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x, y }],
    });
    for (let paso = 1; paso <= 5; paso++) {
      await cliente.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x, y: y - paso * 20 }],
      });
    }
    await cliente.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
    await page.waitForTimeout(200);
    await expect(page.getByTestId('event-sheet-content')).toBeHidden();
    expect(api.peticionesSinInterceptar).toEqual([]);
  });

  test('el plan físico y las disciplinas se consultan de forma explícita desde el panel', async ({
    page,
  }, testInfo) => {
    const api = await prepararCalendario(page);
    await abrirCalendario(page);
    const { evento, panel } = await abrirPanel(page, TITULO_FISICA);

    await expect(evento.getByTestId('fisica-vinculada-estado')).toHaveCount(0);
    await expect(panel.getByTestId('event-sheet-fisica')).toBeVisible();
    await expect(panel.getByTestId('event-sheet-fisica-Carrera')).toContainText(
      'Realizada',
    );
    await expect(panel.getByTestId('event-sheet-fisica-Cuerda')).toContainText(
      'Pendiente',
    );
    await expect(
      panel.getByText('2 de 4 disciplinas realizadas'),
    ).toBeVisible();
    await expect(page).toHaveURL(
      new RegExp(`/planificacion-mensual-alumno/${PLAN_ID}$`),
    );

    await capturar(page, testInfo, 'event-sheet-1440-fisica');
    await panel.getByRole('button', { name: 'Ver plan físico' }).click();
    await expect(page).toHaveURL(
      new RegExp(
        `planificacion-fisica/dia/${fechaHoy}\\?bloqueId=77&originPlanificacionId=${PLAN_ID}`,
      ),
    );
    expect(api.peticionesSinInterceptar).toEqual([]);
  });

  test('el evento personal edita su nota existente, confirma el borrado y no pide comentario', async ({
    page,
  }) => {
    const api = await prepararCalendario(page);
    await abrirCalendario(page);
    const { panel } = await abrirPanel(page, TITULO_PERSONAL);

    await expect(panel.getByTestId('event-sheet-type')).toHaveText(
      'Evento personal',
    );
    await expect(panel.getByTestId('event-sheet-comment-section')).toHaveCount(
      0,
    );
    await expect(panel.getByTestId('event-sheet-instructions')).toContainText(
      'Nota personal',
    );
    await expect(page.getByTestId('event-sheet-edit')).toBeVisible();
    await expect(page.getByTestId('event-sheet-delete')).toBeVisible();

    await page.getByTestId('event-sheet-edit').click();
    await expect(page.getByTestId('event-sheet-content')).toBeHidden();
    const editor = page.locator('.p-dialog:visible').filter({
      hasText: 'Evento Personalizado',
    });
    await expect(editor).toBeVisible();
    await expect(editor.locator('input#nombre')).toHaveValue(TITULO_PERSONAL);
    await editor.getByRole('button', { name: 'Cancelar' }).click();
    await expect(editor).toBeHidden();
    await expect(page.locator('.p-dialog:visible')).toHaveCount(0);

    await abrirPanel(page, TITULO_PERSONAL);
    await page.getByTestId('event-sheet-delete').click();
    await expect(page.getByTestId('event-sheet-delete-confirm')).toBeVisible();
    await page.getByTestId('event-sheet-delete-cancel').click();
    await expect(page.getByTestId('event-sheet-delete-confirm')).toHaveCount(0);

    await page.getByTestId('event-sheet-delete').click();
    await page.getByTestId('event-sheet-delete-confirm-button').click();
    await expect(page.getByTestId('event-sheet-content')).toBeHidden();
    await expect(tarjeta(page, TITULO_PERSONAL)).toHaveCount(0);
    expect(api.borradosPersonales).toEqual(['7201']);
    expect(api.peticionesSinInterceptar).toEqual([]);
  });

  test('el administrador conserva edición y borrado de asignados con confirmación', async ({
    page,
  }) => {
    const api = await prepararCalendario(page, 'ADMIN');
    await abrirCalendario(page, 'ADMIN');
    const ruidoInicial = api.peticionesSinInterceptar.length;
    const evento = tarjeta(page, TITULO_ASIGNADA);
    await evento.scrollIntoViewIfNeeded();
    await expect(evento.getByTestId('completion-toggle')).toHaveCount(0);

    await abrirPanel(page, TITULO_ASIGNADA);
    await expect(page.getByTestId('event-sheet-edit')).toBeVisible();
    await expect(page.getByTestId('event-sheet-delete')).toBeVisible();
    await expect(page.getByTestId('event-sheet-comment-section')).toHaveCount(
      0,
    );
    await expect(page.getByTestId('event-sheet-toggle')).toHaveCount(0);

    await page.getByTestId('event-sheet-edit').click();
    await expect(page.getByTestId('event-sheet-content')).toBeHidden();
    const editor = page
      .locator('app-editar-sub-bloque-dialog')
      .locator('.p-dialog:visible');
    await expect(editor).toBeVisible();
    await editor.getByRole('button', { name: 'Cancelar' }).click();
    await expect(editor).toBeHidden();
    await expect(page.locator('.p-dialog:visible')).toHaveCount(0);

    await abrirPanel(page, TITULO_ASIGNADA);
    await page.getByTestId('event-sheet-delete').click();
    await page.getByTestId('event-sheet-delete-confirm-button').click();
    await expect(page.getByTestId('event-sheet-content')).toBeHidden();
    await expect(tarjeta(page, TITULO_ASIGNADA)).toHaveCount(0);
    expect(api.peticionesSinInterceptar.slice(ruidoInicial)).toEqual([]);
  });

  test('los enlaces del tooltip no abren el panel ni inician un drag', async ({
    page,
  }) => {
    const api = await prepararCalendario(page);
    await abrirCalendario(page);
    await page.route('https://example.test/**', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: '<!doctype html><title>Enlace de apoyo</title>',
      }),
    );

    const evento = tarjeta(page, TITULO_ASIGNADA);
    await evento.scrollIntoViewIfNeeded();
    const superficie = evento.locator('[data-testid="event-overflow-surface"]');
    await superficie.hover();
    const tooltip = page.locator('.p-tooltip:visible');
    await expect(tooltip).toBeVisible();
    const enlace = tooltip.locator('a').first();
    await expect(enlace).toBeVisible();
    const antes = await evento.boundingBox();

    await enlace.evaluate((element) =>
      element.setAttribute('target', '_blank'),
    );
    const popupPromise = page.context().waitForEvent('page');
    await enlace.click();
    const popup = await popupPromise;
    await popup.waitForLoadState('domcontentloaded');
    await popup.close();
    await expect(page.getByTestId('event-sheet-content')).toBeHidden();
    await expect(page).toHaveURL(
      new RegExp(`/planificacion-mensual-alumno/${PLAN_ID}$`),
    );
    const despues = await evento.boundingBox();
    expect(despues).toEqual(antes);
    await expect(page.locator('.cal-drag-active')).toHaveCount(0);
    expect(api.peticionesSinInterceptar).toEqual([]);
  });
});
