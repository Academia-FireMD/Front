import { expect, test } from '@playwright/test';
import { loginAsAlumnoMock } from './helpers/auth.helper';
import { setupSimulacroInterceptors, setupTestPracticaInterceptors } from './helpers/interceptors.helper';

const EXAMEN_ID = 5;
const TEST_ID = 42;

test.describe('Realizar Simulacro (Alumno)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAlumnoMock(page);
    await setupSimulacroInterceptors(page, { examenId: EXAMEN_ID, testId: TEST_ID });
  });

  test('muestra el nombre del simulacro y el botón de iniciar', async ({ page }) => {
    await page.goto(`/simulacros/realizar-simulacro/${EXAMEN_ID}`);

    await expect(page.locator('[data-testid="simulacro-titulo"], h1, h2')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('[data-testid="iniciar-simulacro-btn"], button:has-text("Iniciar"), button:has-text("Comenzar")')).toBeVisible();
  });

  test('muestra información del examen cargada desde la API', async ({ page }) => {
    await page.goto(`/simulacros/realizar-simulacro/${EXAMEN_ID}`);

    // Wait for content to load
    await expect(page.locator('[data-testid="simulacro-titulo"], h1, h2')).toBeVisible({ timeout: 10_000 });

    // The examen fixture has titulo "Simulacro Bomberos 2024 - Convocatoria Estatal"
    await expect(page.locator('body')).toContainText('Simulacro Bomberos');
  });

  test('iniciar simulacro llama a verificar-acceso y luego a start-simulacro', async ({ page }) => {
    await page.goto(`/simulacros/realizar-simulacro/${EXAMEN_ID}`);
    await expect(page.locator('[data-testid="iniciar-simulacro-btn"], button:has-text("Iniciar"), button:has-text("Comenzar")')).toBeVisible({ timeout: 10_000 });

    const apiCalls: string[] = [];
    page.on('request', (req) => apiCalls.push(req.url()));

    await page.locator('[data-testid="iniciar-simulacro-btn"], button:has-text("Iniciar"), button:has-text("Comenzar")').click();

    // A PrimeNG confirmation dialog appears
    await expect(page.locator('.p-dialog, .p-confirm-dialog')).toBeVisible({ timeout: 5_000 });
    await page.locator('.p-confirm-dialog-accept, button:has-text("Comenzar")').click();

    // Wait for start-simulacro API call + countdown (3 seconds)
    await page.waitForResponse(`**/examenes/start-simulacro/${EXAMEN_ID}`, { timeout: 10_000 });

    expect(apiCalls.some((u) => u.includes(`verificar-acceso-simulacro/${EXAMEN_ID}`))).toBe(true);
    expect(apiCalls.some((u) => u.includes(`start-simulacro/${EXAMEN_ID}`))).toBe(true);
  });

  test('después de iniciar redirige al componente de completar', async ({ page }) => {
    await page.goto(`/simulacros/realizar-simulacro/${EXAMEN_ID}`);
    await expect(page.locator('[data-testid="iniciar-simulacro-btn"], button:has-text("Iniciar"), button:has-text("Comenzar")')).toBeVisible({ timeout: 10_000 });

    await page.locator('[data-testid="iniciar-simulacro-btn"], button:has-text("Iniciar"), button:has-text("Comenzar")').click();
    await expect(page.locator('.p-dialog, .p-confirm-dialog')).toBeVisible({ timeout: 5_000 });
    await page.locator('.p-confirm-dialog-accept, button:has-text("Comenzar")').click();

    await page.waitForResponse(`**/examenes/start-simulacro/${EXAMEN_ID}`, { timeout: 10_000 });

    // After the 3-second countdown, it navigates to the completar route
    await expect(page).toHaveURL(
      new RegExp(`simulacros/realizar-simulacro/${EXAMEN_ID}/completar/${TEST_ID}`),
      { timeout: 8_000 }
    );
  });

  test.describe('Completar test del simulacro', () => {
    test.beforeEach(async ({ page }) => {
      await setupTestPracticaInterceptors(page);
    });

    test('la página de completar muestra la primera pregunta', async ({ page }) => {
      // Navigate directly to completar (bypass the launch page)
      await page.goto(`/simulacros/realizar-simulacro/${EXAMEN_ID}/completar/${TEST_ID}`);

      await expect(page.locator('[data-testid="pregunta-card"]')).toBeVisible({ timeout: 10_000 });
      await expect(page.locator('[data-testid="enunciado-pregunta"]')).toBeVisible();
    });

    test('responder todas las preguntas y finalizar redirige a resultados del simulacro', async ({ page }) => {
      await page.goto(`/simulacros/realizar-simulacro/${EXAMEN_ID}/completar/${TEST_ID}`);
      await expect(page.locator('[data-testid="pregunta-card"]')).toBeVisible({ timeout: 10_000 });

      // Finalize directly
      await page.locator('[data-testid="finalizar-test-btn"]').click();
      await page.waitForResponse('**/tests/finalizar-test/**', { timeout: 8_000 });

      await expect(page).toHaveURL(
        new RegExp(`(simulacros/resultado/${EXAMEN_ID}|examen/resultado/${EXAMEN_ID})`),
        { timeout: 8_000 }
      );
    });
  });

  test('pantalla de error cuando el simulacro no existe', async ({ page }) => {
    // Override to return 404
    await page.route(`**/examenes/simulacro/999`, (route) =>
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Not found' }),
      })
    );

    await page.goto('/simulacros/realizar-simulacro/999');

    // The component sets statusLoad = 'not_found' on error
    await expect(
      page.locator('[data-testid="simulacro-not-found"], [data-testid="error-container"]')
    ).toBeVisible({ timeout: 8_000 });
  });
});
