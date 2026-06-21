import { Page } from '@playwright/test';
import userAlumnoFixture from '../fixtures/user-alumno.json';

function buildMockJwt(payload: Record<string, unknown>): string {
  const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64');
  return `x.${base64Payload}.x`;
}

type Rol = 'ALUMNO' | 'ADMIN' | 'SUPERADMIN';

/**
 * Login mockeado genérico por rol. Mismo flujo robusto que el de alumno
 * (POST-scoped /auth/login, shell stubs, botón <app-async-button>), pero con
 * rol/email/fixture de usuario configurables — sirve para alumno, admin y
 * superadmin sin duplicar el setup que se desincronizaba.
 */
export async function loginAsRoleMock(
  page: Page,
  opts: { rol: Rol; email?: string; userFixture?: unknown } = { rol: 'ALUMNO' }
): Promise<void> {
  const email = opts.email ?? `${opts.rol.toLowerCase()}@test.com`;
  const userFixture = opts.userFixture ?? userAlumnoFixture;
  const mockJwt = buildMockJwt({
    rol: opts.rol,
    email,
    sub: 1,
    exp: 9_999_999_999,
  });

  // Scope SOLO a POST: `**/auth/login` también matchea la navegación GET del
  // SPA a la ruta /auth/login; si la interceptamos, el navegador pinta el JSON
  // en vez de renderizar la página de login (el input nunca aparece).
  await page.route('**/auth/login', (route) =>
    route.request().method() === 'POST'
      ? route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            access_token: mockJwt,
            refresh_token: mockJwt,
          }),
        })
      : route.continue()
  );

  await page.route('**/user/get-by-email', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(userFixture),
    })
  );

  // El layout pide /api/app-config al arrancar; sin stub, generateShades()
  // peta y el SPA no renderiza la página de login (el input nunca aparece).
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
    })
  );

  // El app-shell evolucionado (asistente IA, white-label, perfil) pide más
  // endpoints al redirigir a /app; sin estos stubs el SPA dispara el toast
  // genérico o crashea, y muchos e2e fallaban tras login.
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
        CALLEJERO: true,
      }),
    })
  );
  await page.route('**/api/config', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ verifactuEnabled: false }),
    })
  );
  await page.route('**/user/profile', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(userFixture),
    })
  );
  await page.route('**/ai-assistant/token', (route) =>
    route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({ reason: 'DISABLED' }),
    })
  );

  await page.goto('/auth/login');
  await page.locator('input[formControlName="email"]').fill(email);
  await page.locator('app-password-input input').fill('test1234');
  // El botón de login es <app-async-button> (renderiza <button type="button">),
  // NO un submit; seleccionar por type="submit" no matchea nada.
  await page.locator('app-async-button button').first().click();
  await page.waitForURL('**/app/**', { timeout: 15_000 });
}

export async function loginAsAlumnoMock(page: Page): Promise<void> {
  await loginAsRoleMock(page, {
    rol: 'ALUMNO',
    email: 'alumno@test.com',
    userFixture: userAlumnoFixture,
  });
}

export async function loginAsAdminMock(
  page: Page,
  userFixture?: unknown
): Promise<void> {
  await loginAsRoleMock(page, {
    rol: 'ADMIN',
    email: 'admin@test.com',
    userFixture: userFixture ?? userAlumnoFixture,
  });
}

export async function loginAsSuperadminMock(
  page: Page,
  userFixture?: unknown
): Promise<void> {
  await loginAsRoleMock(page, {
    rol: 'SUPERADMIN',
    email: 'superadmin@test.com',
    userFixture: userFixture ?? userAlumnoFixture,
  });
}
