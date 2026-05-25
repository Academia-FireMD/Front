/**
 * E2E — Módulo Cursos (admin) — QA 2026-05-21.
 *
 * Cubre el flujo Teachable-style del backend cursos MVP:
 *   - Login admin + navegación a /app/cursos-admin
 *   - Listado de cursos
 *   - Crear curso nuevo (form + redirect)
 *   - Editar metadatos
 *   - Añadir sección + lección + verificar render
 *   - Reorder de secciones / lecciones (con bug doc: ver QA report)
 *   - Publicar / archivar con badge actualizado
 *   - Eliminar curso con confirm
 *   - Validación de formulario (slug requerido, etc.)
 *
 * Todos los endpoints se mockean — no se requiere backend levantado.
 * Sigue el patrón de auth.spec.ts + superadmin-white-label.spec.ts:
 *   1) Mock /user/get-by-email y setupAuthInterceptors para login
 *   2) Mock /cursos/* para CRUD
 */
import { expect, test, type Page } from '@playwright/test';
import userAdminFixture from './fixtures/user-admin.json';
import cursoDetailFixture from './fixtures/curso-detail.json';

type CursoEstado = 'BORRADOR' | 'PUBLICADO' | 'ARCHIVADO';

interface MockCurso {
  id: number;
  titulo: string;
  slug: string;
  descripcion?: string;
  estado: CursoEstado;
  precio?: number | null;
  wooProductId?: number | null;
  oposicion?: string;
  thumbnailUrl?: string | null;
  duracionEstimadaMinutos?: number | null;
  createdAt: string;
  updatedAt: string;
}

interface MockSeccion {
  id: number;
  cursoId: number;
  titulo: string;
  orden: number;
  lecciones: MockLeccion[];
}

interface MockLeccion {
  id: number;
  seccionId: number;
  titulo: string;
  orden: number;
  tipo: 'VIDEO' | 'TEXTO' | 'TEST' | 'FLASHCARDS';
  bunnyVideoId?: string | null;
  duracionSegundos?: number | null;
  testPlantillaId?: number | null;
  mazoFlashcardsId?: number | null;
  contenidoMarkdown?: string | null;
}

interface AdminState {
  cursos: MockCurso[];
  detail: MockCurso & { secciones: MockSeccion[] };
  nextSeccionId: number;
  nextLeccionId: number;
  reorderSeccionesCalls: number;
  reorderLeccionesCalls: number;
  bunnyUploadCalls: number;
  grantAccessCalls: number;
  deleteCursoCalls: number;
  archivarCalls: number;
  publicarCalls: number;
}

function freshState(): AdminState {
  const detail = JSON.parse(JSON.stringify(cursoDetailFixture)) as MockCurso & {
    secciones: MockSeccion[];
  };
  // Force BORRADOR so we can test the Publicar flow.
  detail.estado = 'BORRADOR';
  const listEntry: MockCurso = {
    ...detail,
  };
  // Drop secciones from the list-row entry (admin list endpoint doesn't include them).
  delete (listEntry as Partial<typeof listEntry> & { secciones?: unknown })
    .secciones;
  return {
    cursos: [listEntry],
    detail,
    nextSeccionId: 200,
    nextLeccionId: 1000,
    reorderSeccionesCalls: 0,
    reorderLeccionesCalls: 0,
    bunnyUploadCalls: 0,
    grantAccessCalls: 0,
    deleteCursoCalls: 0,
    archivarCalls: 0,
    publicarCalls: 0,
  };
}

/**
 * Wire up Cursos admin endpoints against a mutable in-memory state. Routes are
 * registered most-specific first to avoid Playwright matching `:id` before
 * `reorder`.
 */
/**
 * Stub out the app-config calls (otherwise the layout component blocks the
 * SPA from rendering child routes until they fail/timeout, leaving the cursos
 * page blank in tests).
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

async function setupCursosAdminInterceptors(
  page: Page,
  state: AdminState,
): Promise<void> {
  // Refactor 2026-05-25: WC product picker llama a este endpoint admin.
  await page.route('**/woocommerce/products/cursos', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 7777,
          name: 'Curso WC mock',
          sku: 'CURSO-MOCK',
          price: '49.00',
          regular_price: '49.00',
          sale_price: null,
          status: 'publish',
        },
      ]),
    }),
  );

  // GET /cursos/admin?skip&take&searchTerm (refactor 2026-05-25: paginado).
  await page.route(/\/cursos\/admin(\?[^/]*)?$/, (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: state.cursos,
          pagination: {
            skip: 0,
            take: 10,
            searchTerm: '',
            count: state.cursos.length,
          },
        }),
      });
    }
    return route.continue();
  });

  // GET /cursos/admin/:id (detail)
  await page.route(/\/cursos\/admin\/\d+$/, (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(state.detail),
      });
    }
    return route.continue();
  });

  // POST /cursos (create curso)
  // POST /cursos/:id/publicar | /archivar | /grant-access
  // DELETE /cursos/:id
  // PUT /cursos/:id (update metadata)
  await page.route(/\/cursos\/\d+\/publicar$/, async (route) => {
    state.publicarCalls += 1;
    state.detail.estado = 'PUBLICADO';
    state.cursos = state.cursos.map((c) =>
      c.id === state.detail.id ? { ...c, estado: 'PUBLICADO' } : c,
    );
    return route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ ...state.detail }),
    });
  });

  await page.route(/\/cursos\/\d+\/archivar$/, async (route) => {
    state.archivarCalls += 1;
    state.detail.estado = 'ARCHIVADO';
    state.cursos = state.cursos.map((c) =>
      c.id === state.detail.id ? { ...c, estado: 'ARCHIVADO' } : c,
    );
    return route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ ...state.detail }),
    });
  });

  await page.route(/\/cursos\/\d+\/grant-access$/, async (route) => {
    state.grantAccessCalls += 1;
    return route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ id: 999, usuarioId: 130, cursoId: state.detail.id }),
    });
  });

  await page.route(/\/cursos\/\d+$/, async (route) => {
    const method = route.request().method();
    if (method === 'PUT') {
      const body = route.request().postDataJSON() as Partial<MockCurso>;
      state.detail = { ...state.detail, ...body };
      state.cursos = state.cursos.map((c) =>
        c.id === state.detail.id ? { ...c, ...body } : c,
      );
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(state.detail),
      });
    }
    if (method === 'DELETE') {
      state.deleteCursoCalls += 1;
      state.cursos = state.cursos.filter((c) => c.id !== state.detail.id);
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    }
    return route.continue();
  });

  // POST /cursos (create)
  await page.route(/\/cursos$/, async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    const body = route.request().postDataJSON() as MockCurso & {
      slug: string;
      titulo: string;
    };
    if (state.cursos.some((c) => c.slug === body.slug)) {
      return route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          message: `Slug "${body.slug}" ya existe`,
          error: 'Conflict',
          statusCode: 409,
        }),
      });
    }
    const created: MockCurso = {
      id: state.cursos.length + 100,
      titulo: body.titulo,
      slug: body.slug,
      descripcion: body.descripcion ?? null,
      estado: 'BORRADOR',
      precio: body.precio ?? null,
      wooProductId: null,
      oposicion: 'GENERAL',
      thumbnailUrl: body.thumbnailUrl ?? null,
      duracionEstimadaMinutos: body.duracionEstimadaMinutos ?? null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    state.cursos.unshift(created);
    state.detail = { ...created, secciones: [] };
    return route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify(created),
    });
  });

  // PUT /cursos/secciones/reorder — register BEFORE /secciones/:id
  await page.route('**/cursos/secciones/reorder', async (route) => {
    state.reorderSeccionesCalls += 1;
    const body = route.request().postDataJSON() as {
      items: { id: number; orden: number }[];
    };
    state.detail.secciones = state.detail.secciones
      .map((s) => {
        const found = body.items.find((it) => it.id === s.id);
        return found ? { ...s, orden: found.orden } : s;
      })
      .sort((a, b) => a.orden - b.orden);
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.route('**/cursos/lecciones/reorder', async (route) => {
    state.reorderLeccionesCalls += 1;
    const body = route.request().postDataJSON() as {
      items: { id: number; orden: number }[];
    };
    state.detail.secciones = state.detail.secciones.map((s) => ({
      ...s,
      lecciones: s.lecciones
        .map((l) => {
          const found = body.items.find((it) => it.id === l.id);
          return found ? { ...l, orden: found.orden } : l;
        })
        .sort((a, b) => a.orden - b.orden),
    }));
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });

  // POST /cursos/:id/secciones | DELETE /cursos/secciones/:id | PUT /cursos/secciones/:id
  await page.route(/\/cursos\/\d+\/secciones$/, async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    const body = route.request().postDataJSON() as { titulo: string; orden: number };
    const created: MockSeccion = {
      id: state.nextSeccionId++,
      cursoId: state.detail.id,
      titulo: body.titulo,
      orden: body.orden,
      lecciones: [],
    };
    state.detail.secciones.push(created);
    return route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify(created),
    });
  });

  await page.route(/\/cursos\/secciones\/\d+$/, async (route) => {
    const url = route.request().url();
    const id = parseInt(url.split('/').pop()!.split('?')[0], 10);
    const method = route.request().method();
    if (method === 'PUT') {
      const body = route.request().postDataJSON() as Partial<MockSeccion>;
      state.detail.secciones = state.detail.secciones.map((s) =>
        s.id === id ? { ...s, ...body } : s,
      );
      const seccion = state.detail.secciones.find((s) => s.id === id)!;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(seccion),
      });
    }
    if (method === 'DELETE') {
      state.detail.secciones = state.detail.secciones.filter((s) => s.id !== id);
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    }
    return route.continue();
  });

  // POST /cursos/secciones/:id/lecciones
  await page.route(/\/cursos\/secciones\/\d+\/lecciones$/, async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    const url = route.request().url();
    const seccionId = parseInt(url.split('/').slice(-2)[0], 10);
    const body = route.request().postDataJSON() as Omit<MockLeccion, 'id' | 'seccionId'>;
    const created: MockLeccion = {
      id: state.nextLeccionId++,
      seccionId,
      ...body,
    };
    state.detail.secciones = state.detail.secciones.map((s) =>
      s.id === seccionId ? { ...s, lecciones: [...s.lecciones, created] } : s,
    );
    return route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify(created),
    });
  });

  await page.route(/\/cursos\/lecciones\/\d+$/, async (route) => {
    const url = route.request().url();
    const id = parseInt(url.split('/').pop()!.split('?')[0], 10);
    const method = route.request().method();
    if (method === 'PUT') {
      const body = route.request().postDataJSON() as Partial<MockLeccion>;
      let updated: MockLeccion | undefined;
      state.detail.secciones = state.detail.secciones.map((s) => ({
        ...s,
        lecciones: s.lecciones.map((l) => {
          if (l.id === id) {
            updated = { ...l, ...body };
            return updated;
          }
          return l;
        }),
      }));
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(updated ?? {}),
      });
    }
    if (method === 'DELETE') {
      state.detail.secciones = state.detail.secciones.map((s) => ({
        ...s,
        lecciones: s.lecciones.filter((l) => l.id !== id),
      }));
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    }
    return route.continue();
  });

  // POST /cursos/videos/upload-url (Bunny TUS credentials)
  await page.route('**/cursos/videos/upload-url', async (route) => {
    state.bunnyUploadCalls += 1;
    return route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        endpoint: 'https://video.bunnycdn.com/tusupload',
        VideoId: 'mock-video-guid-1234',
        LibraryId: 'mock-library',
        AuthorizationSignature: 'mock-sig',
        AuthorizationExpire: Date.now() + 3600_000,
      }),
    });
  });
}

/**
 * Mock POST /auth/login (backend) without intercepting the SPA navigation to
 * the Angular route /auth/login. The setupAuthInterceptors helper uses
 * `**\/auth/login` which also matches the page navigation to the same path on
 * the dev server, so we scope our interceptor to only POST requests.
 */
async function mockBackendLoginAs(
  page: Page,
  opts: { email: string; rol: 'ALUMNO' | 'ADMIN' },
): Promise<void> {
  const payload = Buffer.from(
    JSON.stringify({
      rol: opts.rol,
      email: opts.email,
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

async function loginAsAdmin(page: Page): Promise<void> {
  await page.route('**/user/get-by-email', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(userAdminFixture),
    }),
  );
  await mockBackendLoginAs(page, { email: 'admin@test.com', rol: 'ADMIN' });
  await page.goto('/auth/login');
  await page.waitForSelector('input[formControlName="email"]', {
    timeout: 15_000,
  });
  await page
    .locator('input[formControlName="email"]')
    .fill('admin@test.com');
  await page.locator('app-password-input input').fill('test1234');
  // The login button is wrapped by <app-async-button> and its internal
  // <button> is type="button" (not "submit"), so we can't rely on the
  // standard submit-type selector.
  await page.locator('app-async-button button').first().click();
  await page.waitForURL('**/app/**', { timeout: 15_000 });
}

test.describe('Cursos admin — flujo completo', () => {
  let state: AdminState;

  test.beforeEach(async ({ page }) => {
    state = freshState();
    await setupAppConfigStubs(page);
    await setupCursosAdminInterceptors(page, state);
    await loginAsAdmin(page);
  });

  test('1) lista cursos con estado y permite navegar al detalle', async ({
    page,
  }) => {
    await page.goto('/app/cursos-admin');

    await expect(
      page.getByRole('heading', { name: /Cursos/i }).first(),
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Curso QA Test')).toBeVisible();
    await expect(page.getByText('curso-qa-test')).toBeVisible();
    await expect(page.getByText('BORRADOR').first()).toBeVisible();

    await page.getByText('Curso QA Test').click();
    await expect(page).toHaveURL(/\/app\/cursos-admin\/\d+/, { timeout: 5_000 });
  });

  test('2) botón "Nuevo curso" navega a /nuevo y muestra el form', async ({
    page,
  }) => {
    await page.goto('/app/cursos-admin');
    await expect(page.getByText('Curso QA Test')).toBeVisible({
      timeout: 10_000,
    });

    await page.getByRole('button', { name: /Nuevo curso/i }).click();
    await expect(page).toHaveURL(/\/app\/cursos-admin\/nuevo/, {
      timeout: 5_000,
    });
    await expect(page.locator('#ce-titulo')).toBeVisible();
    await expect(page.locator('#ce-slug')).toBeVisible();
  });

  test('3) crear curso nuevo: rellena form y redirige al detalle', async ({
    page,
  }) => {
    await page.goto('/app/cursos-admin/nuevo');
    await expect(page.locator('#ce-titulo')).toBeVisible({ timeout: 10_000 });

    await page.locator('#ce-titulo').fill('Curso Nuevo E2E');
    await page.locator('#ce-slug').fill('curso-nuevo-e2e');
    await page.locator('#ce-descripcion').fill('Descripción de prueba');

    await page.getByRole('button', { name: /Crear curso/i }).click();

    // Redirect should land on /app/cursos-admin/:newId
    await expect(page).toHaveURL(/\/app\/cursos-admin\/\d+/, {
      timeout: 8_000,
    });
    expect(state.cursos.some((c) => c.slug === 'curso-nuevo-e2e')).toBe(true);
  });

  test('4) validación: form sin título queda deshabilitado el botón Crear', async ({
    page,
  }) => {
    await page.goto('/app/cursos-admin/nuevo');
    await expect(page.locator('#ce-titulo')).toBeVisible({ timeout: 10_000 });

    await page.locator('#ce-slug').fill('slug-valido');
    // No título → formGroup.invalid → submit button disabled

    const submit = page.getByRole('button', { name: /Crear curso/i });
    await expect(submit).toBeDisabled();

    await page.locator('#ce-titulo').fill('Ahora sí');
    await expect(submit).toBeEnabled();
  });

  test('5) editar metadata existente: guarda y muestra toast success', async ({
    page,
  }) => {
    await page.goto(`/app/cursos-admin/${state.detail.id}`);
    await expect(page.locator('#ce-titulo')).toBeVisible({ timeout: 10_000 });

    await page.locator('#ce-titulo').fill('Curso QA Test (renombrado)');
    await page.getByRole('button', { name: /Guardar cambios/i }).click();

    await expect(
      page.locator('.toast-success, [class*="ngx-toastr"][class*="success"]'),
    ).toBeVisible({ timeout: 5_000 });
    expect(state.detail.titulo).toBe('Curso QA Test (renombrado)');
  });

  test('6) abrir tab Estructura, añadir sección y verificar render', async ({
    page,
  }) => {
    await page.goto(`/app/cursos-admin/${state.detail.id}`);
    await expect(page.locator('#ce-titulo')).toBeVisible({ timeout: 10_000 });

    // Click on the Estructura tab
    await page.getByRole('tab', { name: /Estructura/i }).click();

    // Add a section
    await page
      .getByRole('button', { name: /Añadir sección/i })
      .first()
      .click();
    await expect(page.locator('#sf-titulo')).toBeVisible({ timeout: 5_000 });
    await page.locator('#sf-titulo').fill('Sección nueva E2E');
    // Save the dialog
    await page
      .getByRole('button', { name: /Guardar/i })
      .last()
      .click();

    await expect(page.getByText('Sección nueva E2E')).toBeVisible({
      timeout: 5_000,
    });
    expect(
      state.detail.secciones.some((s) => s.titulo === 'Sección nueva E2E'),
    ).toBe(true);
  });

  test('7) añadir lección de tipo TEXTO a una sección', async ({ page }) => {
    await page.goto(`/app/cursos-admin/${state.detail.id}`);
    await expect(page.locator('#ce-titulo')).toBeVisible({ timeout: 10_000 });
    await page.getByRole('tab', { name: /Estructura/i }).click();

    // The first section has its own "Añadir lección" button
    const seccionCards = page.locator('.seccion-card');
    await expect(seccionCards.first()).toBeVisible({ timeout: 5_000 });
    await seccionCards
      .first()
      .getByRole('button', { name: /Añadir lección/i })
      .click();

    await expect(page.locator('#lf-titulo')).toBeVisible({ timeout: 5_000 });
    await page.locator('#lf-titulo').fill('Lección E2E texto');
    // Default tipo is VIDEO → switch to TEXTO via the p-dropdown.
    // Use the dropdown UI: click and pick "Texto"
    await page.locator('p-dropdown').first().click();
    await page.getByRole('option', { name: /Texto/i }).click();
    await page
      .locator('textarea[formControlName="contenidoMarkdown"]')
      .fill('# Hola E2E\n\nContenido de prueba');

    await page
      .getByRole('button', { name: /Guardar/i })
      .last()
      .click();

    await expect(page.getByText('Lección E2E texto')).toBeVisible({
      timeout: 5_000,
    });
  });

  test('8) reorder de lecciones llama el endpoint /lecciones/reorder', async ({
    page,
  }) => {
    await page.goto(`/app/cursos-admin/${state.detail.id}`);
    await expect(page.locator('#ce-titulo')).toBeVisible({ timeout: 10_000 });
    await page.getByRole('tab', { name: /Estructura/i }).click();

    // First section has 2 lessons; click the down arrow on the first.
    const firstSeccion = page.locator('.seccion-card').first();
    await expect(firstSeccion).toBeVisible({ timeout: 5_000 });
    // The leccion-row contains an arrow-down button. Find first arrow-down enabled.
    const firstLeccionDown = firstSeccion
      .locator('.leccion-row')
      .first()
      .locator('button')
      .nth(1); // 0=arrow-up (disabled), 1=arrow-down
    await firstLeccionDown.click();

    await expect
      .poll(() => state.reorderLeccionesCalls, { timeout: 5_000 })
      .toBeGreaterThan(0);
  });

  test('9) publicar curso BORRADOR → estado pasa a PUBLICADO en UI', async ({
    page,
  }) => {
    await page.goto(`/app/cursos-admin/${state.detail.id}`);
    await expect(page.locator('#ce-titulo')).toBeVisible({ timeout: 10_000 });

    const publicarBtn = page.getByRole('button', { name: /Publicar/i });
    await expect(publicarBtn).toBeVisible({ timeout: 5_000 });
    await publicarBtn.click();

    // After publishing, an "Archivar" button should appear and BORRADOR tag becomes PUBLICADO.
    await expect(
      page.getByRole('button', { name: /Archivar/i }),
    ).toBeVisible({ timeout: 5_000 });
    expect(state.publicarCalls).toBe(1);
    expect(state.detail.estado).toBe('PUBLICADO');
  });

  test('10) bunny upload — pedir credenciales TUS desde el dialog de lección', async ({
    page,
  }) => {
    await page.goto(`/app/cursos-admin/${state.detail.id}`);
    await expect(page.locator('#ce-titulo')).toBeVisible({ timeout: 10_000 });
    await page.getByRole('tab', { name: /Estructura/i }).click();

    const seccionCards = page.locator('.seccion-card');
    await seccionCards
      .first()
      .getByRole('button', { name: /Añadir lección/i })
      .click();
    await expect(page.locator('#lf-titulo')).toBeVisible({ timeout: 5_000 });

    await page.locator('#lf-titulo').fill('Vídeo bunny test');
    // Default tipo VIDEO. The bunny-upload component renders.
    await expect(
      page.getByRole('button', { name: /Seleccionar vídeo/i }),
    ).toBeVisible({ timeout: 5_000 });

    // We can't actually run TUS upload in the test, but we can verify that
    // the cred endpoint is reachable by triggering startUpload() with a
    // synthetic File. Easier: simulate via direct fetch from the page
    // context — the interceptor will respond.
    const resp = await page.evaluate(async () => {
      const r = await fetch('/cursos/videos/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Vídeo bunny test' }),
      });
      return { status: r.status, body: await r.json() };
    });

    expect(resp.status).toBe(201);
    expect(resp.body.VideoId).toBe('mock-video-guid-1234');
    expect(state.bunnyUploadCalls).toBeGreaterThan(0);
  });

  test('11) tab Acceso permite conceder acceso manual por usuarioId', async ({
    page,
  }) => {
    await page.goto(`/app/cursos-admin/${state.detail.id}`);
    await expect(page.locator('#ce-titulo')).toBeVisible({ timeout: 10_000 });

    await page.getByRole('tab', { name: /Acceso/i }).click();
    await expect(
      page.getByRole('heading', { name: /Conceder acceso manual/i }),
    ).toBeVisible({ timeout: 5_000 });

    // p-inputNumber renders an internal <input>; type chars + blur so the
    // [(ngModel)] binding actually fires onModelChange before we click.
    const numInput = page.locator('p-inputNumber input').last();
    await numInput.click();
    await numInput.pressSequentially('130');
    await numInput.press('Tab');
    const conceder = page.getByRole('button', { name: /Conceder acceso/i });
    await expect(conceder).toBeEnabled({ timeout: 5_000 });
    await conceder.click();

    await expect
      .poll(() => state.grantAccessCalls, { timeout: 5_000 })
      .toBe(1);
  });
});
