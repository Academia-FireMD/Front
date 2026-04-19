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

  await page.route('**/auth/login', (route) =>
    route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ access_token: mockJwt, refresh_token: mockJwt }),
    })
  );

  await page.route('**/user/get-by-email', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(userAlumnoFixture),
    })
  );

  await page.goto('/auth/login');
  await page.locator('input[formControlName="email"]').fill('alumno@test.com');
  await page.locator('app-password-input input').fill('test1234');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/app/**', { timeout: 15_000 });
}
