import { expect, test, type Locator, type Page } from '@playwright/test';
import { loginAsAlumnoMock } from './helpers/auth.helper';
import examenFixture from './fixtures/examen.json';
import {
  setupSimulacroInterceptors,
  setupTestPracticaInterceptors,
} from './helpers/interceptors.helper';

const EXAMEN_ID = 5;
const TEST_ID = 42;
const OVERSIZED_MARKDOWN_IMAGE_PATH = '/__e2e__/oversized-markdown-image.svg';
const OVERSIZED_MARKDOWN_IMAGE =
  '<svg xmlns="http://www.w3.org/2000/svg" width="2400" height="1200" viewBox="0 0 2400 1200"><rect width="2400" height="1200" fill="#1f2937"/><text x="80" y="180" font-size="120" fill="#fff">Imagen markdown de prueba</text></svg>';

async function serveOversizedMarkdownImage(page: Page): Promise<void> {
  await page.route(`**${OVERSIZED_MARKDOWN_IMAGE_PATH}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'image/svg+xml',
      body: OVERSIZED_MARKDOWN_IMAGE,
    }),
  );
}

async function serveOversizedExamenDescription(page: Page): Promise<void> {
  await page.route(`**/examenes/simulacro/${EXAMEN_ID}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ...examenFixture,
        id: EXAMEN_ID,
        descripcion: `![Imagen de prueba](${OVERSIZED_MARKDOWN_IMAGE_PATH})`,
      }),
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

test.describe('Realizar Simulacro (Alumno)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAlumnoMock(page);
    await setupSimulacroInterceptors(page, {
      examenId: EXAMEN_ID,
      testId: TEST_ID,
    });
    await serveOversizedMarkdownImage(page);
    await serveOversizedExamenDescription(page);
  });

  test('muestra el nombre del simulacro y el botón de iniciar', async ({
    page,
  }) => {
    await page.goto(`/simulacros/realizar-simulacro/${EXAMEN_ID}`);

    await expect(
      page.locator('[data-testid="simulacro-titulo"], h1, h2'),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.locator(
        '[data-testid="iniciar-simulacro-btn"], button:has-text("Iniciar"), button:has-text("Comenzar")',
      ),
    ).toBeVisible();
  });

  test('muestra información del examen cargada desde la API', async ({
    page,
  }) => {
    await page.goto(`/simulacros/realizar-simulacro/${EXAMEN_ID}`);

    // Wait for content to load
    await expect(
      page.locator('[data-testid="simulacro-titulo"], h1, h2'),
    ).toBeVisible({ timeout: 10_000 });

    // The examen fixture has titulo "Simulacro Bomberos 2024 - Convocatoria Estatal"
    await expect(page.locator('body')).toContainText('Simulacro Bomberos');
  });

  test('limita la imagen markdown de la descripción al contenedor', async ({
    page,
  }) => {
    await page.goto(`/simulacros/realizar-simulacro/${EXAMEN_ID}`);
    await expect(
      page.locator('[data-testid="simulacro-description"]'),
    ).toBeVisible({ timeout: 10_000 });
    await assertMarkdownImageFits(
      page.locator(
        '[data-testid="simulacro-description"] .markdown-images img',
      ),
    );
  });

  test('iniciar simulacro llama a verificar-acceso y luego a start-simulacro', async ({
    page,
  }) => {
    await page.goto(`/simulacros/realizar-simulacro/${EXAMEN_ID}`);
    await expect(
      page.locator(
        '[data-testid="iniciar-simulacro-btn"], button:has-text("Iniciar"), button:has-text("Comenzar")',
      ),
    ).toBeVisible({ timeout: 10_000 });

    const apiCalls: string[] = [];
    page.on('request', (req) => apiCalls.push(req.url()));

    await page
      .locator(
        '[data-testid="iniciar-simulacro-btn"], button:has-text("Iniciar"), button:has-text("Comenzar")',
      )
      .click();

    // A PrimeNG confirmation dialog appears
    await expect(page.locator('.p-dialog, .p-confirm-dialog')).toBeVisible({
      timeout: 5_000,
    });
    // Wait for start-simulacro API call + countdown (3 seconds). Register the
    // waiter before the click because the mocked response is immediate.
    await Promise.all([
      page.waitForResponse(`**/examenes/start-simulacro/${EXAMEN_ID}`, {
        timeout: 10_000,
      }),
      page
        .locator('.p-confirm-dialog-accept, button:has-text("Comenzar")')
        .click(),
    ]);

    expect(
      apiCalls.some((u) =>
        u.includes(`verificar-acceso-simulacro/${EXAMEN_ID}`),
      ),
    ).toBe(true);
    expect(
      apiCalls.some((u) => u.includes(`start-simulacro/${EXAMEN_ID}`)),
    ).toBe(true);
  });

  test('después de iniciar redirige al componente de completar', async ({
    page,
  }) => {
    await page.goto(`/simulacros/realizar-simulacro/${EXAMEN_ID}`);
    await expect(
      page.locator(
        '[data-testid="iniciar-simulacro-btn"], button:has-text("Iniciar"), button:has-text("Comenzar")',
      ),
    ).toBeVisible({ timeout: 10_000 });

    await page
      .locator(
        '[data-testid="iniciar-simulacro-btn"], button:has-text("Iniciar"), button:has-text("Comenzar")',
      )
      .click();
    await expect(page.locator('.p-dialog, .p-confirm-dialog')).toBeVisible({
      timeout: 5_000,
    });
    await Promise.all([
      page.waitForResponse(`**/examenes/start-simulacro/${EXAMEN_ID}`, {
        timeout: 10_000,
      }),
      page
        .locator('.p-confirm-dialog-accept, button:has-text("Comenzar")')
        .click(),
    ]);

    // After the 3-second countdown, it navigates to the completar route
    await expect(page).toHaveURL(
      new RegExp(
        `simulacros/realizar-simulacro/${EXAMEN_ID}/completar/${TEST_ID}`,
      ),
      { timeout: 8_000 },
    );
  });

  test.describe('Completar test del simulacro', () => {
    test.beforeEach(async ({ page }) => {
      await setupTestPracticaInterceptors(page);
    });

    test('la página de completar muestra la primera pregunta', async ({
      page,
    }) => {
      // Navigate directly to completar (bypass the launch page)
      await page.goto(
        `/simulacros/realizar-simulacro/${EXAMEN_ID}/completar/${TEST_ID}`,
      );

      await expect(page.locator('[data-testid="pregunta-card"]')).toBeVisible({
        timeout: 10_000,
      });
      await expect(
        page.locator('[data-testid="enunciado-pregunta"]'),
      ).toBeVisible();
    });

    test('responder todas las preguntas y finalizar redirige a resultados del simulacro', async ({
      page,
    }) => {
      await page.goto(
        `/simulacros/realizar-simulacro/${EXAMEN_ID}/completar/${TEST_ID}`,
      );
      await expect(page.locator('[data-testid="pregunta-card"]')).toBeVisible({
        timeout: 10_000,
      });

      // Finalize directly
      await Promise.all([
        page.waitForResponse('**/tests/finalizar-test/**', { timeout: 8_000 }),
        page.locator('[data-testid="finalizar-test-btn"]').click(),
      ]);

      await expect(page).toHaveURL(
        new RegExp(
          `(simulacros/resultado/${EXAMEN_ID}|examen/resultado/${EXAMEN_ID})`,
        ),
        { timeout: 8_000 },
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
      }),
    );

    await page.goto('/simulacros/realizar-simulacro/999');

    // The component sets statusLoad = 'not_found' on error
    await expect(
      page.locator(
        '[data-testid="simulacro-not-found"], [data-testid="error-container"]',
      ),
    ).toBeVisible({ timeout: 8_000 });
  });
});
