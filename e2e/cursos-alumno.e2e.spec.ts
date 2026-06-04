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

interface AlumnoState {
  tieneAcceso: boolean;
  catalogoCount: number;
  misCursosCount: number;
  progresoCalls: { id: number; body: unknown }[];
}

function freshState(opts: { tieneAcceso?: boolean } = {}): AlumnoState {
  return {
    tieneAcceso: opts.tieneAcceso ?? true,
    catalogoCount: 0,
    misCursosCount: 0,
    progresoCalls: [],
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
        nombreAcademia: 'Test Academia',
        logoUrl: null,
        primaryColor: '#000000',
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
          progreso: [],
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

  test('4) sin acceso → muestra tag "Sin acceso" y lecciones quedan deshabilitadas', async ({
    page,
  }) => {
    state.tieneAcceso = false;
    await page.goto(`/app/cursos/${cursoDetailFixture.slug}`);
    await expect(
      page.getByRole('heading', { name: /Curso QA Test/i }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Sin acceso/i)).toBeVisible();
    // Expand the first accordion section so we can verify the lessons render
    // with the "disabled" class. The accordion header is the section title.
    await page.getByText('Introducción').click();
    const firstLeccionRow = page.locator('.leccion-row').first();
    await expect(firstLeccionRow).toBeVisible({ timeout: 5_000 });
    await expect(firstLeccionRow).toHaveClass(/disabled/);
    // Clicking should not navigate
    const beforeUrl = page.url();
    await firstLeccionRow.click();
    await page.waitForTimeout(500);
    expect(page.url()).toBe(beforeUrl);
  });

  test('5) abrir lección TEXTO renderiza el contenido markdown', async ({
    page,
  }) => {
    await page.goto(`/app/cursos/${cursoDetailFixture.slug}/leccion/100`);
    // The leccion-page renders an <h2 class="leccion-titulo"> with the title.
    await expect(page.locator('h2.leccion-titulo')).toHaveText(/Bienvenida/i, {
      timeout: 10_000,
    });
    await expect(page.getByText(/Volver al curso/i)).toBeVisible();
  });

  test('6) abrir lección VIDEO muestra el player y botón "Marcar como vista"', async ({
    page,
  }) => {
    await page.goto(`/app/cursos/${cursoDetailFixture.slug}/leccion/101`);
    await expect(page.locator('h2.leccion-titulo')).toHaveText(
      /Vídeo de presentación/i,
      { timeout: 10_000 },
    );
    await expect(page.locator('iframe.video-iframe')).toBeVisible({
      timeout: 5_000,
    });
    await expect(
      page.getByRole('button', { name: /Marcar como vista/i }),
    ).toBeVisible();
  });

  test('7) "Marcar como vista" envía POST progreso con completada=true', async ({
    page,
  }) => {
    await page.goto(`/app/cursos/${cursoDetailFixture.slug}/leccion/101`);
    await expect(
      page.getByRole('button', { name: /Marcar como vista/i }),
    ).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: /Marcar como vista/i }).click();

    await expect
      .poll(() => state.progresoCalls.length, { timeout: 5_000 })
      .toBeGreaterThan(0);
    const last = state.progresoCalls[state.progresoCalls.length - 1];
    expect(last.id).toBe(101);
    expect(last.body).toMatchObject({
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
});
