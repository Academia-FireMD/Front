import { expect, test } from '@playwright/test';
import userAdminFixture from './fixtures/user-admin.json';
import userAlumnoFixture from './fixtures/user-alumno.json';
import { setupAuthInterceptors } from './helpers/interceptors.helper';

test.describe('Autenticación', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/user/get-by-email', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(userAlumnoFixture),
      })
    );
  });

  test.describe('Login', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/auth/login');
      await expect(page.locator('input[formControlName="email"]')).toBeVisible({ timeout: 10_000 });
    });

    test('debería hacer login como alumno y redirigir a /app', async ({ page }) => {
      await setupAuthInterceptors(page, { email: 'alumno@test.com', rol: 'ALUMNO' });

      await page.locator('input[formControlName="email"]').fill('alumno@test.com');
      await page.locator('app-password-input input').fill('test1234');
      await page.locator('button[type="submit"]').click();

      await expect(page).toHaveURL(/\/app\//, { timeout: 10_000 });
    });

    test('debería hacer login como admin y redirigir a /app', async ({ page }) => {
      await page.route('**/user/get-by-email', (route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(userAdminFixture) })
      );
      await setupAuthInterceptors(page, { email: 'admin@test.com', rol: 'ADMIN' });

      await page.locator('input[formControlName="email"]').fill('admin@test.com');
      await page.locator('app-password-input input').fill('test1234');
      await page.locator('button[type="submit"]').click();

      await expect(page).toHaveURL(/\/app\//, { timeout: 10_000 });
    });

    test('debería mostrar error con credenciales inválidas', async ({ page }) => {
      await setupAuthInterceptors(page, {
        email: 'invalid@test.com',
        rol: 'ALUMNO',
        statusCode: 401,
        errorBody: { message: 'Credenciales incorrectas' },
      });

      await page.locator('input[formControlName="email"]').fill('invalid@email.com');
      await page.locator('app-password-input input').fill('wrongpassword');
      await page.locator('button[type="submit"]').click();

      await expect(page.locator('.toast-error, [class*="ngx-toastr"][class*="error"]')).toBeVisible({ timeout: 5_000 });
    });

    test('debería validar el formato del email', async ({ page }) => {
      await page.locator('input[formControlName="email"]').fill('invalidemail');
      await page.locator('input[formControlName="email"]').blur();

      await expect(page.locator('text=El formato del email no es válido')).toBeVisible({ timeout: 3_000 });
    });
  });

  test.describe('Registro', () => {
    test.beforeEach(async ({ page }) => {
      await page.route('**/user/tutors**', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([{ id: 1, nombre: 'Tutor Test', email: 'tutor@test.com' }]),
        })
      );
      await page.route('**/auth/registro', (route) =>
        route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Usuario registrado correctamente' }),
        })
      );

      await page.goto('/auth/registro');
    });

    test('debería mostrar validación de contraseñas que no coinciden', async ({ page }) => {
      await page.locator('app-password-input').first().locator('input').fill('Password123!');
      await page.locator('app-password-input').last().locator('input').fill('DifferentPassword123!');
      await page.locator('app-password-input').last().locator('input').blur();

      await expect(page.locator('text=Las contraseñas no coinciden')).toBeVisible({ timeout: 3_000 });
    });
  });

  test.describe('Recuperación de contraseña', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/auth/recuperar-contrasenya');
    });

    test('debería validar el formato del email', async ({ page }) => {
      await page.locator('input[formControlName="email"]').fill('invalidemail');
      await page.locator('input[formControlName="email"]').blur();

      await expect(page.locator('text=El formato del email no es válido')).toBeVisible({ timeout: 3_000 });
    });

    test('debería cambiar la contraseña con token válido', async ({ page }) => {
      await page.route('**/auth/reset-password', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Contraseña actualizada correctamente' }),
        })
      );

      await page.goto('/auth/reset-password?token=valid-token');
      await page.locator('app-password-input input').fill('NewPassword123!');
      await page.locator('button[type="submit"]').click();

      await expect(page).toHaveURL(/\/auth\/login/, { timeout: 8_000 });
    });

    test('debería mostrar error con token inválido', async ({ page }) => {
      await page.route('**/auth/reset-password', (route) =>
        route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Token inválido o expirado' }),
        })
      );

      await page.goto('/auth/reset-password?token=invalid-token');
      await page.locator('app-password-input input').fill('NewPassword123!');
      await page.locator('button[type="submit"]').click();

      await expect(page.locator('.toast-error, [class*="ngx-toastr"][class*="error"]')).toBeVisible({ timeout: 5_000 });
    });
  });
});
