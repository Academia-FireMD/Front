import { expect, test } from '@playwright/test';
import { loginAsAlumnoMock } from './helpers/auth.helper';
import { setupTestPracticaInterceptors } from './helpers/interceptors.helper';

test.describe('Completar Test de Práctica (Alumno)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAlumnoMock(page);
    await setupTestPracticaInterceptors(page);
  });

  test('muestra la primera pregunta con sus opciones de respuesta', async ({ page }) => {
    await page.goto('/app/test/alumno/realizar-test/123');

    await expect(page.locator('[data-testid="pregunta-card"]')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('[data-testid="pregunta-identificador"]')).toBeVisible();
    await expect(page.locator('[data-testid="enunciado-pregunta"]')).toBeVisible();

    const opciones = page.locator('[data-testid="opcion-respuesta"]');
    await expect(opciones).toHaveCount(4);
  });

  test('seleccionar una respuesta llama a registrar-respuesta con los datos correctos', async ({ page }) => {
    await page.goto('/app/test/alumno/realizar-test/123');
    await expect(page.locator('[data-testid="pregunta-card"]')).toBeVisible({ timeout: 10_000 });

    const requests: { body: unknown }[] = [];
    page.on('request', (req) => {
      if (req.url().includes('tests/registrar-respuesta') && req.method() === 'POST') {
        requests.push({ body: req.postDataJSON() });
      }
    });

    await page.locator('[data-testid="opcion-respuesta"]').first().click();
    await page.waitForResponse('**/tests/registrar-respuesta');

    expect(requests).toHaveLength(1);
    expect(requests[0].body).toMatchObject({
      testId: 123,
      preguntaId: expect.any(Number),
      respuestaDada: 0,
    });
  });

  test('no permite seleccionar otra respuesta cuando la pregunta ya fue respondida (idempotencia)', async ({ page }) => {
    await page.goto('/app/test/alumno/realizar-test/123');
    await expect(page.locator('[data-testid="pregunta-card"]')).toBeVisible({ timeout: 10_000 });

    let callCount = 0;
    page.on('request', (req) => {
      if (req.url().includes('tests/registrar-respuesta')) callCount++;
    });

    // First click — should register answer
    await page.locator('[data-testid="opcion-respuesta"]').first().click();
    await page.waitForResponse('**/tests/registrar-respuesta');

    // Second click on a different option — should NOT register again (non-exam mode)
    await page.locator('[data-testid="opcion-respuesta"]').nth(1).click();
    await page.waitForTimeout(500);

    expect(callCount).toBe(1);
  });

  test('omitir una pregunta llama a registrar-respuesta con omitida: true', async ({ page }) => {
    await page.goto('/app/test/alumno/realizar-test/123');
    await expect(page.locator('[data-testid="pregunta-card"]')).toBeVisible({ timeout: 10_000 });

    let omitidaBody: unknown = null;
    page.on('request', (req) => {
      if (req.url().includes('tests/registrar-respuesta') && req.method() === 'POST') {
        omitidaBody = req.postDataJSON();
      }
    });

    await page.locator('[data-testid="omitir-pregunta-btn"]').click();
    await page.waitForResponse('**/tests/registrar-respuesta');

    expect(omitidaBody).toMatchObject({ omitida: true });
  });

  test('navegar entre preguntas actualiza el indicador de pregunta actual', async ({ page }) => {
    await page.goto('/app/test/alumno/realizar-test/123');
    await expect(page.locator('[data-testid="pregunta-card"]')).toBeVisible({ timeout: 10_000 });

    await expect(page.locator('[data-testid="numero-pregunta"]')).toContainText('1');

    // Answer and continue
    await page.locator('[data-testid="opcion-respuesta"]').first().click();
    await page.waitForResponse('**/tests/registrar-respuesta');
    await page.locator('[data-testid="continuar-btn"]').click();

    await expect(page.locator('[data-testid="numero-pregunta"]')).toContainText('2');

    // Go back
    await page.locator('[data-testid="anterior-pregunta-btn"]').click();
    await expect(page.locator('[data-testid="numero-pregunta"]')).toContainText('1');
  });

  test('finalizar test llama a finalizar-test y redirige a stats', async ({ page }) => {
    await page.goto('/app/test/alumno/realizar-test/123');
    await expect(page.locator('[data-testid="pregunta-card"]')).toBeVisible({ timeout: 10_000 });

    let finalizarCalled = false;
    page.on('request', (req) => {
      if (req.url().includes('tests/finalizar-test')) finalizarCalled = true;
    });

    await page.locator('[data-testid="finalizar-test-btn"]').click();
    await page.waitForResponse('**/tests/finalizar-test/**');

    expect(finalizarCalled).toBe(true);
    await expect(page).toHaveURL(/stats-test\/123/, { timeout: 10_000 });
  });

  test('en modo examen NO muestra la solución al responder', async ({ page }) => {
    await setupTestPracticaInterceptors(page, {
      ...require('./fixtures/test-examen.json'),
    } as any);

    await page.goto('/app/test/alumno/realizar-test/456');
    await expect(page.locator('[data-testid="pregunta-card"]')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('[data-testid="cronometro"]')).toBeVisible();

    await page.locator('[data-testid="opcion-respuesta"]').first().click();
    await page.waitForResponse('**/tests/registrar-respuesta');

    // In exam mode the solution container should NOT be visible immediately
    await expect(page.locator('[data-testid="solucion-container"]')).not.toBeVisible();
  });

  test('error del servidor muestra un toast de error sin romper la UI', async ({ page }) => {
    // Override registrar-respuesta to return 500
    await page.route('**/tests/registrar-respuesta', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Internal server error' }) })
    );

    await page.goto('/app/test/alumno/realizar-test/123');
    await expect(page.locator('[data-testid="pregunta-card"]')).toBeVisible({ timeout: 10_000 });

    await page.locator('[data-testid="opcion-respuesta"]').first().click();
    await page.waitForResponse('**/tests/registrar-respuesta');

    // Toast error should appear
    await expect(page.locator('.toast-error, [class*="ngx-toastr"][class*="error"]')).toBeVisible({ timeout: 5_000 });

    // The question card must still be present (UI not broken)
    await expect(page.locator('[data-testid="pregunta-card"]')).toBeVisible();
  });
});
