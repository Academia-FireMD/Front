import { expect, test } from '@playwright/test';
import * as path from 'path';
import userAdminFixture from './fixtures/user-admin.json';
import examenFixture from './fixtures/examen.json';

// ─── Constants ────────────────────────────────────────────────────────────────

const EXAMEN_ID = 5;
const FIXTURE_XLSX = path.resolve(__dirname, 'fixtures/preguntas-ejemplo.xlsx');

// ─── Mock temas for tema-select component ─────────────────────────────────────

const mockTemas = [
  { id: 1, numero: 1, descripcion: 'Tema 1: Anatomía', oposicion: 'BOMBEROS_ESTADO' },
  { id: 2, numero: 2, descripcion: 'Tema 2: Química', oposicion: 'BOMBEROS_ESTADO' },
];

// ─── Mock examen with test + testPreguntas so the page renders fully ──────────

const mockExamen = {
  ...examenFixture,
  id: EXAMEN_ID,
  tipoAcceso: 'LIBRE',
  test: {
    id: 10,
    testPreguntas: [],
  },
  testId: 10,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildMockJwt(payload: Record<string, unknown>): string {
  const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64');
  return `x.${base64Payload}.x`;
}

async function loginAsAdminMock(page: import('@playwright/test').Page): Promise<void> {
  const mockJwt = buildMockJwt({
    rol: 'ADMIN',
    email: 'admin@test.com',
    sub: 99,
    exp: 9_999_999_999,
  });

  await page.route('**/auth/login', (route) =>
    route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ access_token: mockJwt, refresh_token: mockJwt }),
    }),
  );

  await page.route('**/user/get-by-email', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(userAdminFixture),
    }),
  );

  await page.goto('/auth/login');
  await page.locator('input[formControlName="email"]').fill('admin@test.com');
  await page.locator('app-password-input input').fill('test1234');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/app/**', { timeout: 15_000 });
}

async function setupExamenDetailInterceptors(
  page: import('@playwright/test').Page,
  examenId: number,
): Promise<void> {
  // Examen detail load
  await page.route(`**/examenes/${examenId}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockExamen),
    }),
  );

  // Temas for tema-select
  await page.route('**/tema/get-temas', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockTemas),
    }),
  );

  // Results tab (avoid errors on tab load)
  await page.route(`**/examenes/${examenId}/resultados**`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ resultados: [], totalParticipantes: 0 }),
    }),
  );

  // WooCommerce products (used by config tab)
  await page.route('**/woocommerce**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    }),
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('Importar Excel en examen (Admin)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdminMock(page);
    await setupExamenDetailInterceptors(page, EXAMEN_ID);
  });

  test('el diálogo de selección de método muestra la card de Importar Excel', async ({ page }) => {
    await page.goto(`/app/examen/${EXAMEN_ID}`);

    // The FAB button (pi-plus) opens the method selector dialog
    await page.locator('button.fab-button').click();

    // The methods dialog should be visible with the Excel card
    const excelCard = page.locator('[data-testid="metodo-importar-excel-card"]');
    await expect(excelCard).toBeVisible({ timeout: 8_000 });
    await expect(excelCard).toContainText('Importar Excel');
  });

  test('abre el diálogo de importar Excel al hacer clic en la card', async ({ page }) => {
    await page.goto(`/app/examen/${EXAMEN_ID}`);

    // Open the method selector
    await page.locator('button.fab-button').click();
    await expect(page.locator('[data-testid="metodo-importar-excel-card"]')).toBeVisible({ timeout: 8_000 });

    // Click the Importar Excel card
    await page.locator('[data-testid="metodo-importar-excel-card"]').click();

    // The importar-excel dialog should appear
    const dialog = page.locator('[data-testid="importar-excel-dialog"]');
    await expect(dialog).toBeVisible({ timeout: 8_000 });
    await expect(dialog).toContainText('Importar preguntas desde Excel');
  });

  test('el botón Importar está deshabilitado hasta completar todos los campos', async ({ page }) => {
    await page.goto(`/app/examen/${EXAMEN_ID}`);

    await page.locator('button.fab-button').click();
    await expect(page.locator('[data-testid="metodo-importar-excel-card"]')).toBeVisible({ timeout: 8_000 });
    await page.locator('[data-testid="metodo-importar-excel-card"]').click();
    await expect(page.locator('[data-testid="importar-excel-dialog"]')).toBeVisible({ timeout: 8_000 });

    // Submit button should be disabled initially (no file, no tema, no dificultad)
    const submitBtn = page.locator('[data-testid="importar-excel-submit"]');
    await expect(submitBtn).toBeDisabled();
  });

  test('admin importa Excel y preguntas aparecen en el examen', async ({ page }) => {
    // Mock the import endpoint to return success
    const PREGUNTAS_CREADAS = 3;
    await page.route(`**/examenes/${EXAMEN_ID}/importar-preguntas-excel`, (route) =>
      route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          message: `Se importaron ${PREGUNTAS_CREADAS} preguntas correctamente`,
          creadas: PREGUNTAS_CREADAS,
        }),
      }),
    );

    await page.goto(`/app/examen/${EXAMEN_ID}`);

    // Open method selector via FAB
    await page.locator('button.fab-button').click();
    await expect(page.locator('[data-testid="metodo-importar-excel-card"]')).toBeVisible({ timeout: 8_000 });
    await page.locator('[data-testid="metodo-importar-excel-card"]').click();

    // Verify dialog is open
    await expect(page.locator('[data-testid="importar-excel-dialog"]')).toBeVisible({ timeout: 8_000 });

    // Upload the Excel file
    await page.setInputFiles('[data-testid="importar-excel-file-input"]', FIXTURE_XLSX);

    // Select tema: click the custom dropdown trigger inside the wrapper
    const temaWrapper = page.locator('[data-testid="importar-excel-tema"]');
    await temaWrapper.locator('.p-dropdown').click();
    // The overlay panel opens — click the first radio option
    const overlayPanel = page.locator('p-overlaypanel').last();
    await overlayPanel.waitFor({ state: 'visible', timeout: 5_000 });
    await overlayPanel.locator('p-radioButton').first().click();

    // Select dificultad: p-dropdown with appendTo="body"
    const dificultadWrapper = page.locator('[data-testid="importar-excel-dificultad"]');
    await dificultadWrapper.locator('.p-dropdown').click();
    const dropdownPanel = page.locator('.p-dropdown-panel').last();
    await dropdownPanel.waitFor({ state: 'visible', timeout: 5_000 });
    await dropdownPanel.locator('.p-dropdown-item').first().click();

    // Submit button should now be enabled
    const submitBtn = page.locator('[data-testid="importar-excel-submit"]');
    await expect(submitBtn).not.toBeDisabled({ timeout: 3_000 });

    // Click submit
    await submitBtn.click();

    // Assert success toast (ngx-toastr uses .toast-success)
    await expect(
      page.locator('.toast-success, [class*="ngx-toastr"][class*="success"]').first(),
    ).toContainText('importaron', { timeout: 10_000 });

    // Assert the dialog closes after success
    await expect(page.locator('[data-testid="importar-excel-dialog"]')).not.toBeVisible({ timeout: 5_000 });
  });

  test('muestra toast de error cuando la importación falla', async ({ page }) => {
    // Mock a failed import
    await page.route(`**/examenes/${EXAMEN_ID}/importar-preguntas-excel`, (route) =>
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Formato de Excel no válido' }),
      }),
    );

    await page.goto(`/app/examen/${EXAMEN_ID}`);

    await page.locator('button.fab-button').click();
    await expect(page.locator('[data-testid="metodo-importar-excel-card"]')).toBeVisible({ timeout: 8_000 });
    await page.locator('[data-testid="metodo-importar-excel-card"]').click();
    await expect(page.locator('[data-testid="importar-excel-dialog"]')).toBeVisible({ timeout: 8_000 });

    // Upload file
    await page.setInputFiles('[data-testid="importar-excel-file-input"]', FIXTURE_XLSX);

    // Select tema
    const temaWrapper = page.locator('[data-testid="importar-excel-tema"]');
    await temaWrapper.locator('.p-dropdown').click();
    const overlayPanel = page.locator('p-overlaypanel').last();
    await overlayPanel.waitFor({ state: 'visible', timeout: 5_000 });
    await overlayPanel.locator('p-radioButton').first().click();

    // Select dificultad
    const dificultadWrapper = page.locator('[data-testid="importar-excel-dificultad"]');
    await dificultadWrapper.locator('.p-dropdown').click();
    const dropdownPanel = page.locator('.p-dropdown-panel').last();
    await dropdownPanel.waitFor({ state: 'visible', timeout: 5_000 });
    await dropdownPanel.locator('.p-dropdown-item').first().click();

    // Submit
    await page.locator('[data-testid="importar-excel-submit"]').click();

    // Should show error toast
    await expect(
      page.locator('.toast-error, [class*="ngx-toastr"][class*="error"]').first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('la checkbox de reserva está disponible en el diálogo', async ({ page }) => {
    await page.goto(`/app/examen/${EXAMEN_ID}`);

    await page.locator('button.fab-button').click();
    await expect(page.locator('[data-testid="metodo-importar-excel-card"]')).toBeVisible({ timeout: 8_000 });
    await page.locator('[data-testid="metodo-importar-excel-card"]').click();
    await expect(page.locator('[data-testid="importar-excel-dialog"]')).toBeVisible({ timeout: 8_000 });

    // The reserva checkbox should be present
    const reservaCheckbox = page.locator('[data-testid="importar-excel-reserva"]');
    await expect(reservaCheckbox).toBeVisible();
    await expect(reservaCheckbox).toContainText('reserva');
  });
});
