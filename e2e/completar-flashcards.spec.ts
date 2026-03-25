import { expect, test } from '@playwright/test';
import { loginAsAlumnoMock } from './helpers/auth.helper';
import { setupFlashcardInterceptors } from './helpers/interceptors.helper';

test.describe('Completar Flashcards (Alumno)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAlumnoMock(page);
    await setupFlashcardInterceptors(page);
  });

  test('muestra la cara frontal de la primera flashcard', async ({ page }) => {
    await page.goto('/app/test/alumno/realizar-flash-cards-test/1');

    // Wait for the flashcard view to load
    await expect(page.locator('[data-testid="flashcard-container"], app-completar-flash-card-test')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('[data-testid="flashcard-pregunta"], [data-testid="flashcard-descripcion"]')).toBeVisible();
  });

  test('clic en "Ver solución" muestra la cara trasera', async ({ page }) => {
    await page.goto('/app/test/alumno/realizar-flash-cards-test/1');
    await expect(page.locator('[data-testid="flashcard-container"], app-completar-flash-card-test')).toBeVisible({ timeout: 10_000 });

    const verSolucionBtn = page.locator('[data-testid="ver-solucion-btn"]');
    await expect(verSolucionBtn).toBeVisible();
    await verSolucionBtn.click();

    await expect(page.locator('[data-testid="flashcard-solucion"]')).toBeVisible();
  });

  test('tecla Space muestra la solución', async ({ page }) => {
    await page.goto('/app/test/alumno/realizar-flash-cards-test/1');
    await expect(page.locator('[data-testid="flashcard-container"], app-completar-flash-card-test')).toBeVisible({ timeout: 10_000 });

    await page.keyboard.press('Space');
    await expect(page.locator('[data-testid="flashcard-solucion"]')).toBeVisible({ timeout: 3_000 });
  });

  test('marcar como BIEN llama a registrar-respuesta con estado BIEN', async ({ page }) => {
    await page.goto('/app/test/alumno/realizar-flash-cards-test/1');
    await expect(page.locator('[data-testid="flashcard-container"], app-completar-flash-card-test')).toBeVisible({ timeout: 10_000 });

    let requestBody: unknown = null;
    page.on('request', (req) => {
      if (req.url().includes('flashcards/registrar-respuesta') && req.method() === 'POST') {
        requestBody = req.postDataJSON();
      }
    });

    // Reveal solution first
    await page.locator('[data-testid="ver-solucion-btn"]').click();
    await expect(page.locator('[data-testid="flashcard-solucion"]')).toBeVisible();

    await page.locator('[data-testid="btn-bien"]').click();
    await page.waitForResponse('**/flashcards/registrar-respuesta');

    expect(requestBody).toMatchObject({
      estado: 'BIEN',
      flashcardId: expect.any(Number),
      testId: expect.any(Number),
    });
  });

  test('marcar como MAL llama a registrar-respuesta con estado MAL', async ({ page }) => {
    await page.goto('/app/test/alumno/realizar-flash-cards-test/1');
    await expect(page.locator('[data-testid="flashcard-container"], app-completar-flash-card-test')).toBeVisible({ timeout: 10_000 });

    let requestBody: unknown = null;
    page.on('request', (req) => {
      if (req.url().includes('flashcards/registrar-respuesta')) {
        requestBody = req.postDataJSON();
      }
    });

    await page.locator('[data-testid="ver-solucion-btn"]').click();
    await page.locator('[data-testid="btn-mal"]').click();
    await page.waitForResponse('**/flashcards/registrar-respuesta');

    expect(requestBody).toMatchObject({ estado: 'MAL' });
  });

  test('marcar como REVISAR llama a registrar-respuesta con estado REVISAR', async ({ page }) => {
    await page.goto('/app/test/alumno/realizar-flash-cards-test/1');
    await expect(page.locator('[data-testid="flashcard-container"], app-completar-flash-card-test')).toBeVisible({ timeout: 10_000 });

    let requestBody: unknown = null;
    page.on('request', (req) => {
      if (req.url().includes('flashcards/registrar-respuesta')) {
        requestBody = req.postDataJSON();
      }
    });

    await page.locator('[data-testid="ver-solucion-btn"]').click();
    await page.locator('[data-testid="btn-revisar"]').click();
    await page.waitForResponse('**/flashcards/registrar-respuesta');

    expect(requestBody).toMatchObject({ estado: 'REVISAR' });
  });

  test('tecla ArrowRight equivale a marcar BIEN', async ({ page }) => {
    await page.goto('/app/test/alumno/realizar-flash-cards-test/1');
    await expect(page.locator('[data-testid="flashcard-container"], app-completar-flash-card-test')).toBeVisible({ timeout: 10_000 });

    let requestBody: unknown = null;
    page.on('request', (req) => {
      if (req.url().includes('flashcards/registrar-respuesta')) {
        requestBody = req.postDataJSON();
      }
    });

    // Reveal solution before using keyboard shortcut
    await page.locator('[data-testid="ver-solucion-btn"]').click();
    await expect(page.locator('[data-testid="flashcard-solucion"]')).toBeVisible();

    await page.keyboard.press('ArrowRight');
    await page.waitForResponse('**/flashcards/registrar-respuesta');

    expect(requestBody).toMatchObject({ estado: 'BIEN' });
  });

  test('tecla ArrowLeft equivale a marcar MAL', async ({ page }) => {
    await page.goto('/app/test/alumno/realizar-flash-cards-test/1');
    await expect(page.locator('[data-testid="flashcard-container"], app-completar-flash-card-test')).toBeVisible({ timeout: 10_000 });

    let requestBody: unknown = null;
    page.on('request', (req) => {
      if (req.url().includes('flashcards/registrar-respuesta')) {
        requestBody = req.postDataJSON();
      }
    });

    await page.locator('[data-testid="ver-solucion-btn"]').click();
    await page.keyboard.press('ArrowLeft');
    await page.waitForResponse('**/flashcards/registrar-respuesta');

    expect(requestBody).toMatchObject({ estado: 'MAL' });
  });

  test('al completar la última flashcard redirige a stats', async ({ page }) => {
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
    await expect(page.locator('[data-testid="flashcard-container"], app-completar-flash-card-test')).toBeVisible({ timeout: 10_000 });

    await page.locator('[data-testid="ver-solucion-btn"]').click();
    await page.locator('[data-testid="btn-bien"]').click();
    await page.waitForResponse('**/flashcards/registrar-respuesta');

    // After the last card is answered, the component navigates to stats
    await expect(page).toHaveURL(/stats-test-flashcard\/1/, { timeout: 8_000 });
  });
});
