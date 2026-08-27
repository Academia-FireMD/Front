import { expect, test, type Locator, type Page } from '@playwright/test';
import { loginAsAlumnoMock } from './helpers/auth.helper';
import { setupFlashcardInterceptors } from './helpers/interceptors.helper';
import flashcardTestFixture from './fixtures/flashcard-test.json';

const OVERSIZED_MARKDOWN_IMAGE_PATH = '/__e2e__/oversized-markdown-image.svg';
const OVERSIZED_MARKDOWN_IMAGE =
  '<svg xmlns="http://www.w3.org/2000/svg" width="2400" height="1200" viewBox="0 0 2400 1200"><rect width="2400" height="1200" fill="#ff6b35"/><text x="80" y="180" font-size="120" fill="#fff">Imagen markdown de prueba</text></svg>';
const OVERSIZED_FLASHCARD_FIXTURE = {
  ...flashcardTestFixture,
  flashcards: flashcardTestFixture.flashcards.map((item) => ({
    ...item,
    flashcard: {
      ...item.flashcard,
      descripcion: `![Imagen de prueba](${OVERSIZED_MARKDOWN_IMAGE_PATH})`,
      solucion: `![Imagen de prueba](${OVERSIZED_MARKDOWN_IMAGE_PATH})`,
    },
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

test.describe('Completar Flashcards (Alumno)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAlumnoMock(page);
    await setupFlashcardInterceptors(
      page,
      OVERSIZED_FLASHCARD_FIXTURE as typeof flashcardTestFixture,
    );
    await serveOversizedMarkdownImage(page);
  });

  test('muestra la cara frontal de la primera flashcard', async ({ page }) => {
    await page.goto('/app/test/alumno/realizar-flash-cards-test/1');

    // Wait for the flashcard view to load
    await expect(
      page.locator('[data-testid="flashcard-container"]'),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.locator(
        '[data-testid="flashcard-pregunta"], [data-testid="flashcard-descripcion"]',
      ),
    ).toBeVisible();
  });

  test('clic en "Ver solución" muestra la cara trasera', async ({ page }) => {
    await page.goto('/app/test/alumno/realizar-flash-cards-test/1');
    await expect(
      page.locator('[data-testid="flashcard-container"]'),
    ).toBeVisible({ timeout: 10_000 });

    const verSolucionBtn = page.locator('[data-testid="ver-solucion-btn"]');
    await expect(verSolucionBtn).toBeVisible();
    await verSolucionBtn.click();

    await expect(
      page.locator('[data-testid="flashcard-solucion"]'),
    ).toBeVisible();
  });

  test('limita las imágenes markdown de descripción y solución al contenedor', async ({
    page,
  }) => {
    await page.goto('/app/test/alumno/realizar-flash-cards-test/1');
    await expect(
      page.locator('[data-testid="flashcard-container"]'),
    ).toBeVisible({ timeout: 10_000 });

    await assertMarkdownImageFits(
      page.locator(
        '[data-testid="flashcard-descripcion"] .markdown-images img',
      ),
    );

    await page.locator('[data-testid="ver-solucion-btn"]').click();
    await assertMarkdownImageFits(
      page.locator('[data-testid="flashcard-solucion"] .markdown-images img'),
    );
  });

  test('tecla Space muestra la solución', async ({ page }) => {
    await page.goto('/app/test/alumno/realizar-flash-cards-test/1');
    await expect(
      page.locator('[data-testid="flashcard-container"]'),
    ).toBeVisible({ timeout: 10_000 });

    await page.keyboard.press('Space');
    await expect(
      page.locator('[data-testid="flashcard-solucion"]'),
    ).toBeVisible({ timeout: 3_000 });
  });

  test('marcar como BIEN llama a registrar-respuesta con estado BIEN', async ({
    page,
  }) => {
    await page.goto('/app/test/alumno/realizar-flash-cards-test/1');
    await expect(
      page.locator('[data-testid="flashcard-container"]'),
    ).toBeVisible({ timeout: 10_000 });

    let requestBody: unknown = null;
    page.on('request', (req) => {
      if (
        req.url().includes('flashcards/registrar-respuesta') &&
        req.method() === 'POST'
      ) {
        requestBody = req.postDataJSON();
      }
    });

    // Reveal solution first
    await page.locator('[data-testid="ver-solucion-btn"]').click();
    await expect(
      page.locator('[data-testid="flashcard-solucion"]'),
    ).toBeVisible();

    await Promise.all([
      page.waitForResponse('**/flashcards/registrar-respuesta'),
      page.locator('[data-testid="btn-bien"]').click(),
    ]);

    expect(requestBody).toMatchObject({
      estado: 'BIEN',
      flashcardId: expect.any(Number),
      testId: expect.any(Number),
    });
  });

  test('marcar como MAL llama a registrar-respuesta con estado MAL', async ({
    page,
  }) => {
    await page.goto('/app/test/alumno/realizar-flash-cards-test/1');
    await expect(
      page.locator('[data-testid="flashcard-container"]'),
    ).toBeVisible({ timeout: 10_000 });

    let requestBody: unknown = null;
    page.on('request', (req) => {
      if (req.url().includes('flashcards/registrar-respuesta')) {
        requestBody = req.postDataJSON();
      }
    });

    await page.locator('[data-testid="ver-solucion-btn"]').click();
    await Promise.all([
      page.waitForResponse('**/flashcards/registrar-respuesta'),
      page.locator('[data-testid="btn-mal"]').click(),
    ]);

    expect(requestBody).toMatchObject({ estado: 'MAL' });
  });

  test('marcar como REVISAR llama a registrar-respuesta con estado REVISAR', async ({
    page,
  }) => {
    await page.goto('/app/test/alumno/realizar-flash-cards-test/1');
    await expect(
      page.locator('[data-testid="flashcard-container"]'),
    ).toBeVisible({ timeout: 10_000 });

    let requestBody: unknown = null;
    page.on('request', (req) => {
      if (req.url().includes('flashcards/registrar-respuesta')) {
        requestBody = req.postDataJSON();
      }
    });

    await page.locator('[data-testid="ver-solucion-btn"]').click();
    await Promise.all([
      page.waitForResponse('**/flashcards/registrar-respuesta'),
      page.locator('[data-testid="btn-revisar"]').click(),
    ]);

    expect(requestBody).toMatchObject({ estado: 'REVISAR' });
  });

  test('tecla ArrowRight equivale a marcar BIEN', async ({ page }) => {
    await page.goto('/app/test/alumno/realizar-flash-cards-test/1');
    await expect(
      page.locator('[data-testid="flashcard-container"]'),
    ).toBeVisible({ timeout: 10_000 });

    let requestBody: unknown = null;
    page.on('request', (req) => {
      if (req.url().includes('flashcards/registrar-respuesta')) {
        requestBody = req.postDataJSON();
      }
    });

    // Reveal solution before using keyboard shortcut
    await page.locator('[data-testid="ver-solucion-btn"]').click();
    await expect(
      page.locator('[data-testid="flashcard-solucion"]'),
    ).toBeVisible();

    await Promise.all([
      page.waitForResponse('**/flashcards/registrar-respuesta'),
      page.keyboard.press('ArrowRight'),
    ]);

    expect(requestBody).toMatchObject({ estado: 'BIEN' });
  });

  test('tecla ArrowLeft equivale a marcar MAL', async ({ page }) => {
    await page.goto('/app/test/alumno/realizar-flash-cards-test/1');
    await expect(
      page.locator('[data-testid="flashcard-container"]'),
    ).toBeVisible({ timeout: 10_000 });

    let requestBody: unknown = null;
    page.on('request', (req) => {
      if (req.url().includes('flashcards/registrar-respuesta')) {
        requestBody = req.postDataJSON();
      }
    });

    await page.locator('[data-testid="ver-solucion-btn"]').click();
    await Promise.all([
      page.waitForResponse('**/flashcards/registrar-respuesta'),
      page.keyboard.press('ArrowLeft'),
    ]);

    expect(requestBody).toMatchObject({ estado: 'MAL' });
  });

  test('al completar la última flashcard redirige a stats', async ({
    page,
  }) => {
    // Use a single-item flashcard test to make the "last card" scenario simple
    const singleCardFixture = {
      id: 1,
      usuarioId: 1,
      status: 'EMPEZADO',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      flashcards: [
        {
          id: 101,
          flashcardId: 201,
          testId: 1,
          respuesta: [],
          mostrarSolucion: false,
          createdAt: new Date().toISOString(),
          flashcard: {
            id: 201,
            identificador: 'FC-001',
            descripcion: 'Pregunta única',
            solucion: 'Solución única',
            dificultad: 'BASICO',
            temaId: 1,
            relevancia: [],
            tema: { id: 1, numero: 1, descripcion: 'Tema' },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            ReporteFallo: [],
          },
        },
      ],
    };

    await setupFlashcardInterceptors(page, singleCardFixture as any);

    await page.goto('/app/test/alumno/realizar-flash-cards-test/1');
    await expect(
      page.locator('[data-testid="flashcard-container"]'),
    ).toBeVisible({ timeout: 10_000 });

    await page.locator('[data-testid="ver-solucion-btn"]').click();
    await Promise.all([
      page.waitForResponse('**/flashcards/registrar-respuesta'),
      page.locator('[data-testid="btn-bien"]').click(),
    ]);

    // After the last card is answered, the component navigates to stats
    await expect(page).toHaveURL(/stats-test-flashcard\/1/, { timeout: 8_000 });
  });
});
