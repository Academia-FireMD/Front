import { Page } from '@playwright/test';
import userAlumnoFixture from '../fixtures/user-alumno.json';

function buildMockJwt(payload: Record<string, unknown>): string {
  const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64');
  return `x.${base64Payload}.x`;
}

export async function loginAsAlumnoMock(page: Page): Promise<void> {
  const mockJwt = buildMockJwt({
    rol: 'ALUMNO',
    email: 'alumno@test.com',
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
      body: JSON.stringify(userAlumnoFixture),
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

  await page.goto('/auth/login');
  await page.locator('input[formControlName="email"]').fill('alumno@test.com');
  await page.locator('app-password-input input').fill('test1234');
  // El botón de login es <app-async-button> (renderiza <button type="button">),
  // NO un submit; seleccionar por type="submit" no matchea nada.
  await page.locator('app-async-button button').first().click();
  await page.waitForURL('**/app/**', { timeout: 15_000 });
}
