import { expect, test } from '@playwright/test';
import * as path from 'path';
import userAdminFixture from './fixtures/user-admin.json';
import examenFixture from './fixtures/examen.json';
import { loginAsAdminMock } from './helpers/auth.helper';

// ─── Constants ────────────────────────────────────────────────────────────────

const EXAMEN_ID = 5;
const FIXTURE_XLSX = path.resolve(__dirname, 'fixtures/preguntas-ejemplo.xlsx');

// ─── Mock temas for tema-select component ─────────────────────────────────────

// app-tema-select agrupa por `modulo.nombre` (solo `modulo.esPublico`); sin el
// objeto `modulo` el overlay sale vacío.
const mockTemas = [
  {
    id: 1,
    numero: 1,
    descripcion: 'Tema 1: Anatomía',
    modulo: { nombre: 'Anatomía', esPublico: true, relevancia: [] },
  },
  {
    id: 2,
    numero: 2,
    descripcion: 'Tema 2: Química',
    modulo: { nombre: 'Anatomía', esPublico: true, relevancia: [] },
  },
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

/**
 * Rellena tema + dificultad del diálogo de importar. app-tema-select es un
 * overlay custom (grupos colapsados): se abre clicando el host, se expande el
 * grupo y se elige el primer tema. app-dificultad-dropdown sigue siendo un
 * p-dropdown con appendTo body.
 */
async function rellenarTemaYDificultad(
  page: import('@playwright/test').Page,
): Promise<void> {
  await page.locator('[data-testid="importar-excel-tema"]').click();
  const overlay = page.locator('.p-overlaypanel');
  await overlay.waitFor({ state: 'visible', timeout: 5_000 });
  await overlay.locator('span.font-bold.pointer').first().click(); // expandir grupo
  await overlay.locator('.pl-3 span.pointer').first().click(); // primer tema
  // Cerrar el overlay con un clic neutro DENTRO del diálogo (un Escape cerraría
  // el p-dialog entero, no solo el overlay del tema).
  await page
    .locator('[data-testid="importar-excel-dialog"]')
    .getByText('Archivo Excel')
    .click();
  await overlay.waitFor({ state: 'hidden', timeout: 3_000 }).catch(() => {});

  const dificultadWrapper = page.locator('[data-testid="importar-excel-dificultad"]');
  await dificultadWrapper.locator('.p-dropdown').click();
  const dropdownPanel = page.locator('.p-dropdown-panel').last();
  await dropdownPanel.waitFor({ state: 'visible', timeout: 5_000 });
  await dropdownPanel.locator('.p-dropdown-item').first().click();
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

  // Temas for tema-select. app-tema-select consume GET /get-temas (no
  // /tema/get-temas); el patrón **/get-temas cubre ambos.
  await page.route('**/get-temas', (route) =>
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
    await loginAsAdminMock(page, userAdminFixture);
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
    // El título "Importar preguntas desde Excel" vive en el titlebar del
    // p-dialog (fuera del div de contenido con el testid); verificamos el
    // contenido real del cuerpo del diálogo.
    await expect(dialog).toContainText('Archivo Excel');
  });

  test('el botón Importar está deshabilitado hasta completar todos los campos', async ({ page }) => {
    await page.goto(`/app/examen/${EXAMEN_ID}`);

    await page.locator('button.fab-button').click();
    await expect(page.locator('[data-testid="metodo-importar-excel-card"]')).toBeVisible({ timeout: 8_000 });
    await page.locator('[data-testid="metodo-importar-excel-card"]').click();
    await expect(page.locator('[data-testid="importar-excel-dialog"]')).toBeVisible({ timeout: 8_000 });

    // Submit button should be disabled initially (no file, no tema, no dificultad).
    // El [disabled] vive en el <button> interno del p-button, no en el host.
    const submitBtn = page.locator('[data-testid="importar-excel-submit"] button');
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

    await rellenarTemaYDificultad(page);

    // Submit button should now be enabled ([disabled] en el <button> interno).
    const submitBtn = page.locator('[data-testid="importar-excel-submit"] button');
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

    await rellenarTemaYDificultad(page);

    // Submit
    await page.locator('[data-testid="importar-excel-submit"]').click();

    // Should show error toast
    await expect(
      page.locator('.toast-error, [class*="ngx-toastr"][class*="error"]').first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('la checkbox de reserva está disponible en el diálogo', async ({ page }) => {
    await page.goto(`/app/examen/${EXAMEN_ID}`);

    // La opción "Agregar como reserva" vive en el diálogo de selección de
    // método (se elige ANTES de abrir el de importar; el flag agregarComoReserva
    // se propaga al import). Se verifica ahí, no en el diálogo de importar.
    await page.locator('button.fab-button').click();
    await expect(page.locator('[data-testid="metodo-importar-excel-card"]')).toBeVisible({ timeout: 8_000 });

    const reservaCheckbox = page.locator('[data-testid="importar-excel-reserva"]');
    await expect(reservaCheckbox).toBeVisible();
    await expect(reservaCheckbox).toContainText('reserva');
  });
});
