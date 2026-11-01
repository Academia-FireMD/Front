import { expect, test } from '@playwright/test';
import userAlumnoFixture from './fixtures/user-alumno.json';
import { setupAppShellStubs } from './helpers/interceptors.helper';

function jwt(payload: Record<string, unknown>): string {
  return `x.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.x`;
}

function usuario(id: number, nombre: string, apellidos: string, email: string) {
  return { ...userAlumnoFixture, id, nombre, apellidos, email };
}

async function stubPerfilAuxiliar(page: import('@playwright/test').Page) {
  await page.route('**/user/tutores', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '[]',
    }),
  );
  await page.route('**/count-planificationes-asignadas', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '0',
    }),
  );
  await page.route('**/cursos/mios', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '[]',
    }),
  );
}

/**
 * Regresión de navegador real para las carreras de sesión del perfil.
 *
 * No hay login real ni backend: se usan fixtures y respuestas HTTP retenidas.
 * A pide el perfil y queda en vuelo; el usuario cambia a B. La respuesta de B
 * debe ser una petición independiente (nunca la de A) y, cuando A termina, no
 * puede sustituir el perfil ni la identidad de B.
 */
test.describe('Sesión — aislamiento de perfil entre cuentas', () => {
  test.beforeEach(async ({}, testInfo) => {
    // El dev server de Playwright compila en frío; el timeout por defecto de
    // 30s puede agotarse antes de que el SPA monte el primer test.
    testInfo.setTimeout(90_000);
  });

  test('el perfil en vuelo de A no sustituye a B tras cambiar de cuenta', async ({
    page,
  }) => {
    await setupAppShellStubs(page);

    const perfilA = usuario(101, 'Ana', 'Anterior', 'a@test.com');
    const perfilB = usuario(202, 'Bea', 'Actual', 'b@test.com');

    let liberarA!: () => void;
    const respuestaA = new Promise<void>((resolve) => {
      liberarA = resolve;
    });
    let peticionesPerfil = 0;

    await page.route('**/user/profile', async (route) => {
      const llamada = ++peticionesPerfil;
      if (llamada === 1) {
        await respuestaA;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(perfilA),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(perfilB),
      });
    });

    await page.route('**/user/get-by-email', async (route) => {
      const email = route.request().postDataJSON()?.email;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(email === 'a@test.com' ? perfilA : perfilB),
      });
    });

    await stubPerfilAuxiliar(page);

    let peticionesLogin = 0;
    await page.route('**/auth/login', (route) => {
      if (route.request().method() !== 'POST') {
        return route.continue();
      }
      const llamada = ++peticionesLogin;
      const esA = llamada === 1;
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: jwt({
            sub: esA ? 101 : 202,
            email: esA ? 'a@test.com' : 'b@test.com',
            rol: 'ALUMNO',
            exp: 9_999_999_999,
          }),
          refresh_token: esA ? 'refresh-A' : 'refresh-B',
        }),
      });
    });

    await page.goto('/auth/login');
    await page.locator('input[formControlName="email"]').fill('a@test.com');
    await page.locator('app-password-input input').fill('test1234');
    await page.locator('app-async-button button').first().click();
    await page.waitForURL('**/app/profile', { timeout: 15_000 });
    await expect.poll(() => peticionesPerfil).toBe(1);

    // Volver al login dentro de la SPA: no recarga la app ni pierde la
    // petición de perfil que sigue retenida.
    await page.goBack();
    await expect(page.locator('input[formControlName="email"]')).toBeVisible({
      timeout: 10_000,
    });

    await page.locator('input[formControlName="email"]').fill('b@test.com');
    await page.locator('app-password-input input').fill('test1234');
    await page.locator('app-async-button button').first().click();
    await page.waitForURL('**/app/profile', { timeout: 15_000 });

    // B debe haber abierto su propia petición, no reutilizado la de A.
    await expect.poll(() => peticionesPerfil).toBeGreaterThanOrEqual(2);
    await expect(page.locator('.user-info-text h3')).toHaveText('Bea Actual', {
      timeout: 10_000,
    });

    liberarA();

    // La respuesta tardía de A no puede repintar el perfil ni restaurar sus
    // tokens: la sesión y el store siguen siendo de B.
    await page.waitForTimeout(500);
    await expect(page.locator('.user-info-text h3')).toHaveText('Bea Actual');

    const subActual = await page.evaluate(() => {
      const token = sessionStorage.getItem('authToken');
      if (!token) return null;
      const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(atob(payload)).sub;
    });
    expect(subActual).toBe(202);
  });

  test('un refresh de A que termina tras el logout no restaura la sesión', async ({
    page,
  }) => {
    await setupAppShellStubs(page);
    await stubPerfilAuxiliar(page);

    const perfilA = usuario(101, 'Ana', 'Anterior', 'a@test.com');
    const tokenA = jwt({
      sub: 101,
      email: 'a@test.com',
      rol: 'ALUMNO',
      exp: 9_999_999_999,
    });

    let liberarRefresh!: () => void;
    const refreshRetenido = new Promise<void>((resolve) => {
      liberarRefresh = resolve;
    });
    let peticionesRefresh = 0;
    await page.route('**/auth/refresh', async (route) => {
      peticionesRefresh += 1;
      await refreshRetenido;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: jwt({
            sub: 101,
            email: 'a@test.com',
            rol: 'ALUMNO',
            exp: 9_999_999_998,
          }),
        }),
      });
    });

    let peticionesPerfil = 0;
    await page.route('**/user/profile', (route) => {
      peticionesPerfil += 1;
      if (peticionesPerfil === 1) {
        return route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'token expirado' }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(perfilA),
      });
    });
    await page.route('**/user/get-by-email', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(perfilA),
      }),
    );
    await page.route('**/auth/login', (route) => {
      if (route.request().method() !== 'POST') {
        return route.continue();
      }
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: tokenA,
          refresh_token: 'refresh-A',
        }),
      });
    });

    await page.goto('/auth/login');
    await page.locator('input[formControlName="email"]').fill('a@test.com');
    await page.locator('app-password-input input').fill('test1234');
    await page.locator('app-async-button button').first().click();
    await page.waitForURL('**/app/profile', { timeout: 15_000 });
    await expect.poll(() => peticionesRefresh).toBe(1);

    // Logout real (AuthService.logout$) mientras el refresh de A sigue
    // retenido. Se usa el componente de layout ya montado en vez de depender
    // del menú responsive.
    await page.evaluate(async () => {
      const ng = (window as any).ng;
      const layout = ng.getComponent(document.querySelector('app-layout'));
      await new Promise<void>((resolve, reject) => {
        layout.authService.logout$().subscribe({
          next: () => resolve(),
          error: (error: unknown) => reject(error),
        });
      });
      await layout.router.navigate(['/auth/login']);
    });
    await page.waitForURL('**/auth/login', { timeout: 10_000 });
    expect(
      await page.evaluate(() => sessionStorage.getItem('authToken')),
    ).toBeNull();

    liberarRefresh();
    await page.waitForTimeout(700);

    // La respuesta vieja no puede reinstalar A ni sacar al usuario del login.
    expect(
      await page.evaluate(() => sessionStorage.getItem('authToken')),
    ).toBeNull();
    await expect(page).toHaveURL(/\/auth\/login/);
    await expect(page.locator('input[formControlName="email"]')).toBeVisible();
  });
});
