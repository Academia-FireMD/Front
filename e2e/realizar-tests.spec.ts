import { expect, test, type Page } from '@playwright/test';
import { loginAsAlumnoMock } from './helpers/auth.helper';
import { setupTestGenerarInterceptors, setupTestPracticaInterceptors } from './helpers/interceptors.helper';

/**
 * Selecciona el primer tema del `app-tema-select`. El componente evolucionó de
 * un p-multiSelect a un overlay custom (p-overlayPanel) con grupos COLAPSADOS
 * por defecto: hay que abrir el overlay, expandir el primer grupo y clicar el
 * primer item. (Antes el e2e esperaba `.p-multiselect-panel` → timeout 30s.)
 */
async function seleccionarPrimerTema(page: Page): Promise<void> {
  await page.locator('[data-testid="temas-select"]').click();
  const panel = page.locator('.p-overlaypanel');
  await panel.waitFor({ state: 'visible', timeout: 8_000 });
  await panel.locator('span.font-bold.pointer').first().click(); // expandir grupo
  await panel.locator('.pl-3 span.pointer').first().click(); // primer tema
  await page.keyboard.press('Escape');
}

test.describe('Realizar Tests - Configuración y Generación', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAlumnoMock(page);
    await setupTestGenerarInterceptors(page);
    await setupTestPracticaInterceptors(page);
    await page.goto('/app/test/alumno/realizar-test');
    // Wait for the container to be visible — use a generous timeout since Angular loads lazily
    await expect(page.locator('[data-testid="realizar-test-container"]')).toBeVisible({ timeout: 15_000 });
  });

  test.describe('Interfaz de configuración', () => {
    test('debería mostrar los controles de configuración', async ({ page }) => {
      await expect(page.locator('[data-testid="configuracion-test-card"]')).toBeVisible();
      await expect(page.locator('[data-testid="num-preguntas-dropdown"]')).toBeVisible();
      await expect(page.locator('[data-testid="dificultad-multiselect"]')).toBeVisible();
      await expect(page.locator('[data-testid="generar-test-btn"]')).toBeVisible();
    });

    test('el botón de generar está deshabilitado hasta que se seleccionen temas', async ({ page }) => {
      await expect(page.locator('[data-testid="generar-test-btn"]')).toBeDisabled();
    });
  });

  test.describe('Test Normal', () => {
    test('debería configurar y generar un test básico', async ({ page }) => {
      // Select number of questions
      await page.locator('[data-testid="num-preguntas-dropdown"]').click();
      await page.locator('.p-dropdown-item').filter({ hasText: '10' }).click();

      // Select difficulty
      await page.locator('[data-testid="dificultad-multiselect"]').click();
      await page.locator('.p-multiselect-panel').waitFor({ state: 'visible' });
      await page.locator('.p-multiselect-panel .p-checkbox').first().click();
      await page.keyboard.press('Escape');

      // Select topics
      await seleccionarPrimerTema(page);

      await expect(page.locator('[data-testid="generar-test-btn"]')).not.toBeDisabled();

      await page.locator('[data-testid="generar-test-btn"]').click();

      // Confirm dialog
      await expect(page.locator('.p-confirm-dialog').first()).toBeVisible({ timeout: 5_000 });
      await page.locator('.p-confirm-dialog-accept').click();

      // Should navigate to the test execution page
      await expect(page).toHaveURL(/realizar-test\/\d+/, { timeout: 10_000 });
      await expect(page.locator('[data-testid="pregunta-card"]')).toBeVisible({ timeout: 10_000 });
    });
  });

  test.describe('Test de Examen (con cronómetro)', () => {
    test('debería mostrar campo de tiempo cuando se activa modo examen', async ({ page }) => {
      await page.locator('[data-testid="test-examen-switch"]').click();
      await expect(page.locator('[data-testid="tiempo-limite-input"]')).toBeVisible();
    });

    test('el botón queda deshabilitado si se activa examen sin tiempo', async ({ page }) => {
      // Select a topic so the only blocker is the missing time
      await seleccionarPrimerTema(page);

      await page.locator('[data-testid="test-examen-switch"]').click();
      await expect(page.locator('[data-testid="generar-test-btn"]')).toBeDisabled();

      // Enter time limit → button becomes enabled
      await page.locator('[data-testid="tiempo-limite-input"]').fill('60');
      await expect(page.locator('[data-testid="generar-test-btn"]')).not.toBeDisabled();
    });
  });

  test.describe('Tests Pendientes', () => {
    test('no muestra sección de pendientes cuando no hay tests en curso', async ({ page }) => {
      // setupTestGenerarInterceptors devuelve GET /tests → [] (array vacío); el
      // contenedor existe pero sin items de test pendiente.
      await expect(page.locator('[data-testid="test-pendiente"]')).toHaveCount(0);
    });

    test('muestra tests pendientes cuando los hay', async ({ page }) => {
      // Override GET /tests (getAllTest) con un test pendiente en la lista.
      await page.route(/\/tests(\?.*)?$/, (route) =>
        route.request().method() === 'GET'
          ? route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify([
                {
                  id: 999,
                  status: 'EMPEZADO',
                  createdAt: new Date().toISOString(),
                  respuestasCount: 2,
                  testPreguntasCount: 10,
                  preguntas: [],
                  respuestas: [],
                },
              ]),
            })
          : route.continue()
      );

      await page.reload();
      await expect(page.locator('[data-testid="realizar-test-container"]')).toBeVisible({ timeout: 15_000 });
      await expect(page.locator('[data-testid="tests-pendientes-container"]')).toBeVisible({ timeout: 5_000 });
      await expect(page.locator('[data-testid="test-pendiente"]')).toBeVisible();
      await expect(page.locator('[data-testid="continuar-test-btn"]')).toBeVisible();
    });

    test('abortar un test pendiente lo elimina de la lista', async ({ page }) => {
      let aborted = false;
      await page.route(/\/tests(\?.*)?$/, (route) => {
        if (route.request().method() !== 'GET') return route.continue();
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(
            aborted
              ? []
              : [{ id: 999, status: 'EMPEZADO', createdAt: new Date().toISOString(), respuestasCount: 2, testPreguntasCount: 10, preguntas: [], respuestas: [] }]
          ),
        });
      });
      await page.route('**/tests/999', (route) => {
        if (route.request().method() === 'DELETE') aborted = true;
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
      });

      await page.reload();
      await expect(page.locator('[data-testid="tests-pendientes-container"]')).toBeVisible({ timeout: 15_000 });

      await page.locator('[data-testid="abortar-test-btn"]').first().click();

      await expect(page.locator('.p-confirm-dialog')).toBeVisible({ timeout: 3_000 });
      await page.locator('.p-confirm-dialog-accept').click();

      await expect(page.locator('[data-testid="test-pendiente"]')).not.toBeVisible({ timeout: 5_000 });
    });
  });

  test.describe('Ejecución de preguntas', () => {
    test.beforeEach(async ({ page }) => {
      // Create a test first via helper flow
      await seleccionarPrimerTema(page);

      await page.locator('[data-testid="generar-test-btn"]').click();
      await expect(page.locator('.p-confirm-dialog').first()).toBeVisible({ timeout: 5_000 });
      await page.locator('.p-confirm-dialog-accept').click();

      await expect(page.locator('[data-testid="pregunta-card"]')).toBeVisible({ timeout: 10_000 });
    });

    test('muestra la interfaz de pregunta correctamente', async ({ page }) => {
      await expect(page.locator('[data-testid="pregunta-identificador"]')).toBeVisible();
      await expect(page.locator('[data-testid="numero-pregunta"]')).toBeVisible();
      await expect(page.locator('[data-testid="enunciado-pregunta"]')).toBeVisible();
      await expect(page.locator('[data-testid="opcion-respuesta"]')).toHaveCount(4);
    });

    test('permite seleccionar una respuesta', async ({ page }) => {
      await page.locator('[data-testid="opcion-respuesta"]').first().click();
      await page.waitForResponse('**/tests/registrar-respuesta');

      await expect(page.locator('[data-testid="continuar-btn"]')).toBeVisible();
    });

    test('permite omitir preguntas', async ({ page }) => {
      await page.locator('[data-testid="omitir-pregunta-btn"]').click();
      await page.waitForResponse('**/tests/registrar-respuesta');

      await expect(page.locator('[data-testid="numero-pregunta"]')).toContainText('2');
    });
  });
});
