import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { loginAsRoleMock } from './helpers/auth.helper';
import {
  entrarModoMarcado,
  salirModoMarcado,
} from './helpers/progress-mode.helper';

const PLAN_ID = 9876;
const inicio = new Date();
inicio.setHours(12, 0, 0, 0);
const fecha = `${inicio.getFullYear()}-${String(inicio.getMonth() + 1).padStart(2, '0')}-${String(inicio.getDate()).padStart(2, '0')}`;
const TITULO_FISICA =
  'ENTRENAMIENTO físico de resistencia y fuerza con un título deliberadamente muy largo para comprobar la casilla';
const TITULO_NORMAL = 'TAREA NORMAL de teoría con instrucciones completas';
const TITULO_PERSONAL = 'Evento personal de repaso';

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

interface MockOptions {
  retenerPrimerGuardado?: boolean;
}

async function mockCalendario(page: Page, options: MockOptions = {}) {
  const estado = {
    subBloques: [
      {
        id: 98761,
        planificacionId: PLAN_ID,
        nombre: TITULO_FISICA,
        horaInicio: inicio.toISOString(),
        duracion: 60,
        color: '#f59e0b',
        comentarios: 'Indicaciones importantes de estudio',
        realizado: false,
        esEntrenamientoFisico: true,
      },
      {
        id: 98762,
        planificacionId: PLAN_ID,
        nombre: TITULO_NORMAL,
        horaInicio: new Date(inicio.getTime() + 2 * 60 * 60000).toISOString(),
        duracion: 60,
        color: '#7dd3fc',
        comentarios: 'Instrucciones completas de la tarea normal',
        realizado: false,
        esEntrenamientoFisico: false,
      },
    ],
    personales: [
      {
        id: 98001,
        planificacionId: PLAN_ID,
        nombre: TITULO_PERSONAL,
        descripcion: 'Nota personal de repaso',
        horaInicio: new Date(inicio.getTime() + 4 * 60 * 60000).toISOString(),
        duracion: 60,
        color: '#4caf50',
        importante: false,
        tiempoAviso: null,
        realizado: false,
      },
    ],
    progreso: [] as Array<Record<string, unknown>>,
    personalesGuardados: [] as Array<Record<string, unknown>>,
    personalesEditados: [] as Array<Record<string, unknown>>,
    bloqueadas: [] as string[],
  };
  let retenidoUsado = false;
  let liberarGuardado: (() => void) | undefined;

  await page.route('**/*', async (route) => {
    const request = route.request();
    const tipo = request.resourceType();
    if (tipo === 'xhr' || tipo === 'fetch') {
      estado.bloqueadas.push(request.url());
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
          identificador: 'QA-CALENDARIO',
          descripcion: 'Prueba de calendario',
          mes: inicio.getMonth() + 1,
          ano: inicio.getFullYear(),
          relevancia: [],
          esPorDefecto: false,
          tipoDePlanificacion: 'FRANJA_CUATRO_A_SEIS_HORAS',
          subBloques: estado.subBloques,
        }),
      }),
  );
  await page.route(
    `**/planificaciones/eventos-personalizados/${PLAN_ID}`,
    (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(estado.personales),
      }),
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
      estado.progreso.push(body);
      if (
        options.retenerPrimerGuardado &&
        !retenidoUsado &&
        body['realizado'] !== undefined
      ) {
        retenidoUsado = true;
        await new Promise<void>((resolve) => (liberarGuardado = resolve));
        return route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Error de red simulado' }),
        });
      }
      const subBloque = estado.subBloques.find(
        (item) => item.id === Number(body['subBloqueId']),
      );
      if (subBloque) {
        if (body['realizado'] !== undefined) {
          subBloque.realizado = Boolean(body['realizado']);
        }
        if (body['comentariosAlumno'] !== undefined) {
          subBloque.comentariosAlumno = body['comentariosAlumno'] as string;
        }
      }
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: '{}',
      });
    },
  );
  await page.route(
    '**/eventos-personalizados/actualizar-realizado',
    (route) => {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      estado.personalesGuardados.push(body);
      const personal = estado.personales.find(
        (item) => item.id === Number(body['id']),
      );
      if (personal) personal.realizado = Boolean(body['realizado']);
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: '{}',
      });
    },
  );
  await page.route(
    '**/eventos-personalizados/actualizar',
    (route) => {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      estado.personalesEditados.push(body);
      const personal = estado.personales.find(
        (item) => item.id === Number(body['id']),
      );
      if (personal) {
        personal.nombre = String(body['nombre'] ?? personal.nombre);
        personal.descripcion = String(
          body['descripcion'] ?? personal.descripcion,
        );
      }
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ id: body['id'] }),
      });
    },
  );
  // Ruido de layout que no forma parte del calendario: se responde vacío para
  // que ninguna petición llegue a la red real.
  await page.route('**/cursos/mios', (route) =>
    route.fulfill({ contentType: 'application/json', body: '[]' }),
  );
  await page.route('**/user/tutores', (route) =>
    route.fulfill({ contentType: 'application/json', body: '[]' }),
  );
  await page.route('**/planificaciones/count-planificationes-asignadas', (route) =>
    route.fulfill({ contentType: 'application/json', body: '0' }),
  );
  await page.route('**/adjuntos/PLANIFICACION_MENSUAL/**', (route) =>
    route.fulfill({ contentType: 'application/json', body: '[]' }),
  );

  await loginAsRoleMock(page, {
    rol: 'ALUMNO',
    email: 'alumno@test.com',
    userFixture: usuarioAlumno,
  });

  return {
    ...estado,
    liberarGuardado: () => liberarGuardado?.(),
  };
}

async function abrirCalendario(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await page.goto(`/app/planificacion/planificacion-mensual-alumno/${PLAN_ID}`);
  await expect(page.locator('app-vista-semanal')).toBeVisible();
  await expect(page.locator('.event-title strong').first()).toBeVisible();
}

async function capturar(page: Page, nombre: string): Promise<void> {
  const directorio = process.env['QA_EVIDENCE_DIR'];
  if (!directorio) return;
  await mkdir(directorio, { recursive: true });
  await page.mouse.move(8, 8);
  await page.screenshot({ path: join(directorio, `${nombre}.png`) });
}

async function centrarEventoHorizontal(
  page: Page,
  subBloqueId: number,
): Promise<void> {
  await page.evaluate((id) => {
    const scroller = document.querySelector('.weekly-calendar') as
      | HTMLElement
      | null;
    const card = document.querySelector(
      `[data-progress-key="subbloque:${id}"]`,
    ) as HTMLElement | null;
    if (!scroller || !card) {
      throw new Error('No se encontró el calendario o la tarjeta');
    }
    const scrollRect = scroller.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    scroller.scrollLeft += cardRect.left - scrollRect.left - 40;
  }, subBloqueId);
  await page.waitForTimeout(100);
}

function tarjeta(page: Page, titulo: string) {
  return page
    .locator('.wrapper')
    .filter({ has: page.locator('.event-title strong', { hasText: titulo }) })
    .first();
}

async function flagsDeEventos(
  page: Page,
  coleccion: 'events' | 'eventsParaCalendario' = 'events',
) {
  return page.evaluate((propiedad) => {
    const host = document.querySelector('app-vista-semanal');
    const componente = (window as unknown as { ng?: any }).ng?.getComponent?.(
      host,
    );
    return (componente?.[propiedad] ?? []).map((evento: any) => ({
      id: evento.meta?.subBloque?.id,
      draggable: evento.draggable,
      resizable: evento.resizable,
    }));
  }, coleccion);
}

for (const viewport of [
  { name: 'escritorio', width: 1440, height: 900 },
  { name: 'movil', width: 390, height: 844 },
]) {
  test(`modo normal: sin casillas, panel completo y comentario sin tocar realizado (${viewport.name})`, async ({
    page,
  }) => {
    const api = await mockCalendario(page);
    await abrirCalendario(page, viewport.width, viewport.height);

    const toggle = page.getByTestId('marking-toggle');
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveText('Marcar progreso');
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByTestId('completion-toggle')).toHaveCount(0);
    await expect(page.locator('.p-tooltip:visible')).toHaveCount(0);
    expect(api.progreso).toHaveLength(0);
    if (viewport.name === 'escritorio') {
      await capturar(page, 'desktop-normal');
    }

    const evento = tarjeta(page, TITULO_NORMAL);
    await evento.scrollIntoViewIfNeeded();
    if (viewport.name === 'movil') {
      await centrarEventoHorizontal(page, 98762);
      await capturar(page, 'mobile-normal');
    }
    await evento.locator('.event-text').click();

    const panel = page.locator('.event-sheet-dialog');
    await expect(panel).toBeVisible();
    await expect(panel).not.toHaveClass(/ng-animating/);
    if (viewport.name === 'movil') {
      await capturar(page, 'mobile-panel');
    }
    await expect(panel.getByTestId('event-sheet-title')).toHaveText(
      TITULO_NORMAL,
    );
    await expect(panel.getByTestId('event-sheet-status')).toHaveText(
      'Pendiente',
    );
    await expect(panel.getByTestId('event-sheet-instructions')).toContainText(
      'Instrucciones completas',
    );
    await expect(panel.getByTestId('event-sheet-toggle')).toHaveCount(0);
    await expect(panel.getByTestId('event-sheet-comment')).toHaveValue('');

    await panel.getByTestId('event-sheet-comment').fill('Comentario normal');
    await panel.getByTestId('event-sheet-comment-save').click();
    await expect(
      panel.getByTestId('event-sheet-comment-saved'),
    ).toBeVisible();
    await expect(panel.getByTestId('event-sheet-status')).toHaveText(
      'Pendiente',
    );

    const comentario = api.progreso.find(
      (body) => body['comentariosAlumno'] !== undefined,
    );
    expect(comentario).toMatchObject({
      subBloqueId: 98762,
      planificacionId: PLAN_ID,
      comentariosAlumno: 'Comentario normal',
    });
    expect(comentario).not.toHaveProperty('realizado');
    expect(api.personalesGuardados).toHaveLength(0);
    expect(api.bloqueadas).toEqual([]);

    await panel.getByTestId('event-sheet-close').click();
    await expect(page.getByTestId('event-sheet-content')).toBeHidden();
  });

  test(`entrar y salir del modo no guarda y conserva flags originales (${viewport.name})`, async ({
    page,
  }) => {
    const api = await mockCalendario(page);
    await abrirCalendario(page, viewport.width, viewport.height);

    const flagsAntes = await flagsDeEventos(page);
    expect(flagsAntes.length).toBeGreaterThan(0);
    expect(flagsAntes.some((flag) => flag.draggable)).toBe(true);

    await entrarModoMarcado(page);
    expect(api.progreso).toHaveLength(0);
    expect(api.personalesGuardados).toHaveLength(0);
    await expect(page.getByTestId('marking-status')).toContainText(
      'Marcando progreso',
    );
    const casillas = page.getByTestId('completion-toggle');
    expect(await casillas.count()).toBeGreaterThanOrEqual(2);
    if (viewport.name === 'escritorio') {
      await capturar(page, 'desktop-progreso');
    }

    // El input del padre no se toca: sólo la proyección que recibe el
    // calendario lleva drag/resize suspendidos.
    expect(await flagsDeEventos(page)).toEqual(flagsAntes);
    const flagsDurante = await flagsDeEventos(page, 'eventsParaCalendario');
    expect(
      flagsDurante.every(
        (flag) => flag.draggable === false && flag.resizable?.beforeStart === false,
      ),
    ).toBe(true);

    // Refresco del padre con instancias nuevas y un flag cambiado para la
    // misma id: al salir debe conservarse el valor vigente, no el antiguo.
    await page.evaluate(() => {
      const host = document.querySelector('app-vista-semanal');
      const componente = (window as unknown as { ng?: any }).ng?.getComponent?.(
        host,
      );
      componente.events = componente.events.map((evento: any, indice: number) => ({
        ...evento,
        draggable: indice !== 0,
        resizable: { beforeStart: false, afterEnd: false },
        meta: {
          ...evento.meta,
          subBloque: { ...evento.meta.subBloque },
        },
      }));
    });
    const flagsFuenteRefrescados = await flagsDeEventos(page);
    expect(flagsFuenteRefrescados[0]?.draggable).toBe(false);
    const flagsProyeccionRefrescada = await flagsDeEventos(
      page,
      'eventsParaCalendario',
    );
    expect(
      flagsProyeccionRefrescada.every(
        (flag) => flag.draggable === false && flag.resizable?.beforeStart === false,
      ),
    ).toBe(true);

    await salirModoMarcado(page);
    expect(api.progreso).toHaveLength(0);
    expect(api.personalesGuardados).toHaveLength(0);
    expect(await flagsDeEventos(page)).toEqual(flagsFuenteRefrescados);
    expect(await flagsDeEventos(page, 'eventsParaCalendario')).toEqual(
      flagsFuenteRefrescados,
    );
    expect(api.bloqueadas).toEqual([]);
  });

  test(`tarjeta, casilla y teclado marcan una sola vez y no abren panel (${viewport.name})`, async ({
    page,
  }) => {
    const api = await mockCalendario(page);
    await abrirCalendario(page, viewport.width, viewport.height);
    await entrarModoMarcado(page);

    const evento = tarjeta(page, TITULO_NORMAL);
    await evento.scrollIntoViewIfNeeded();
    const casilla = evento.getByTestId('completion-toggle');
    const texto = evento.locator('.event-text');

    await casilla.click();
    await expect(casilla).toHaveAttribute('aria-checked', 'true');
    await expect.poll(() => api.progreso.length).toBe(1);
    expect(api.progreso[0]).toEqual({
      subBloqueId: 98762,
      planificacionId: PLAN_ID,
      realizado: true,
    });
    await expect(page.getByTestId('event-sheet-content')).toBeHidden();
    await expect(casilla).not.toHaveAttribute('aria-disabled', 'true');

    await texto.click();
    await expect(casilla).toHaveAttribute('aria-checked', 'false');
    await expect(texto).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(() => api.progreso.length).toBe(2);
    await expect(page.getByTestId('event-sheet-content')).toBeHidden();

    await expect(texto).not.toHaveAttribute('aria-disabled', 'true');
    await texto.focus();
    await page.keyboard.press('Enter');
    await expect(casilla).toHaveAttribute('aria-checked', 'true');
    await expect(texto).toBeFocused();
    await expect.poll(() => api.progreso.length).toBe(3);
    await expect(page.getByTestId('event-sheet-content')).toBeHidden();

    await expect(casilla).not.toHaveAttribute('aria-disabled', 'true');
    await page.keyboard.press('Space');
    await expect(casilla).toHaveAttribute('aria-checked', 'false');
    await expect(texto).toBeFocused();
    await expect.poll(() => api.progreso.length).toBe(4);
    await expect(page.getByTestId('event-sheet-content')).toBeHidden();

    // Cada acción ha producido exactamente un POST de progreso.
    expect(
      api.progreso.filter((body) => body['realizado'] !== undefined),
    ).toHaveLength(4);
    expect(api.personalesGuardados).toHaveLength(0);
    expect(api.bloqueadas).toEqual([]);
  });

  test(`drag, gesto largo, cancelación y scroll no marcan ni abren panel (${viewport.name})`, async ({
    page,
  }) => {
    const api = await mockCalendario(page);
    await abrirCalendario(page, viewport.width, viewport.height);
    await entrarModoMarcado(page);

    const evento = tarjeta(page, TITULO_FISICA);
    await evento.scrollIntoViewIfNeeded();
    await expect(
      evento.locator('xpath=ancestor::*[contains(@class,"cal-event-container")]').locator('.cal-resize-handle'),
    ).toHaveCount(0);

    const caja = await evento.boundingBox();
    expect(caja).not.toBeNull();
    await page.mouse.move(caja!.x + caja!.width / 2, caja!.y + 20);
    await page.mouse.down();
    await page.mouse.move(caja!.x + caja!.width / 2, caja!.y + 90, {
      steps: 8,
    });
    await page.mouse.up();
    await page.waitForTimeout(150);
    expect(api.progreso).toHaveLength(0);
    await expect(page.getByTestId('event-sheet-content')).toBeHidden();

    await page.evaluate(() => {
      const host = document.querySelector('app-vista-semanal');
      const componente = (window as unknown as { ng?: any }).ng?.getComponent?.(
        host,
      );
      const objetivo = componente.events
        .map((evento: any) =>
          document.querySelector(
            `[data-progress-key="subbloque:${evento.meta?.subBloque?.id}"]`,
          ),
        )
        .find(Boolean) as HTMLElement | undefined;
      const texto = objetivo?.querySelector('.event-text') as HTMLElement;
      if (!texto) throw new Error('No se encontró la tarjeta de prueba');

      const disparar = (
        tipo: string,
        extra: Record<string, unknown> = {},
      ) =>
        texto.dispatchEvent(
          new PointerEvent(tipo, {
            bubbles: true,
            cancelable: true,
            button: 0,
            pointerId: 7,
            clientX: 10,
            clientY: 10,
            ...extra,
          }),
        );

      disparar('pointerdown');
      disparar('pointermove', { clientX: 40, clientY: 10 });
      disparar('pointerup', { clientX: 40, clientY: 10 });
      texto.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true }),
      );

      disparar('pointerdown');
      disparar('pointercancel');
      texto.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true }),
      );

      disparar('pointerdown');
      window.dispatchEvent(new Event('scroll'));
      disparar('pointerup');
      texto.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true }),
      );
    });
    await page.waitForTimeout(150);
    expect(api.progreso).toHaveLength(0);
    await expect(page.getByTestId('event-sheet-content')).toBeHidden();
    await expect(page.getByTestId('marking-toggle')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(api.bloqueadas).toEqual([]);
  });

  test(`pendientes bloquean Terminar, el error revierte y permite reintentar (${viewport.name})`, async ({
    page,
  }) => {
    const api = await mockCalendario(page, { retenerPrimerGuardado: true });
    await abrirCalendario(page, viewport.width, viewport.height);
    await entrarModoMarcado(page);

    const evento = tarjeta(page, TITULO_FISICA);
    await evento.scrollIntoViewIfNeeded();
    const casilla = evento.getByTestId('completion-toggle');
    const toggle = page.getByTestId('marking-toggle');

    await casilla.click();
    await expect.poll(() => api.progreso.length).toBe(1);
    await expect(casilla).toHaveAttribute('aria-checked', 'true');
    await expect(casilla).toHaveAttribute('aria-disabled', 'true');
    await expect(toggle).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByTestId('marking-status')).toContainText(
      'Guardando progreso',
    );

    // Playwright considera deshabilitado un botón con aria-disabled, así que
    // el intento de terminar se fuerza a nivel DOM (como haría el usuario).
    await toggle.evaluate((element) =>
      (element as HTMLButtonElement).click(),
    );
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(api.progreso).toHaveLength(1);
    await casilla.evaluate((element) => (element as HTMLButtonElement).click());
    expect(api.progreso).toHaveLength(1);

    api.liberarGuardado();
    await expect(casilla).toHaveAttribute('aria-checked', 'false');
    await expect(casilla).not.toHaveAttribute('aria-disabled', 'true');
    await expect(toggle).not.toHaveAttribute('aria-disabled', 'true');
    await expect(
      page
        .locator('.toast-error, [class*="ngx-toastr"][class*="error"]')
        .first(),
    ).toContainText('No se pudo guardar el marcaje');
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');

    await casilla.click();
    await expect(casilla).toHaveAttribute('aria-checked', 'true');
    await expect.poll(() => api.progreso.length).toBe(2);
    await expect(casilla).not.toHaveAttribute('aria-disabled', 'true');

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByTestId('completion-toggle')).toHaveCount(0);
    expect(api.bloqueadas).toEqual([]);
  });
}

test('evento personal usa su endpoint de realizado y el editor no ofrece completar', async ({
  page,
}) => {
  const api = await mockCalendario(page);
  await abrirCalendario(page, 1440, 900);
  await entrarModoMarcado(page);

  const personal = tarjeta(page, TITULO_PERSONAL);
  await personal.scrollIntoViewIfNeeded();
  const casilla = personal.getByTestId('completion-toggle');
  await casilla.click();
  await expect(casilla).toHaveAttribute('aria-checked', 'true');
  await expect.poll(() => api.personalesGuardados.length).toBe(1);
  expect(api.personalesGuardados[0]).toEqual({
    id: 98001,
    planificacionId: PLAN_ID,
    realizado: true,
  });
  expect(
    api.progreso.filter((body) => body['realizado'] !== undefined),
  ).toHaveLength(0);
  await expect(casilla).not.toHaveAttribute('aria-disabled', 'true');
  await salirModoMarcado(page);

  await personal.locator('.event-text').click();
  const panel = page.locator('.event-sheet-dialog');
  await expect(panel).toBeVisible();
  await expect(panel.getByTestId('event-sheet-status')).toHaveText(
    'Realizada',
  );
  await expect(panel.getByTestId('event-sheet-toggle')).toHaveCount(0);
  await panel.getByTestId('event-sheet-edit').click();
  await expect(page.getByTestId('event-sheet-content')).toBeHidden();

  const editor = page
    .locator('.p-dialog:visible')
    .filter({ hasText: 'Evento Personalizado' });
  await expect(editor).toBeVisible();
  // El diálogo de evento personal vive en este componente y ya no expone el
  // control de completado: el progreso sólo se cambia desde el modo.
  await expect(editor.getByText('Marcar como realizado')).toHaveCount(0);
  await expect(editor.locator('#realizado')).toHaveCount(0);

  const nuevoTitulo = 'Evento personal actualizado';
  await editor.locator('#nombre').fill(nuevoTitulo);
  await editor.getByRole('button', { name: 'Guardar' }).click();
  await expect(editor).toBeHidden();
  expect(api.personalesEditados).toHaveLength(1);
  expect(api.personalesEditados[0]).not.toHaveProperty('realizado');
  await expect(tarjeta(page, nuevoTitulo)).toBeVisible();

  await tarjeta(page, nuevoTitulo).locator('.event-title strong').click();
  const panelEditado = page.locator('.event-sheet-dialog');
  await expect(panelEditado).toBeVisible();
  await expect(panelEditado.getByTestId('event-sheet-status')).toHaveText(
    'Realizada',
  );
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('event-sheet-content')).toBeHidden();
  expect(api.bloqueadas).toEqual([]);
});

test('la barra de modo sigue visible y pulsable al desplazar el calendario móvil', async ({
  page,
}) => {
  const api = await mockCalendario(page);
  await abrirCalendario(page, 390, 844);
  await entrarModoMarcado(page);
  await centrarEventoHorizontal(page, 98761);

  const scroller = page.locator('.weekly-calendar');
  expect(await scroller.evaluate((element) => element.scrollLeft)).toBeGreaterThan(
    40,
  );
  const evento = tarjeta(page, TITULO_FISICA);
  const cajaEvento = await evento.boundingBox();
  expect(cajaEvento).not.toBeNull();
  expect(cajaEvento!.x).toBeGreaterThanOrEqual(0);
  expect(cajaEvento!.x + cajaEvento!.width).toBeLessThanOrEqual(391);

  const toggle = page.getByTestId('marking-toggle');
  const cajaToggle = await toggle.boundingBox();
  expect(cajaToggle).not.toBeNull();
  expect(cajaToggle!.x).toBeGreaterThanOrEqual(0);
  expect(cajaToggle!.x + cajaToggle!.width).toBeLessThanOrEqual(390);
  expect(cajaToggle!.y).toBeGreaterThanOrEqual(0);
  expect(cajaToggle!.y + cajaToggle!.height).toBeLessThanOrEqual(844);
  const alcanzable = await page.evaluate(
    ({ x, y }) => {
      const target = document.elementFromPoint(x, y);
      const boton = document.querySelector('[data-testid="marking-toggle"]');
      return !!target && !!boton && (target === boton || boton.contains(target));
    },
    {
      x: cajaToggle!.x + cajaToggle!.width / 2,
      y: cajaToggle!.y + cajaToggle!.height / 2,
    },
  );
  expect(alcanzable).toBe(true);

  await capturar(page, 'mobile-progreso');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByTestId('completion-toggle')).toHaveCount(0);
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('completion-toggle').first()).toBeVisible();
  expect(api.progreso).toHaveLength(0);
  expect(api.bloqueadas).toEqual([]);
});

for (const viewport of [
  { name: '320', width: 320, height: 700 },
  { name: '390', width: 390, height: 844 },
  { name: '768', width: 768, height: 900 },
  { name: '1440', width: 1440, height: 900 },
]) {
  test(`barra del calendario usable y discreta en ${viewport.name}px`, async ({
    page,
  }) => {
    const api = await mockCalendario(page);
    await abrirCalendario(page, viewport.width, viewport.height);

    const info = page.locator('.calendar-info');
    const fecha = page.locator('.calendar-info__date');
    const cambiarPlan = page.getByRole('button', {
      name: 'Cambiar mi planificación',
    });
    const descargar = page.getByRole('button', {
      name: 'Descargar calendario',
    });
    const cambiarVista = page.getByRole('button', {
      name: 'Cambiar vista entre semanal/mensual',
    });
    const anterior = page.getByRole('button', { name: 'Anterior' });
    const hoy = page.getByRole('button', { name: 'Hoy' });
    const siguiente = page.getByRole('button', { name: 'Siguiente' });
    const marcar = page.getByTestId('marking-toggle');

    const controles = [
      cambiarPlan,
      descargar,
      cambiarVista,
      anterior,
      hoy,
      siguiente,
      marcar,
    ];
    for (const control of controles) {
      await expect(control).toBeVisible();
    }

    const desbordamiento = await page.evaluate(() => {
      const barra = document.querySelector('.calendar-info') as HTMLElement;
      return {
        documento: document.documentElement.scrollWidth,
        ventana: window.innerWidth,
        barra: barra.scrollWidth,
        barraVisible: barra.clientWidth,
      };
    });
    expect(desbordamiento.documento).toBeLessThanOrEqual(
      desbordamiento.ventana,
    );
    expect(desbordamiento.barra).toBeLessThanOrEqual(
      desbordamiento.barraVisible,
    );

    const cajaFecha = await fecha.boundingBox();
    expect(cajaFecha).not.toBeNull();
    expect(cajaFecha!.width).toBeGreaterThanOrEqual(110);
    expect(cajaFecha!.height).toBeLessThanOrEqual(64);
    expect(await fecha.evaluate((element) => element.scrollWidth)).toBeLessThanOrEqual(
      await fecha.evaluate((element) => element.clientWidth),
    );

    const cajaNavegacion = await page
      .locator('app-calendar-header')
      .boundingBox();
    expect(cajaNavegacion).not.toBeNull();
    expect(
      cajaNavegacion!.y < cajaFecha!.y + cajaFecha!.height &&
        cajaFecha!.y < cajaNavegacion!.y + cajaNavegacion!.height,
    ).toBe(true);

    if (viewport.width <= 900) {
      const cajaAcciones = await page
        .locator('.calendar-info__actions')
        .boundingBox();
      expect(cajaAcciones).not.toBeNull();
      expect(cajaAcciones!.y).toBeGreaterThanOrEqual(
        Math.max(
          cajaFecha!.y + cajaFecha!.height,
          cajaNavegacion!.y + cajaNavegacion!.height,
        ) - 2,
      );
    }

    await expect(cambiarPlan).toHaveText('Cambiar plan');
    await expect(cambiarPlan).toHaveAttribute(
      'aria-label',
      'Cambiar mi planificación',
    );
    const estiloCambiarPlan = await cambiarPlan.evaluate((element) => {
      const estilo = getComputedStyle(element);
      return {
        fondo: estilo.backgroundColor,
        color: estilo.color,
        borde: estilo.borderTopColor,
      };
    });
    expect(estiloCambiarPlan.fondo).toBe('rgba(0, 0, 0, 0)');
    expect(estiloCambiarPlan.borde).toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
    expect(estiloCambiarPlan.color).not.toBe(
      await page.evaluate(() => {
        const sonda = document.createElement('div');
        sonda.style.color = 'var(--primary-color)';
        document.body.appendChild(sonda);
        const color = getComputedStyle(sonda).color;
        sonda.remove();
        return color;
      }),
    );

    const colorPrimario = await page.evaluate(() => {
      const sonda = document.createElement('div');
      sonda.style.backgroundColor = 'var(--primary-color)';
      document.body.appendChild(sonda);
      const color = getComputedStyle(sonda).backgroundColor;
      sonda.remove();
      return color;
    });
    await expect(marcar).toHaveText('Marcar progreso');
    await expect(marcar).toHaveAttribute('aria-pressed', 'false');
    await expect(
      marcar.locator('.calendar-progress-toggle__icon'),
    ).toBeVisible();
    expect(
      await marcar.evaluate((element) => getComputedStyle(element).backgroundColor),
    ).toBe(colorPrimario);

    for (const control of controles) {
      const caja = await control.boundingBox();
      expect(caja).not.toBeNull();
      expect(caja!.x).toBeGreaterThanOrEqual(0);
      expect(caja!.y).toBeGreaterThanOrEqual(0);
      expect(caja!.x + caja!.width).toBeLessThanOrEqual(viewport.width + 0.5);
      expect(caja!.y + caja!.height).toBeLessThanOrEqual(viewport.height + 0.5);
      if (await control.isEnabled()) {
        expect(
          await control.evaluate((element) => {
            const caja = element.getBoundingClientRect();
            const objetivo = document.elementFromPoint(
              caja.x + caja.width / 2,
              caja.y + caja.height / 2,
            );
            return (
              !!objetivo && (objetivo === element || element.contains(objetivo))
            );
          }),
        ).toBe(true);
      }
    }

    if (viewport.name === '390' || viewport.name === '1440') {
      const infoBox = await info.boundingBox();
      const progressBox = await page
        .locator('.calendar-progress-toolbar')
        .boundingBox();
      expect(infoBox).not.toBeNull();
      expect(progressBox).not.toBeNull();
      const inicio = Math.min(infoBox!.y, progressBox!.y) - 4;
      const fin = Math.max(
        infoBox!.y + infoBox!.height,
        progressBox!.y + progressBox!.height,
      );
      const prefijo = viewport.name === '390' ? 'mobile' : 'desktop';
      const directorio = process.env['QA_EVIDENCE_DIR'];
      if (directorio) {
        await mkdir(directorio, { recursive: true });
        await page.mouse.move(8, 8);
        await page.screenshot({
          path: join(directorio, `${prefijo}-toolbar.png`),
          clip: {
            x: 0,
            y: inicio,
            width: viewport.width,
            height: fin - inicio + 8,
          },
        });
      }
    }

    await entrarModoMarcado(page);
    await expect(marcar).toHaveText('Terminar');
    await expect(marcar).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('completion-toggle').first()).toBeVisible();
    const cajaMarcarActivo = await marcar.boundingBox();
    expect(cajaMarcarActivo).not.toBeNull();
    expect(cajaMarcarActivo!.x + cajaMarcarActivo!.width).toBeLessThanOrEqual(
      viewport.width + 0.5,
    );

    if (viewport.width <= 390) {
      await centrarEventoHorizontal(page, 98761);
      const scroller = page.locator('.weekly-calendar');
      expect(
        await scroller.evaluate((element) => element.scrollLeft),
      ).toBeGreaterThan(40);
      const cajaTrasScroll = await marcar.boundingBox();
      expect(cajaTrasScroll).not.toBeNull();
      expect(cajaTrasScroll!.x).toBeGreaterThanOrEqual(0);
      expect(cajaTrasScroll!.x + cajaTrasScroll!.width).toBeLessThanOrEqual(
        viewport.width + 0.5,
      );
      expect(
        await marcar.evaluate((element) => {
          const caja = element.getBoundingClientRect();
          const objetivo = document.elementFromPoint(
            caja.x + caja.width / 2,
            caja.y + caja.height / 2,
          );
          return !!objetivo && (objetivo === element || element.contains(objetivo));
        }),
      ).toBe(true);
    }

    await salirModoMarcado(page);
    await expect(page.getByTestId('completion-toggle')).toHaveCount(0);
    expect(api.progreso).toHaveLength(0);
    expect(api.personalesGuardados).toHaveLength(0);
    expect(api.bloqueadas).toEqual([]);
  });
}

test('el modo normal conserva el behavior de admin/picker sin botón de marcado', async ({
  page,
}) => {
  await mockCalendario(page);
  await abrirCalendario(page, 1440, 900);
  await page.evaluate(() => {
    const host = document.querySelector('app-vista-semanal');
    const ng = (window as unknown as { ng?: any }).ng;
    const componente = ng?.getComponent?.(host);
    componente.role = 'ADMIN';
    componente.mode = 'picker';
    ng?.applyChanges?.(componente);
  });
  await expect(page.getByTestId('marking-toggle')).toHaveCount(0);
  await expect(page.getByTestId('completion-toggle')).toHaveCount(0);
  const evento = tarjeta(page, TITULO_NORMAL);
  await evento.scrollIntoViewIfNeeded();
  await evento.locator('.event-text').click();
  await expect(page.getByTestId('event-sheet-content')).toBeHidden();
});
