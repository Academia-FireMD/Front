import { expect, test, type Locator, type Page } from '@playwright/test';
import { loginAsAlumnoMock } from './helpers/auth.helper';
import { setupTestPracticaInterceptors } from './helpers/interceptors.helper';
import testGeneradoFixture from './fixtures/test-generado.json';

const OVERSIZED_MARKDOWN_IMAGE_PATH = '/__e2e__/oversized-markdown-image.svg';
const OVERSIZED_MARKDOWN_IMAGE =
  '<svg xmlns="http://www.w3.org/2000/svg" width="2400" height="1200" viewBox="0 0 2400 1200"><rect width="2400" height="1200" fill="#004e89"/><text x="80" y="180" font-size="120" fill="#fff">Imagen markdown de prueba</text></svg>';
const OVERSIZED_TEST_FIXTURE = {
  ...testGeneradoFixture,
  preguntas: testGeneradoFixture.preguntas.map((pregunta) => ({
    ...pregunta,
    descripcion: `![Imagen de prueba](${OVERSIZED_MARKDOWN_IMAGE_PATH})`,
    solucion: `![Imagen de prueba](${OVERSIZED_MARKDOWN_IMAGE_PATH})`,
  })),
};

async function serveOversizedMarkdownImage(page: Page): Promise<void> {
  await page.route(`**${OVERSIZED_MARKDOWN_IMAGE_PATH}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'image/svg+xml',
      body: OVERSIZED_MARKDOWN_IMAGE,
    }),
  );
}

async function assertMarkdownImageFits(image: Locator): Promise<void> {
  await expect(image).toBeVisible();
  const dimensions = await image.evaluate((element) => {
    const host = element.closest('.markdown-images');
    const container = host?.parentElement;
    if (!host || !container) {
      throw new Error('La imagen markdown no está dentro de su contenedor');
    }
    return {
      imageWidth: element.getBoundingClientRect().width,
      containerWidth: container.getBoundingClientRect().width,
    };
  });
  expect(dimensions.imageWidth).toBeLessThanOrEqual(
    dimensions.containerWidth + 1,
  );
}

test.describe('Completar Test de Práctica (Alumno)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAlumnoMock(page);
    await setupTestPracticaInterceptors(
      page,
      OVERSIZED_TEST_FIXTURE as typeof testGeneradoFixture,
    );
    await serveOversizedMarkdownImage(page);
  });

  test('muestra la primera pregunta con sus opciones de respuesta', async ({
    page,
  }) => {
    await page.goto('/app/test/alumno/realizar-test/123');

    await expect(page.locator('[data-testid="pregunta-card"]')).toBeVisible({
      timeout: 10_000,
    });
    await expect(
      page.locator('[data-testid="pregunta-identificador"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="enunciado-pregunta"]'),
    ).toBeVisible();

    const opciones = page.locator('[data-testid="opcion-respuesta"]');
    await expect(opciones).toHaveCount(4);
  });

  test('limita las imágenes markdown de pregunta y solución al contenedor', async ({
    page,
  }) => {
    await page.goto('/app/test/alumno/realizar-test/123');
    await expect(page.locator('[data-testid="pregunta-card"]')).toBeVisible({
      timeout: 10_000,
    });

    await assertMarkdownImageFits(
      page.locator('[data-testid="enunciado-pregunta"] .markdown-images img'),
    );

    await Promise.all([
      page.waitForResponse('**/tests/registrar-respuesta'),
      page.locator('[data-testid="opcion-respuesta"]').first().click(),
    ]);
    await expect(
      page.locator('[data-testid="solucion-container"]'),
    ).toBeVisible();
    await assertMarkdownImageFits(
      page.locator('[data-testid="solucion-texto"] .markdown-images img'),
    );
  });

  test('seleccionar una respuesta llama a registrar-respuesta con los datos correctos', async ({
    page,
  }) => {
    await page.goto('/app/test/alumno/realizar-test/123');
    await expect(page.locator('[data-testid="pregunta-card"]')).toBeVisible({
      timeout: 10_000,
    });

    const requests: { body: unknown }[] = [];
    page.on('request', (req) => {
      if (
        req.url().includes('tests/registrar-respuesta') &&
        req.method() === 'POST'
      ) {
        requests.push({ body: req.postDataJSON() });
      }
    });

    await Promise.all([
      page.waitForResponse('**/tests/registrar-respuesta'),
      page.locator('[data-testid="opcion-respuesta"]').first().click(),
    ]);

    expect(requests).toHaveLength(1);
    expect(requests[0].body).toMatchObject({
      testId: 123,
      preguntaId: expect.any(Number),
      respuestaDada: 0,
    });
  });

  test('no permite seleccionar otra respuesta cuando la pregunta ya fue respondida (idempotencia)', async ({
    page,
  }) => {
    await page.goto('/app/test/alumno/realizar-test/123');
    await expect(page.locator('[data-testid="pregunta-card"]')).toBeVisible({
      timeout: 10_000,
    });

    let callCount = 0;
    page.on('request', (req) => {
      if (req.url().includes('tests/registrar-respuesta')) callCount++;
    });

    // First click — should register answer
    await Promise.all([
      page.waitForResponse('**/tests/registrar-respuesta'),
      page.locator('[data-testid="opcion-respuesta"]').first().click(),
    ]);

    // Second click on a different option — should NOT register again (non-exam mode)
    await page.locator('[data-testid="opcion-respuesta"]').nth(1).click();
    await page.waitForTimeout(500);

    expect(callCount).toBe(1);
  });

  test('omitir una pregunta llama a registrar-respuesta con omitida: true', async ({
    page,
  }) => {
    await page.goto('/app/test/alumno/realizar-test/123');
    await expect(page.locator('[data-testid="pregunta-card"]')).toBeVisible({
      timeout: 10_000,
    });

    let omitidaBody: unknown = null;
    page.on('request', (req) => {
      if (
        req.url().includes('tests/registrar-respuesta') &&
        req.method() === 'POST'
      ) {
        omitidaBody = req.postDataJSON();
      }
    });

    await Promise.all([
      page.waitForResponse('**/tests/registrar-respuesta'),
      page.locator('[data-testid="omitir-pregunta-btn"]').click(),
    ]);

    expect(omitidaBody).toMatchObject({ omitida: true });
  });

  test('navegar entre preguntas actualiza el indicador de pregunta actual', async ({
    page,
  }) => {
    await page.goto('/app/test/alumno/realizar-test/123');
    await expect(page.locator('[data-testid="pregunta-card"]')).toBeVisible({
      timeout: 10_000,
    });

    await expect(page.locator('[data-testid="numero-pregunta"]')).toContainText(
      '1',
    );

    // Answer and continue
    await Promise.all([
      page.waitForResponse('**/tests/registrar-respuesta'),
      page.locator('[data-testid="opcion-respuesta"]').first().click(),
    ]);
    await page.locator('[data-testid="continuar-btn"]').click();

    await expect(page.locator('[data-testid="numero-pregunta"]')).toContainText(
      '2',
    );

    // Go back
    await page.locator('[data-testid="anterior-pregunta-btn"]').click();
    await expect(page.locator('[data-testid="numero-pregunta"]')).toContainText(
      '1',
    );
  });

  test('finalizar test llama a finalizar-test y redirige a stats', async ({
    page,
  }) => {
    await page.goto('/app/test/alumno/realizar-test/123');
    await expect(page.locator('[data-testid="pregunta-card"]')).toBeVisible({
      timeout: 10_000,
    });

    let finalizarCalled = false;
    page.on('request', (req) => {
      if (req.url().includes('tests/finalizar-test')) finalizarCalled = true;
    });

    await Promise.all([
      page.waitForResponse('**/tests/finalizar-test/**'),
      page.locator('[data-testid="finalizar-test-btn"]').click(),
    ]);

    expect(finalizarCalled).toBe(true);
    await expect(page).toHaveURL(/stats-test\/123/, { timeout: 10_000 });
  });

  test('en modo examen NO muestra la solución al responder', async ({
    page,
  }) => {
    await setupTestPracticaInterceptors(page, {
      ...require('./fixtures/test-examen.json'),
    } as any);

    await page.goto('/app/test/alumno/realizar-test/456');
    await expect(page.locator('[data-testid="pregunta-card"]')).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.locator('[data-testid="cronometro"]')).toBeVisible();

    await Promise.all([
      page.waitForResponse('**/tests/registrar-respuesta'),
      page.locator('[data-testid="opcion-respuesta"]').first().click(),
    ]);

    // In exam mode the solution container should NOT be visible immediately
    await expect(
      page.locator('[data-testid="solucion-container"]'),
    ).not.toBeVisible();
  });

  test('error del servidor muestra un toast de error sin romper la UI', async ({
    page,
  }) => {
    // Override registrar-respuesta to return 500
    await page.route('**/tests/registrar-respuesta', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Internal server error' }),
      }),
    );

    await page.goto('/app/test/alumno/realizar-test/123');
    await expect(page.locator('[data-testid="pregunta-card"]')).toBeVisible({
      timeout: 10_000,
    });

    await Promise.all([
      page.waitForResponse('**/tests/registrar-respuesta'),
      page.locator('[data-testid="opcion-respuesta"]').first().click(),
    ]);

    // Toast error should appear
    await expect(
      page
        .locator('.toast-error, [class*="ngx-toastr"][class*="error"]')
        .first(),
    ).toBeVisible({ timeout: 5_000 });

    // The question card must still be present (UI not broken)
    await expect(page.locator('[data-testid="pregunta-card"]')).toBeVisible();
  });
});
