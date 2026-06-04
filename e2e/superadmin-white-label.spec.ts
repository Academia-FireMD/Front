import { expect, Page, test } from '@playwright/test';
import userAlumnoFixture from './fixtures/user-alumno.json';
import { setupAuthInterceptors } from './helpers/interceptors.helper';

/**
 * E2E smoke white-label MVP (§8.2).
 *
 * Cubre los 7 escenarios de §8.2 mockeando los endpoints `/api/app-config`
 * y `/api/app-config/modulos` con interceptors Playwright. NO requiere
 * backend real corriendo — solo el dev server Angular.
 */

interface MockConfig {
  appName: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  updatedAt: string;
}

interface MockEstadoModulos {
  PLANIFICACION: boolean;
  SIMULACROS: boolean;
  HORARIOS: boolean;
  DOCUMENTACION: boolean;
  CURSOS: boolean;
  EXAMEN: boolean;
  TEST: boolean;
  FLASHCARDS: boolean;
  FACTURACION: boolean;
}

const defaultConfig: MockConfig = {
  appName: 'TecnikaFire',
  logoUrl: null,
  primaryColor: '#FF6B35',
  secondaryColor: '#004E89',
  updatedAt: '2026-05-21T10:00:00Z',
};

const defaultModulos: MockEstadoModulos = {
  PLANIFICACION: true,
  SIMULACROS: true,
  HORARIOS: true,
  DOCUMENTACION: true,
  CURSOS: true,
  EXAMEN: true,
  TEST: true,
  FLASHCARDS: true,
  FACTURACION: true,
};

async function setupAppConfigMocks(
  page: Page,
  state: { config: MockConfig; modulos: MockEstadoModulos },
): Promise<void> {
  await page.route('**/api/app-config', async (route) => {
    const req = route.request();
    if (req.method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(state.config),
      });
    }
    if (req.method() === 'PUT') {
      const body = req.postDataJSON() as Partial<MockConfig> & {
        updatedAt: string;
      };
      state.config = {
        ...state.config,
        ...body,
        updatedAt: new Date().toISOString(),
      };
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(state.config),
      });
    }
    return route.continue();
  });

  await page.route('**/api/app-config/modulos', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(state.modulos),
    }),
  );

  await page.route('**/api/app-config/modulos/*', (route) => {
    const url = route.request().url();
    const m = url.split('/').pop() as keyof MockEstadoModulos;
    const body = route.request().postDataJSON() as { habilitado: boolean };
    if (m && m in state.modulos) {
      state.modulos[m] = body.habilitado;
    }
    return route.fulfill({ status: 200, body: '{}' });
  });

  await page.route('**/api/app-config/logo', (route) => {
    if (route.request().method() === 'DELETE') {
      state.config = { ...state.config, logoUrl: null };
      return route.fulfill({ status: 200, body: '{}' });
    }
    state.config = {
      ...state.config,
      logoUrl: 'https://cdn/uploaded-logo.png',
      updatedAt: new Date().toISOString(),
    };
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        logoUrl: state.config.logoUrl,
        updatedAt: state.config.updatedAt,
      }),
    });
  });
}

async function loginAs(
  page: Page,
  rol: 'ALUMNO' | 'ADMIN' | 'SUPERADMIN',
): Promise<void> {
  await setupAuthInterceptors(page, { email: `${rol.toLowerCase()}@t.com`, rol });
  await page.route('**/user/get-by-email', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...userAlumnoFixture, rol }),
    }),
  );
  await page.goto('/auth/login');
  await page.locator('input[formControlName="email"]').fill(`${rol.toLowerCase()}@t.com`);
  await page.locator('app-password-input input').fill('test1234');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/app/**', { timeout: 15_000 });
}

test.describe('White-label superadmin panel', () => {
  let state: { config: MockConfig; modulos: MockEstadoModulos };

  test.beforeEach(async ({ page }) => {
    state = {
      config: { ...defaultConfig },
      modulos: { ...defaultModulos },
    };
    await setupAppConfigMocks(page, state);
  });

  test('SUPERADMIN ve entrada Configuración en menú', async ({ page }) => {
    await loginAs(page, 'SUPERADMIN');
    await expect(page.getByText('Configuración').first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test('panel /superadmin/config renderiza 3 secciones', async ({ page }) => {
    await loginAs(page, 'SUPERADMIN');
    await page.goto('/app/superadmin/config');
    await expect(page.locator('[data-testid="section-branding"]')).toBeVisible();
    await expect(page.locator('[data-testid="section-logo"]')).toBeVisible();
    await expect(page.locator('[data-testid="section-modulos"]')).toBeVisible();
  });

  test('cambia primaryColor → CSS var --primary-color actualizada', async ({
    page,
  }) => {
    await loginAs(page, 'SUPERADMIN');
    await page.goto('/app/superadmin/config');
    await page.locator('[data-testid="input-primaryColor"]').fill('#FF0000');
    await page.locator('[data-testid="btn-save-branding"]').click();
    await expect
      .poll(
        () =>
          page.evaluate(() =>
            getComputedStyle(document.documentElement).getPropertyValue(
              '--primary-color',
            ),
          ),
        { timeout: 5_000 },
      )
      .toContain('#FF0000');
  });

  test('toggle SIMULACROS OFF → al recargar el menú no muestra Simulacros', async ({
    page,
  }) => {
    await loginAs(page, 'SUPERADMIN');
    await page.goto('/app/superadmin/config');
    await page.locator('[data-testid="switch-modulo-SIMULACROS"]').click();
    // ahora hacemos un nuevo "login" como ALUMNO para forzar reload con modulos OFF
    await loginAs(page, 'ALUMNO');
    await expect(page.getByText('Simulacros')).toHaveCount(0);
  });

  test('delete logo → fallback aplicado en sidebar', async ({ page }) => {
    state.config.logoUrl = 'https://cdn/old-logo.png';
    await loginAs(page, 'SUPERADMIN');
    await page.goto('/app/superadmin/config');
    page.on('dialog', (d) => d.accept());
    await page.locator('[data-testid="btn-delete-logo"]').click();
    // logo del sidenav debería ser el fallback /white_logo.png
    await expect
      .poll(() =>
        page.locator('.image-container img').first().getAttribute('src'),
      )
      .toContain('white_logo.png');
  });

  test('ALUMNO no ve entrada Configuración en menú', async ({ page }) => {
    await loginAs(page, 'ALUMNO');
    await expect(page.getByText('Configuración')).toHaveCount(0);
  });

  test('ALUMNO accediendo a /app/superadmin/config es redirigido', async ({
    page,
  }) => {
    await loginAs(page, 'ALUMNO');
    await page.goto('/app/superadmin/config');
    await expect(page).toHaveURL(/\/app\/profile/, { timeout: 5_000 });
  });
});
