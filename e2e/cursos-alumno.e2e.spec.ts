/**
 * E2E — Módulo Cursos (alumno) — QA 2026-05-21.
 *
 * Cubre la experiencia del alumno:
 *   - Login alumno → /app/cursos (mis cursos)
 *   - Catálogo público con cursos PUBLICADO
 *   - Detalle de curso (con / sin acceso)
 *   - Player de lección VIDEO + TEXTO
 *   - Progreso: marcar como vista llama upsertProgreso con completada=true
 *   - Responsive (375px) — el contenido sigue siendo legible
 *
 * Endpoints mockeados:
 *   - GET /cursos/mios     → list accesos del alumno
 *   - GET /cursos/catalogo → list cursos PUBLICADO
 *   - GET /cursos/:slug    → detalle con tieneAcceso
 *   - GET /lecciones/:id   → leccion + playbackUrl
 *   - POST /lecciones/:id/progreso → upsert progreso
 */
import { expect, test, type Page } from '@playwright/test';
import userAlumnoFixture from './fixtures/user-alumno.json';
import cursoDetailFixture from './fixtures/curso-detail.json';

interface ProgresoMock {
  id?: number;
  leccionId: number;
  completada: boolean;
  porcentajeVisto: number;
  ultimaVez?: string;
}

interface AlumnoState {
  tieneAcceso: boolean;
  catalogoCount: number;
  misCursosCount: number;
  progresoCalls: { id: number; body: unknown }[];
  /** Progreso del alumno en el curso (alimenta checkmarks/% /continuar). */
  progreso: ProgresoMock[];
}

function freshState(
  opts: { tieneAcceso?: boolean; progreso?: ProgresoMock[] } = {},
): AlumnoState {
  return {
    tieneAcceso: opts.tieneAcceso ?? true,
    catalogoCount: 0,
    misCursosCount: 0,
    progresoCalls: [],
    progreso: opts.progreso ?? [],
  };
}

/**
 * Stub out the app-config calls (otherwise the layout component blocks the
 * SPA from rendering child routes until they fail/timeout).
 */
async function setupAppConfigStubs(page: Page): Promise<void> {
  await page.route('**/api/app-config', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        appName: 'Test Academia',
        logoUrl: null,
        primaryColor: '#FF6B35',
        secondaryColor: '#1F2937',
        updatedAt: new Date().toISOString(),
      }),
    }),
  );
  await page.route('**/api/app-config/modulos', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        PLANIFICACION: true,
        SIMULACROS: true,
        HORARIOS: true,
        DOCUMENTACION: true,
        CURSOS: true,
        EXAMEN: true,
        TEST: true,
        FLASHCARDS: true,
        FACTURACION: true,
      }),
    }),
  );
}

async function setupCursosAlumnoInterceptors(
  page: Page,
  state: AlumnoState,
): Promise<void> {
  // IMPORTANT: scope these routes to XHR requests only so that SPA navigations
  // to /app/cursos/* (which match `**/cursos/*` globs) are not intercepted.
  // The backend XHR calls use resource type "xhr" / "fetch"; the document
  // navigation uses "document". Filtering by request().resourceType() lets
  // both coexist.
  const isXhr = (req: import('@playwright/test').Request) => {
    const t = req.resourceType();
    return t === 'xhr' || t === 'fetch';
  };

  // GET /cursos/catalogo
  await page.route('**/cursos/catalogo', (route) => {
    if (!isXhr(route.request())) return route.continue();
    state.catalogoCount += 1;
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          ...cursoDetailFixture,
          wooProductId: 1234,
        },
      ]),
    });
  });

  // GET /cursos/mios
  await page.route('**/cursos/mios', (route) => {
    if (!isXhr(route.request())) return route.continue();
    state.misCursosCount += 1;
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 1,
          cursoId: cursoDetailFixture.id,
          usuarioId: 1,
          curso: { ...cursoDetailFixture, wooProductId: 1234 },
          progreso: state.progreso,
          createdAt: new Date().toISOString(),
        },
      ]),
    });
  });

  // GET /cursos/:slug
  await page.route(`**/cursos/${cursoDetailFixture.slug}`, (route) => {
    if (!isXhr(route.request())) return route.continue();
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        curso: { ...cursoDetailFixture, wooProductId: 1234 },
        tieneAcceso: state.tieneAcceso,
        // El backend solo expone progreso cuando hay acceso.
        ...(state.tieneAcceso ? { progreso: state.progreso } : {}),
      }),
    });
  });

  // GET /lecciones/:id  AND  POST /lecciones/:id/progreso
  await page.route(/\/lecciones\/\d+(\?.*)?$/, (route) => {
    const url = route.request().url();
    const idMatch = url.match(/\/lecciones\/(\d+)/);
    const id = idMatch ? parseInt(idMatch[1], 10) : 0;
    const method = route.request().method();
    if (method === 'GET') {
      if (!state.tieneAcceso) {
        return route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({
            message: 'Debe adquirir el curso para acceder',
            error: 'Forbidden',
            statusCode: 403,
          }),
        });
      }
      const seccion = cursoDetailFixture.secciones.find((s) =>
        s.lecciones.some((l) => l.id === id),
      );
      const leccion = seccion?.lecciones.find((l) => l.id === id);
      if (!leccion) {
        return route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({
            message: 'Lección no encontrada',
            error: 'Not Found',
            statusCode: 404,
          }),
        });
      }
      const isVideo = leccion.tipo === 'VIDEO';
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          leccion: {
            ...leccion,
            bunnyVideoId: isVideo ? 'mock-bunny-guid' : null,
            contenidoMarkdown: isVideo ? null : '# Bienvenida\n\nContenido E2E',
          },
          playbackUrl: isVideo
            ? 'https://iframe.mediadelivery.net/embed/0/mock-bunny-guid'
            : undefined,
        }),
      });
    }
    return route.continue();
  });

  await page.route(/\/lecciones\/\d+\/progreso$/, async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    const url = route.request().url();
    const idMatch = url.match(/\/lecciones\/(\d+)\/progreso/);
    const id = idMatch ? parseInt(idMatch[1], 10) : 0;
    const body = route.request().postDataJSON();
    state.progresoCalls.push({ id, body });
    if (!state.tieneAcceso) {
      return route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'No tiene acceso a esta lección',
          error: 'Forbidden',
          statusCode: 403,
        }),
      });
    }
    return route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 1,
        usuarioId: 1,
        leccionId: id,
        ...body,
        // Auto-completa si porcentajeVisto>=95 (igual que el backend)
        completada:
          body?.completada === true || (body?.porcentajeVisto ?? 0) >= 95,
        ultimaVez: new Date().toISOString(),
      }),
    });
  });
}

/**
 * Mock POST /auth/login (backend) without intercepting the SPA navigation to
 * the Angular route /auth/login.
 */
async function mockBackendLoginAlumno(page: Page): Promise<void> {
  const payload = Buffer.from(
    JSON.stringify({
      rol: 'ALUMNO',
      email: 'alumno@test.com',
      sub: 1,
      exp: 9_999_999_999,
    }),
  ).toString('base64');
  const mockJwt = `x.${payload}.x`;
  await page.route('**/auth/login', (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    return route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ access_token: mockJwt, refresh_token: mockJwt }),
    });
  });
}

async function loginAsAlumno(page: Page): Promise<void> {
  await page.route('**/user/get-by-email', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(userAlumnoFixture),
    }),
  );
  await mockBackendLoginAlumno(page);
  await page.goto('/auth/login');
  await page.waitForSelector('input[formControlName="email"]', {
    timeout: 15_000,
  });
  await page
    .locator('input[formControlName="email"]')
    .fill('alumno@test.com');
  await page.locator('app-password-input input').fill('test1234');
  // The login button is wrapped by <app-async-button> and its internal
  // <button> is type="button" (not "submit"), so we can't rely on the
  // standard submit-type selector.
  await page.locator('app-async-button button').first().click();
  await page.waitForURL('**/app/**', { timeout: 15_000 });
}

test.describe('Cursos alumno — flujo completo', () => {
  let state: AlumnoState;

  test.beforeEach(async ({ page }) => {
    state = freshState({ tieneAcceso: true });
    await setupAppConfigStubs(page);
    await setupCursosAlumnoInterceptors(page, state);
    await loginAsAlumno(page);
  });

  test('1) /app/cursos renderiza Mis Cursos con el curso comprado', async ({
    page,
  }) => {
    await page.goto('/app/cursos');
    await expect(
      page.getByRole('heading', { name: /Mis Cursos/i }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Curso QA Test')).toBeVisible();
    expect(state.misCursosCount).toBeGreaterThan(0);
  });

  test('2) catalogo renderiza el curso PUBLICADO con botón Comprar habilitado', async ({
    page,
  }) => {
    await page.goto('/app/cursos/catalogo');
    await expect(
      page.getByRole('heading', { name: /Catálogo de Cursos/i }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Curso QA Test')).toBeVisible();
    const comprarBtn = page.getByRole('button', { name: /Comprar/i }).first();
    await expect(comprarBtn).toBeEnabled();
    expect(state.catalogoCount).toBeGreaterThan(0);
  });

  test('3) detalle de curso muestra secciones y lecciones', async ({ page }) => {
    await page.goto(`/app/cursos/${cursoDetailFixture.slug}`);
    await expect(
      page.getByRole('heading', { name: /Curso QA Test/i }),
    ).toBeVisible({ timeout: 10_000 });
    // Total lecciones (2 + 1 = 3) is shown in meta
    await expect(page.getByText(/3 lecciones/i)).toBeVisible();
    // Accordion section titles
    await expect(page.getByText('Introducción')).toBeVisible();
    await expect(page.getByText('Profundización')).toBeVisible();
  });

  test('4) sin acceso → aviso de bloqueo + CTA Comprar y lecciones no navegables', async ({
    page,
  }) => {
    state.tieneAcceso = false;
    await page.goto(`/app/cursos/${cursoDetailFixture.slug}`);
    await expect(
      page.getByRole('heading', { name: /Curso QA Test/i }),
    ).toBeVisible({ timeout: 10_000 });
    // El hero muestra el CTA de compra cuando no hay acceso.
    await expect(page.getByTestId('curso-detail-comprar-btn')).toBeVisible();
    // El currículum muestra el aviso de bloqueo.
    await expect(
      page.getByText(/Adquiere el curso para acceder/i),
    ).toBeVisible();
    // Las lecciones se renderizan pero NO son interactivas (modo lectura).
    const firstLeccionRow = page.locator('.leccion-row').first();
    await expect(firstLeccionRow).toBeVisible({ timeout: 5_000 });
    await expect(firstLeccionRow).toHaveClass(/no-interactivo/);
    // Click no navega.
    const beforeUrl = page.url();
    await firstLeccionRow.click();
    await page.waitForTimeout(500);
    expect(page.url()).toBe(beforeUrl);
  });

  test('5) abrir lección TEXTO en el aula: breadcrumb + contenido + currículum', async ({
    page,
  }) => {
    await page.goto(`/app/cursos/${cursoDetailFixture.slug}/leccion/100`);
    // El título de la lección activa aparece en el breadcrumb del aula.
    await expect(page.locator('.bc-leccion')).toHaveText(/Bienvenida/i, {
      timeout: 10_000,
    });
    // El contenido markdown se renderiza.
    await expect(page.getByText(/Contenido E2E/i)).toBeVisible();
    // El aula tiene el sidebar de currículum y el botón volver.
    await expect(page.getByText(/Volver al curso/i)).toBeVisible();
    await expect(page.locator('app-curriculum-sidebar')).toBeVisible();
  });

  test('6) abrir lección VIDEO en el aula: player + footer "Marcar completada"', async ({
    page,
  }) => {
    await page.goto(`/app/cursos/${cursoDetailFixture.slug}/leccion/101`);
    await expect(page.locator('.bc-leccion')).toHaveText(
      /Vídeo de presentación/i,
      { timeout: 10_000 },
    );
    await expect(page.locator('iframe.video-iframe')).toBeVisible({
      timeout: 5_000,
    });
    // En el aula la completitud la dueña el footer del shell, NO el botón
    // interno del vídeo (que queda oculto con enAula=true).
    await expect(
      page.getByRole('button', { name: /Marcar completada/i }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /^Marcar como vista$/i }),
    ).toHaveCount(0);
  });

  test('7) "Marcar completada" envía POST progreso completada=true al 100%', async ({
    page,
  }) => {
    await page.goto(`/app/cursos/${cursoDetailFixture.slug}/leccion/101`);
    const btn = page.getByRole('button', { name: /Marcar completada/i });
    await expect(btn).toBeVisible({ timeout: 10_000 });
    await btn.click();

    await expect
      .poll(() => state.progresoCalls.length, { timeout: 5_000 })
      .toBeGreaterThan(0);
    const call101 = state.progresoCalls.find((c) => c.id === 101);
    expect(call101?.body).toMatchObject({
      completada: true,
      porcentajeVisto: 100,
    });
  });

  test('8) responsive 375px — la página de catálogo sigue renderizando el curso', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto('/app/cursos/catalogo');
    await expect(
      page.getByRole('heading', { name: /Catálogo de Cursos/i }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Curso QA Test')).toBeVisible();
    // Curso card should be visible (not clipped) on mobile
    const card = page.locator('.curso-card').first();
    await expect(card).toBeVisible();
  });

  test('9) aula: sidebar marca la lección completada, resalta la activa y muestra nav', async ({
    page,
  }) => {
    state.progreso = [
      {
        id: 1,
        leccionId: 100,
        completada: true,
        porcentajeVisto: 100,
        ultimaVez: new Date().toISOString(),
      },
    ];
    await page.goto(`/app/cursos/${cursoDetailFixture.slug}/leccion/101`);
    await expect(page.locator('app-curriculum-sidebar')).toBeVisible({
      timeout: 10_000,
    });
    // La 100 (vista) aparece completada; la 101 (abierta) resaltada como activa.
    await expect(page.locator('.leccion-row.completada')).toHaveCount(1);
    await expect(page.locator('.leccion-row.activa')).toHaveCount(1);
    // Footer de navegación del aula.
    await expect(page.getByRole('button', { name: /Anterior/i })).toBeEnabled();
    await expect(
      page.getByRole('button', { name: /Siguiente/i }),
    ).toBeEnabled();
  });

  test('10) "Marcar completada" auto-avanza a la siguiente lección', async ({
    page,
  }) => {
    await page.goto(`/app/cursos/${cursoDetailFixture.slug}/leccion/100`);
    const btn = page.getByRole('button', { name: /Marcar completada/i });
    await expect(btn).toBeVisible({ timeout: 10_000 });
    await btn.click();
    // La 100 es la primera; tras completar avanza a la 101.
    await expect(page).toHaveURL(/\/leccion\/101$/, { timeout: 8_000 });
  });

  test('11) mis cursos muestra hero "Continuar aprendiendo" si hay curso en progreso', async ({
    page,
  }) => {
    state.progreso = [
      {
        id: 1,
        leccionId: 100,
        completada: true,
        porcentajeVisto: 100,
        ultimaVez: new Date().toISOString(),
      },
    ];
    await page.goto('/app/cursos');
    await expect(page.getByText(/Continuar aprendiendo/i)).toBeVisible({
      timeout: 10_000,
    });
    await expect(
      page.getByRole('button', { name: /Continuar/i }).first(),
    ).toBeVisible();
  });

  test('12) bloque TEST inline: "Iniciar test" embebe el motor SIN salir del aula', async ({
    page,
  }) => {
    // La lección 100 ahora devuelve un bloque TEST (pila de bloques).
    await page.route(/\/lecciones\/100(\?.*)?$/, (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          leccion: {
            id: 100,
            seccionId: 10,
            titulo: 'Bienvenida',
            orden: 0,
            tipo: 'TEST',
            bloques: [
              {
                id: 900,
                leccionId: 100,
                orden: 0,
                tipo: 'TEST',
                temaId: 14,
                numPreguntas: 5,
                esDeRepaso: false,
              },
            ],
          },
          playbackUrls: {},
        }),
      });
    });

    // Iniciar test del bloque → devuelve el id del Test creado.
    await page.route(/\/bloques\/900\/iniciar-test$/, (route) =>
      route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ id: 777 }),
      }),
    );

    // El motor embebido carga el test por id; respuesta mínima válida.
    await page.route(/\/tests\/por-id\/777(\?.*)?$/, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 777,
          realizadorId: 1,
          preguntas: [
            {
              id: 1,
              identificador: 'P1',
              descripcion: '¿Pregunta de prueba?',
              respuestas: ['A', 'B', 'C', 'D'],
              respuestaCorrectaIndex: 0,
              temaId: 14,
              relevancia: [],
            },
          ],
          respuestas: [],
          testPreguntasIds: [1],
          respuestasCount: 0,
          status: 'EMPEZADO',
          createdAt: new Date().toISOString(),
        }),
      }),
    );
    // Llamadas auxiliares del motor (listas/fallos) → respuestas vacías.
    await page.route(/\/tests(\?.*)?$/, (route) =>
      route.request().method() === 'GET'
        ? route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
        : route.continue(),
    );

    await page.goto(`/app/cursos/${cursoDetailFixture.slug}/leccion/100`);

    // Tarjeta de arranque del bloque TEST.
    await expect(
      page.getByRole('button', { name: /Iniciar test/i }),
    ).toBeVisible({ timeout: 10_000 });

    const urlAntes = page.url();
    await page.getByRole('button', { name: /Iniciar test/i }).click();

    // El motor se embebe en el aula (NO redirige a /realizar-test).
    await expect(page.getByTestId('bloque-test-embed')).toBeVisible({
      timeout: 10_000,
    });
    expect(page.url()).toBe(urlAntes);
    await expect(page).toHaveURL(/\/leccion\/100/);
    // No navegó a la ruta standalone del test.
    expect(page.url()).not.toContain('/realizar-test');
  });

  test('13) bloque CUESTIONARIO: responder + corregir muestra nota y feedback inline', async ({
    page,
  }) => {
    // La lección 100 devuelve un bloque CUESTIONARIO (preguntas SIN
    // respuestaCorrecta, como hace el backend cara-alumno).
    await page.route(/\/lecciones\/100(\?.*)?$/, (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          leccion: {
            id: 100,
            seccionId: 10,
            titulo: 'Bienvenida',
            orden: 0,
            tipo: 'CUESTIONARIO',
            bloques: [
              {
                id: 901,
                leccionId: 100,
                orden: 0,
                tipo: 'CUESTIONARIO',
                bloquePreguntas: [
                  { id: 1, bloqueId: 901, orden: 0, enunciado: '¿2+2?', opciones: ['3', '4'] },
                  { id: 2, bloqueId: 901, orden: 1, enunciado: '¿Capital de España?', opciones: ['Lisboa', 'Madrid', 'París'] },
                ],
              },
            ],
          },
          playbackUrls: {},
        }),
      });
    });

    // Corrección: pregunta 1 acierto, pregunta 2 fallo.
    await page.route(/\/bloques\/901\/cuestionario\/corregir$/, (route) =>
      route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          aciertos: 1,
          total: 2,
          resultados: [
            { preguntaId: 1, opcionElegida: 1, correcta: true, respuestaCorrecta: 1, explicacion: null },
            { preguntaId: 2, opcionElegida: 0, correcta: false, respuestaCorrecta: 1, explicacion: 'Madrid es la capital.' },
          ],
        }),
      }),
    );

    await page.goto(`/app/cursos/${cursoDetailFixture.slug}/leccion/100`);
    await expect(page.getByTestId('bloque-cuestionario')).toBeVisible({
      timeout: 10_000,
    });

    // Corregir está deshabilitado hasta responder todas.
    const corregir = page.getByTestId('cuestionario-corregir');
    await expect(corregir).toBeDisabled();

    // Responder: pregunta 1 → opción "4"; pregunta 2 → opción "Lisboa" (fallo).
    const q = page.getByTestId('cuest-q');
    await q
      .nth(0)
      .getByTestId('cuest-opcion-btn')
      .filter({ hasText: '4' })
      .click();
    await q
      .nth(1)
      .getByTestId('cuest-opcion-btn')
      .filter({ hasText: 'Lisboa' })
      .click();

    await expect(corregir).toBeEnabled();
    await corregir.click();

    // Nota + feedback.
    await expect(page.getByTestId('cuestionario-score')).toContainText('1 / 2', {
      timeout: 10_000,
    });
    await expect(page.getByText('Madrid es la capital.')).toBeVisible();
    // Tras corregir aparece "Reintentar".
    await expect(page.getByTestId('cuestionario-reintentar')).toBeVisible();

    // Auto-marca: al corregir, la lección se marca completada (POST progreso).
    await expect
      .poll(
        () =>
          state.progresoCalls.some(
            (c) =>
              c.id === 100 &&
              (c.body as { completada?: boolean }).completada === true,
          ),
        { timeout: 5_000 },
      )
      .toBe(true);
  });
});
