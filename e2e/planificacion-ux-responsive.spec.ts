import { expect, Page, test } from '@playwright/test';
import userAdminFixture from './fixtures/user-admin.json';
import { loginAsRoleMock } from './helpers/auth.helper';

const PLAN_ID = 4321;

const alumnoPremium = {
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

const hoy = new Date();
const lunes = new Date(hoy);
lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7));
lunes.setHours(0, 0, 0, 0);

function enSemana(dia: number, hora: number, minuto = 0): Date {
  const fecha = new Date(lunes);
  fecha.setDate(lunes.getDate() + dia);
  fecha.setHours(hora, minuto, 0, 0);
  return fecha;
}

function fechaISO(fecha: Date): string {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
}

function bloque(
  id: number,
  nombre: string,
  inicio: Date,
  duracion: number,
  comentarios = '',
) {
  return {
    id,
    planificacionId: PLAN_ID,
    nombre,
    horaInicio: inicio.toISOString(),
    duracion,
    color: '#f59e0b',
    comentarios,
    realizado: false,
    esEntrenamientoFisico: false,
  };
}

function planificacion(subBloques: any[], estado = 'PUBLICADA') {
  return {
    id: PLAN_ID,
    identificador: 'PCAI6-8H',
    descripcion: 'Plan CPBA',
    mes: hoy.getMonth() + 1,
    ano: hoy.getFullYear(),
    estado,
    relevancia: ['ALICANTE_CPBA'],
    esPorDefecto: false,
    tipoDePlanificacion: 'FRANJA_SEIS_A_OCHO_HORAS',
    varianteBorrador: {
      id: 5,
      codigo: 'PCAI6-8H',
      oposicion: 'ALICANTE_CPBA',
      nivel: 'INICIACION',
      franja: 'FRANJA_SEIS_A_OCHO_HORAS',
    },
    subBloques,
  };
}

async function mockPlanificacion(
  page: Page,
  opciones: {
    subBloques?: any[];
    personales?: any[];
    fisica?: any[];
    estado?: string;
    status?: number;
    delay?: number;
  } = {},
) {
  const {
    subBloques = [],
    personales = [],
    fisica = [],
    estado = 'PUBLICADA',
    status = 200,
    delay = 0,
  } = opciones;

  await page.route(
    `**/planificaciones/planificaciones-mensuales/${PLAN_ID}`,
    async (route) => {
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
      await route.fulfill({
        status,
        contentType: 'application/json',
        body:
          status === 200
            ? JSON.stringify(planificacion(subBloques, estado))
            : JSON.stringify({ message: 'No se pudo cargar' }),
      });
    },
  );
  await page.route(
    `**/planificaciones/eventos-personalizados/${PLAN_ID}`,
    (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(personales),
      }),
  );
  await page.route('**/planificacion-fisica/resumen-dias**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(fisica),
    }),
  );
  await page.route('**/adjuntos/**', (route) =>
    route.fulfill({ contentType: 'application/json', body: '[]' }),
  );
  await page.route('**/planificaciones/configuracion', (route) =>
    route.fulfill({ contentType: 'application/json', body: '{}' }),
  );
}

async function abrirPlanificacion(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await loginAsRoleMock(page, {
    rol: 'ALUMNO',
    userFixture: alumnoPremium,
    modulos: { PLANIFICACION_FISICA: true },
  });
  // Evita el 403 genérico del asistente que el helper deja como toast y que
  // ensuciaría las capturas: el widget queda inerte sin lanzador real.
  await page.unroute('**/ai-assistant/token');
  await page.route('**/ai-assistant/token', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ token: 'preauth' }),
    }),
  );
  await page.route('**/widget/ai-assistant-widget.js', (route) =>
    route.fulfill({ contentType: 'application/javascript', body: '' }),
  );
  await page.goto(`/app/planificacion/planificacion-mensual-alumno/${PLAN_ID}`);
  await expect(
    page.locator('app-vista-semanal, [data-testid="semana-vacia"]'),
  ).toBeVisible({ timeout: 10_000 });
}

test.describe('Planificación del alumno — UX responsive', () => {
  test('desktop: cabecera clara, semana completa y ficha completa del evento', async ({
    page,
  }) => {
    const titulo =
      'Hidráulica y mecánica: repaso de bombas, curvas y ejercicios de examen';
    await mockPlanificacion(page, {
      subBloques: [
        bloque(
          101,
          titulo,
          enSemana(0, 9),
          90,
          '**Indicaciones completas** con un [enlace](https://example.test).',
        ),
      ],
    });
    await abrirPlanificacion(page, 1440, 900);

    const cabecera = page.getByTestId('cabecera-alumno');
    await expect(cabecera).toBeVisible();
    await expect(cabecera).toContainText('Mi planificación');
    await expect(page.getByTestId('plan-nombre')).toContainText('Plan CPBA');
    await expect(page.getByTestId('plan-meta')).toContainText('PCAI6-8H');
    await expect(page.getByTestId('plan-meta')).toContainText(
      'Consorcio de Alicante',
    );
    await expect(page.getByTestId('plan-meta')).toContainText('Iniciación');
    await expect(page.getByTestId('plan-meta')).toContainText('6–8 h');
    await expect(page.getByTestId('plan-estado')).toContainText(
      'Plan publicado',
    );

    await expect(page.locator('.cal-day-columns .cal-day-column')).toHaveCount(
      7,
    );
    await expect(
      page.getByText(
        'Abre cada actividad para consultar el detalle. Usa «Marcar progreso»',
      ),
    ).toBeVisible();
    const tarjeta = page
      .locator('.wrapper')
      .filter({ hasText: titulo })
      .first();
    await expect(tarjeta).toBeVisible();
    await page.screenshot({
      path: 'test-results/ux-desktop-semana.png',
      fullPage: false,
    });
    const cajaTarjeta = await tarjeta.boundingBox();
    const cajaSemana = await page.locator('.weekly-calendar').boundingBox();
    expect(cajaTarjeta).not.toBeNull();
    expect(cajaSemana).not.toBeNull();
    expect(cajaTarjeta!.width).toBeGreaterThan(60);
    expect(cajaTarjeta!.height).toBeLessThanOrEqual(90);

    // La tarjeta no renderiza Markdown ni objetivos: el detalle completo vive
    // en la ficha.
    await expect(tarjeta.locator('markdown')).toHaveCount(0);
    await expect(tarjeta.locator('a')).toHaveCount(0);

    await tarjeta.locator('.event-text').click();
    const ficha = page.getByTestId('event-sheet-content');
    await expect(ficha).toBeVisible();
    await expect(page.getByTestId('event-sheet-title')).toContainText(titulo);
    await expect(page.getByTestId('event-sheet-status')).toContainText(
      'Pendiente',
    );
    await expect(page.getByTestId('event-sheet-when')).toContainText('90 min');
    const instrucciones = page.getByTestId('event-sheet-instructions');
    await expect(instrucciones).toContainText('Indicaciones completas');
    await expect(instrucciones.locator('a')).toHaveAttribute(
      'href',
      'https://example.test',
    );
    await expect(page.getByTestId('event-sheet-comment-section')).toBeVisible();
    await page.screenshot({
      path: 'test-results/ux-desktop-ficha.png',
      fullPage: false,
    });
    await page.getByTestId('event-sheet-close').click();
    await expect(ficha).toBeHidden();

    const toggle = page.getByTestId('marking-toggle');
    await expect(toggle).toBeVisible();
    const cajaToggle = await toggle.boundingBox();
    expect(cajaToggle!.height).toBeGreaterThanOrEqual(44);

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });

  test('móvil 375: un solo día legible, tira semanal y navegación por días', async ({
    page,
  }) => {
    await mockPlanificacion(page, {
      subBloques: [
        bloque(201, 'Hidráulica y mecánica', enSemana(0, 9), 60),
        bloque(202, 'Escalas y operaciones', enSemana(1, 11), 60),
      ],
    });
    await abrirPlanificacion(page, 375, 812);

    const movil = page.getByTestId('vista-semanal-movil');
    await expect(movil).toBeVisible();
    await expect(page.locator('.movil-dia')).toHaveCount(7);
    await expect(page.locator('.vista-movil .cal-day-column')).toHaveCount(1);
    await expect(page.locator('mwl-calendar-week-view')).toHaveCount(1);

    await page.locator('.movil-dia').nth(0).click();
    await expect(
      page.locator('.wrapper').filter({ hasText: 'Hidráulica y mecánica' }),
    ).toBeVisible();
    await page.screenshot({
      path: 'test-results/ux-mobile-dia.png',
      fullPage: true,
    });

    await page.getByRole('button', { name: 'Día siguiente' }).click();
    await expect(
      page.locator('.wrapper').filter({ hasText: 'Escalas y operaciones' }),
    ).toBeVisible();
    await expect(page.locator('.movil-dia-nav__info')).toContainText(/martes/i);

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });

  test('móvil: no confunde un día vacío con una semana vacía', async ({
    page,
  }) => {
    const martes = enSemana(1, 18);
    await mockPlanificacion(page, {
      personales: [
        {
          id: 301,
          planificacionId: PLAN_ID,
          nombre: 'Evento personal del martes',
          horaInicio: martes.toISOString(),
          duracion: 60,
          color: '#4caf50',
        },
      ],
    });
    await abrirPlanificacion(page, 375, 812);

    await expect(page.getByTestId('semana-vacia')).toHaveCount(0);
    await expect(page.getByTestId('vista-semanal-movil')).toBeVisible();

    await page.locator('.movil-dia').nth(1).click();
    await expect(
      page
        .locator('.wrapper')
        .filter({ hasText: 'Evento personal del martes' }),
    ).toBeVisible();
  });

  test('vacío sólo tras cargar: mensaje, contexto y CTA sobre la navegación existente', async ({
    page,
  }) => {
    await mockPlanificacion(page, {
      subBloques: [],
      personales: [],
      fisica: [],
    });
    await abrirPlanificacion(page, 1440, 900);

    const vacio = page.getByTestId('semana-vacia');
    await expect(vacio).toBeVisible();
    await expect(vacio).toContainText(
      'Esta semana todavía no tiene actividades',
    );
    await expect(vacio).toContainText(
      'Tu planificación se conserva. No necesitas volver a configurarla.',
    );
    await expect(vacio).not.toContainText('Tu planificación está activa');
    await expect(page.getByTestId('plan-estado')).toBeVisible();
    await expect(page.locator('app-vista-semanal')).toHaveCount(0);
    await page.screenshot({
      path: 'test-results/ux-desktop-vacia.png',
      fullPage: false,
    });

    const cta = page.getByTestId('elegir-otra-semana');
    await cta.click();
    await expect(page.getByTestId('semana-vacia-sugerencia')).toBeVisible();
    expect(
      await page.evaluate(
        () =>
          document.activeElement?.closest('.calendar-info') !== null &&
          document.activeElement?.closest('app-calendar-header') !== null,
      ),
    ).toBe(true);
  });

  test('móvil vacío: sin instrucciones de marcaje y Ayuda dentro del viewport', async ({
    page,
  }) => {
    await mockPlanificacion(page, {
      subBloques: [],
      personales: [],
      fisica: [],
    });
    await abrirPlanificacion(page, 375, 812);

    await expect(page.getByTestId('semana-vacia')).toBeVisible();
    await expect(
      page.getByText(
        'Abre cada actividad para consultar el detalle. Usa «Marcar progreso»',
      ),
    ).toHaveCount(0);
    await expect(
      page.getByText(
        'Puedes consultar esta semana y las dos anteriores; desde el viernes',
      ),
    ).toHaveCount(0);

    const ayuda = page.getByTestId('abrir-ayuda');
    await expect(ayuda).toBeVisible();
    await expect(ayuda).toBeInViewport({ ratio: 1 });
    const cajaAyuda = await ayuda.boundingBox();
    const cajaVacia = await page.getByTestId('semana-vacia').boundingBox();
    expect(cajaAyuda).not.toBeNull();
    expect(cajaVacia).not.toBeNull();
    expect(cajaAyuda!.y).toBeGreaterThanOrEqual(
      cajaVacia!.y + cajaVacia!.height - 1,
    );
  });

  test('física sin temario: acceso visible y navegación exacta', async ({
    page,
  }) => {
    const diaFisica = enSemana(0, 9);
    await mockPlanificacion(page, {
      subBloques: [],
      fisica: [
        {
          fecha: fechaISO(diaFisica),
          bloqueId: 77,
          disciplinas: [
            {
              nombre: 'Cuerda',
              grupo: 'CUERDA',
              color: '#123456',
              realizado: false,
            },
          ],
        },
      ],
    });
    await abrirPlanificacion(page, 1440, 900);

    await expect(page.getByTestId('semana-vacia')).toHaveCount(0);
    const acceso = page.getByTestId('fisica-dia-acceso');
    await expect(acceso).toBeVisible();
    await acceso.click();

    await expect(page).toHaveURL(
      new RegExp(`planificacion-fisica/dia/${fechaISO(diaFisica)}`),
    );
    const url = new URL(page.url());
    expect(url.searchParams.get('bloqueId')).toBe('77');
    expect(url.searchParams.get('originPlanificacionId')).toBe(String(PLAN_ID));
  });

  test('móvil: física de otro día se indica en la tira y navega al día exacto', async ({
    page,
  }) => {
    const diaFisica = enSemana(2, 9);
    await mockPlanificacion(page, {
      subBloques: [],
      fisica: [
        {
          fecha: fechaISO(diaFisica),
          bloqueId: 78,
          disciplinas: [
            {
              nombre: 'Carrera',
              grupo: 'CARRERA',
              color: '#123456',
              realizado: false,
            },
          ],
        },
      ],
    });
    await abrirPlanificacion(page, 375, 812);

    await expect(page.getByTestId('semana-vacia')).toHaveCount(0);
    await expect(
      page.locator('.movil-dia').nth(2).locator('.movil-dia__punto--fisica'),
    ).toBeVisible();

    await page.locator('.movil-dia').nth(1).click();
    await expect(page.getByTestId('movil-fisica-acceso')).toHaveCount(0);

    await page.locator('.movil-dia').nth(2).click();
    const acceso = page.getByTestId('movil-fisica-acceso');
    await expect(acceso).toBeVisible();
    await acceso.click();
    await expect(page).toHaveURL(
      new RegExp(`planificacion-fisica/dia/${fechaISO(diaFisica)}`),
    );
  });

  test('carga auxiliar diferida: el vacío espera a los eventos personales', async ({
    page,
  }) => {
    await mockPlanificacion(page, { subBloques: [] });
    let liberar!: () => void;
    const espera = new Promise<void>((resolve) => {
      liberar = resolve;
    });
    await page.route(
      `**/planificaciones/eventos-personalizados/${PLAN_ID}`,
      async (route) => {
        await espera;
        await route.fulfill({
          contentType: 'application/json',
          body: '[]',
        });
      },
    );
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAsRoleMock(page, {
      rol: 'ALUMNO',
      userFixture: alumnoPremium,
      modulos: { PLANIFICACION_FISICA: true },
    });
    await page.goto(
      `/app/planificacion/planificacion-mensual-alumno/${PLAN_ID}`,
    );

    await expect(page.getByTestId('semana-cargando')).toBeVisible();
    await expect(page.getByTestId('semana-vacia')).toHaveCount(0);
    liberar();
    await expect(page.getByTestId('semana-vacia')).toBeVisible({
      timeout: 10_000,
    });
  });

  test('móvil admin: Clonar día conserva el contenido en el día destino', async ({
    page,
  }) => {
    await mockPlanificacion(page, {
      subBloques: [
        bloque(701, 'Hidráulica', enSemana(0, 9), 60, '**Contenido original**'),
      ],
    });
    await page.setViewportSize({ width: 375, height: 812 });
    await loginAsRoleMock(page, {
      rol: 'ADMIN',
      userFixture: userAdminFixture,
      modulos: { PLANIFICACION_FISICA: true },
    });
    await page.goto(`/app/planificacion/planificacion-mensual/${PLAN_ID}`);
    await expect(page.getByTestId('vista-semanal-movil')).toBeVisible();

    const clonar = page.getByTestId('clonar-dia-movil');
    await expect(clonar).toBeVisible();
    await clonar.click();

    const dialogo = page
      .locator('.p-dialog')
      .filter({ hasText: 'Clonar eventos' });
    await expect(dialogo).toBeVisible();
    await dialogo.locator('p-dropdown').click();
    await page
      .locator('.p-dropdown-panel')
      .last()
      .locator('.p-dropdown-item')
      .filter({ hasText: 'Martes' })
      .click();
    await dialogo.getByRole('button', { name: 'Clonar' }).click();
    await expect(dialogo).toBeHidden();

    await page.locator('.movil-dia').nth(1).click();
    const tarjeta = page
      .locator('.wrapper')
      .filter({ hasText: 'Hidráulica' })
      .first();
    await expect(tarjeta).toBeVisible();
    await tarjeta.locator('.event-text').click();
    await expect(page.getByTestId('event-sheet-instructions')).toContainText(
      'Contenido original',
    );
  });

  test('error real: nunca se presenta como semana vacía', async ({ page }) => {
    await mockPlanificacion(page, { status: 500 });
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAsRoleMock(page, {
      rol: 'ALUMNO',
      userFixture: alumnoPremium,
      modulos: { PLANIFICACION_FISICA: true },
    });
    await page.goto(
      `/app/planificacion/planificacion-mensual-alumno/${PLAN_ID}`,
    );

    await expect(page.getByTestId('semana-error')).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByTestId('semana-vacia')).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Reintentar' }),
    ).toBeVisible();
  });

  test('estado de carga visible antes de decidir que no hay actividades', async ({
    page,
  }) => {
    await mockPlanificacion(page, {
      delay: 900,
      subBloques: [bloque(601, 'Actividad tras cargar', enSemana(0, 9), 60)],
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAsRoleMock(page, {
      rol: 'ALUMNO',
      userFixture: alumnoPremium,
      modulos: { PLANIFICACION_FISICA: true },
    });
    await page.goto(
      `/app/planificacion/planificacion-mensual-alumno/${PLAN_ID}`,
    );

    await expect(page.getByTestId('semana-cargando')).toBeVisible();
    await expect(page.getByTestId('semana-vacia')).toHaveCount(0);
    await expect(page.locator('app-vista-semanal')).toBeVisible({
      timeout: 10_000,
    });
  });

  test('bloques de 15/30/60 min: sin controles desbordados y detalle accesible', async ({
    page,
  }) => {
    let progresoGuardado: number | null = null;
    await mockPlanificacion(page, {
      subBloques: [
        bloque(401, 'Repaso corto de 15 minutos', enSemana(0, 9), 15),
        bloque(402, 'Lectura de 30 minutos', enSemana(0, 10), 30),
        bloque(403, 'Simulacro de 60 minutos', enSemana(0, 11), 60),
      ],
    });
    await page.route(
      '**/planificaciones/actualizar-progreso-subbloque',
      (route) => {
        progresoGuardado = route.request().postDataJSON().subBloqueId;
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: '{}',
        });
      },
    );
    await abrirPlanificacion(page, 1440, 900);

    await page.getByTestId('marking-toggle').click();
    await expect(page.getByTestId('completion-toggle')).toHaveCount(1);
    const casilla = page.getByTestId('completion-toggle');
    const caja = await casilla.boundingBox();
    expect(caja).not.toBeNull();
    expect(caja!.width).toBeGreaterThanOrEqual(44);
    expect(caja!.height).toBeGreaterThanOrEqual(44);
    const bloqueLargo = page
      .locator('.wrapper')
      .filter({ hasText: 'Simulacro de 60 minutos' })
      .first();
    const cajaBloque = await bloqueLargo.boundingBox();
    expect(cajaBloque).not.toBeNull();
    expect(caja!.y).toBeGreaterThanOrEqual(cajaBloque!.y - 1);
    expect(caja!.y + caja!.height).toBeLessThanOrEqual(
      cajaBloque!.y + cajaBloque!.height + 1,
    );

    // Un bloque de 15 min no tiene casilla propia: su detalle ofrece el
    // marcaje como acción explícita de 44 px.
    const corto = page
      .locator('.wrapper')
      .filter({ hasText: 'Repaso corto de 15 minutos' })
      .first();
    await corto.locator('.event-text').click({ force: true });
    const ficha = page.getByTestId('event-sheet-content');
    await expect(ficha).toBeVisible();
    const marcar = page.getByTestId('event-sheet-progress');
    await expect(marcar).toContainText('Marcar como realizada');
    const cajaMarcar = await marcar.boundingBox();
    expect(cajaMarcar!.height).toBeGreaterThanOrEqual(44);
    await marcar.click();
    await expect.poll(() => progresoGuardado).toBe(401);
    await page.getByTestId('event-sheet-close').click();
  });

  test('Ayuda reservada fuera del grid: abre el lanzador real sin flotante encima', async ({
    page,
  }) => {
    await mockPlanificacion(page, {
      subBloques: [bloque(501, 'Actividad', enSemana(0, 9), 60)],
    });
    await abrirPlanificacion(page, 1440, 900);

    // El helper de login registra un 403 para el asistente. Tras el login se
    // sustituye por un token válido y un stub del widget, y se recarga para
    // que el layout monte el asistente con estas respuestas.
    await page.unroute('**/ai-assistant/token');
    await page.route('**/ai-assistant/token', (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ token: 'preauth' }),
      }),
    );
    await page.route('**/widget/ai-assistant-widget.js', (route) =>
      route.fulfill({
        contentType: 'application/javascript',
        body: `(function(){
          var btn = document.createElement('button');
          btn.id = 'ai-widget-btn';
          btn.textContent = 'Asistente';
          btn.addEventListener('click', function () { window.__ayudaAbierta = true; });
          document.body.appendChild(btn);
        })();`,
      }),
    );
    await page.reload();
    await expect(page.locator('app-vista-semanal')).toBeVisible({
      timeout: 10_000,
    });

    const widget = page.locator('#ai-widget-btn');
    await expect(widget).toHaveCount(1);
    await expect(widget).toBeHidden();

    const ayuda = page.getByTestId('planificacion-ayuda');
    await expect(ayuda).toBeVisible();
    const cajaAyuda = await ayuda.boundingBox();
    const cajaCalendario = await page.locator('.weekly-calendar').boundingBox();
    expect(cajaAyuda!.y).toBeGreaterThanOrEqual(
      cajaCalendario!.y + cajaCalendario!.height - 1,
    );

    const botonAyuda = page.getByTestId('abrir-ayuda');
    const cajaBoton = await botonAyuda.boundingBox();
    expect(cajaBoton!.height).toBeGreaterThanOrEqual(44);
    await botonAyuda.click();
    await expect
      .poll(() => page.evaluate(() => (window as any).__ayudaAbierta))
      .toBe(true);
  });
});
