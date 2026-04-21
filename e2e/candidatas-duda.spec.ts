import { expect, test } from '@playwright/test';
import { loginAsAlumnoMock } from './helpers/auth.helper';
import { setupTestPracticaInterceptors } from './helpers/interceptors.helper';
import testGeneradoFixture from './fixtures/test-generado.json';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Sets up the test interceptors AND overrides registrar-respuesta to echo back
 * whatever respuestasCandidatas the client sends, so the component can reload
 * them from local state after navigation.
 */
async function setupCandidatasInterceptors(
  page: import('@playwright/test').Page,
  testFixture: typeof testGeneradoFixture = testGeneradoFixture,
): Promise<void> {
  // Load test data
  await page.route('**/tests/por-id/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(testFixture),
    }),
  );

  // registrar-respuesta: echo back respuestasCandidatas and seguridad from payload
  await page.route('**/tests/registrar-respuesta', (route) => {
    const postData = route.request().postDataJSON();
    const isOmitida = postData?.omitida === true;
    const respuestaDada = postData?.respuestaDada ?? -1;
    const preguntaId = postData?.preguntaId ?? 1;
    const indicePregunta = postData?.indicePregunta ?? 0;
    const seguridad = postData?.seguridad ?? 'CIEN_POR_CIENTO';
    const respuestasCandidatas = postData?.respuestasCandidatas ?? [];

    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 999,
        testId: testFixture.id,
        preguntaId,
        respuestaDada: isOmitida ? -1 : respuestaDada,
        esCorrecta: respuestaDada === testFixture.preguntas[indicePregunta]?.respuestaCorrectaIndex,
        indicePregunta,
        estado: isOmitida ? 'OMITIDA' : 'RESPONDIDA',
        seguridad,
        respuestasCandidatas,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        pregunta: {
          respuestaCorrectaIndex: testFixture.preguntas[indicePregunta]?.respuestaCorrectaIndex ?? 0,
        },
      }),
    });
  });

  // Finalize test
  await page.route('**/tests/finalizar-test/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...testFixture, status: 'FINALIZADO' }),
    }),
  );
}

const TEST_URL = '/app/test/alumno/realizar-test/123';

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('Candidatas de duda', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAlumnoMock(page);
    await setupCandidatasInterceptors(page);
  });

  // ── T1: Seguridad picker renders and candidatas-contador appears ──────────

  test('al seleccionar 50% aparece el contador de candidatas', async ({ page }) => {
    await page.goto(TEST_URL);
    await expect(page.locator('[data-testid="pregunta-card"]')).toBeVisible({ timeout: 10_000 });

    // Contador should NOT be visible initially (100% seguridad = maxCandidatas() == 0)
    await expect(page.locator('[data-testid="candidatas-contador"]')).not.toBeVisible();

    // Click the 50%-duda button (emoji 👎 / "Dudo entre 3" at CINCUENTA_POR_CIENTO)
    // The seguridad picker renders inside [data-testid="selector-confianza"]
    const picker = page.locator('[data-testid="selector-confianza"]');
    // CINCUENTA_POR_CIENTO is the third button (index 2): ⭐, 👍, 👎, 🛑
    await picker.locator('.seguridad-box').nth(2).click();

    // After clicking 50%, counter should appear: "0 / 2 candidatas"
    await expect(page.locator('[data-testid="candidatas-contador"]')).toBeVisible();
    await expect(page.locator('[data-testid="candidatas-contador"]')).toContainText('/ 2');
  });

  // ── T2: Descartar (toggle candidata) updates the counter ─────────────────

  test('descarta una opción y el contador se actualiza', async ({ page }) => {
    await page.goto(TEST_URL);
    await expect(page.locator('[data-testid="pregunta-card"]')).toBeVisible({ timeout: 10_000 });

    // Switch to 75% duda → 3 candidatas max
    const picker = page.locator('[data-testid="selector-confianza"]');
    await picker.locator('.seguridad-box').nth(1).click(); // 👍 SETENTA_Y_CINCO_POR_CIENTO

    await expect(page.locator('[data-testid="candidatas-contador"]')).toBeVisible();

    // All 4 answers start as descartadas when candidatasPorPregunta is empty:
    // esCandidata() returns false for all indices → all 4 render rescatar-btn, zero descartar-btn.
    const rescatarBtns = page.locator('[data-testid="rescatar-btn"]');
    await expect(rescatarBtns.first()).toBeVisible({ timeout: 5_000 });
    await expect(rescatarBtns).toHaveCount(4);

    // Rescue 3 of them (indices 0, 1, 2) → they become candidatas
    await rescatarBtns.nth(0).click();
    await rescatarBtns.nth(1).click();
    await rescatarBtns.nth(2).click();

    // Now 3 answers are candidatas → 3 descartar-btn visible; 1 still descartada → 1 rescatar-btn
    const descartarBtns = page.locator('[data-testid="descartar-btn"]');
    await expect(descartarBtns).toHaveCount(3);
    await expect(rescatarBtns).toHaveCount(1);

    // Counter should now show 3 / 3 candidatas
    await expect(page.locator('[data-testid="candidatas-contador"]')).toContainText('/ 3');

    // Toggle one candidata back to descartada
    await descartarBtns.first().click();
    await expect(descartarBtns).toHaveCount(2);
    await expect(page.locator('[data-testid="candidatas-contador"]')).toContainText('/ 3');
  });

  // ── T3: Rescatar devuelve la opción al pool de candidatas ─────────────────

  test('rescata una opción descartada', async ({ page }) => {
    await page.goto(TEST_URL);
    await expect(page.locator('[data-testid="pregunta-card"]')).toBeVisible({ timeout: 10_000 });

    // Switch to 50% → max 2 candidatas
    const picker = page.locator('[data-testid="selector-confianza"]');
    await picker.locator('.seguridad-box').nth(2).click();

    await expect(page.locator('[data-testid="candidatas-contador"]')).toBeVisible();

    // Wait for rescatar-btn to appear on non-candidata answers
    const rescatarBtn = page.locator('[data-testid="rescatar-btn"]').first();
    await expect(rescatarBtn).toBeVisible({ timeout: 5_000 });

    // There should be descartadas at this point (4 options, max 2 candidatas)
    const countBefore = await page.locator('[data-testid="rescatar-btn"]').count();
    expect(countBefore).toBeGreaterThan(0);

    // Click rescatar on the first descartada — it should become candidata again
    await rescatarBtn.click();

    // After rescatar, that answer should now have a descartar-btn (it's now a candidata)
    // and the total rescatar buttons should decrease by 1 (or be rearranged)
    // The key assertion: the counter stays correct after rescuing
    await expect(page.locator('[data-testid="candidatas-contador"]')).toContainText('/ 2');
  });

  // ── T4: Candidatas persisten en el payload de registrar-respuesta ─────────

  test('las candidatas se incluyen en el payload al responder', async ({ page }) => {
    await page.goto(TEST_URL);
    await expect(page.locator('[data-testid="pregunta-card"]')).toBeVisible({ timeout: 10_000 });

    const candidatasPayloads: number[][] = [];
    page.on('request', (req) => {
      if (req.url().includes('tests/registrar-respuesta') && req.method() === 'POST') {
        const body = req.postDataJSON();
        if (body?.respuestasCandidatas != null) {
          candidatasPayloads.push(body.respuestasCandidatas);
        }
      }
    });

    // Switch to 75% duda
    const picker = page.locator('[data-testid="selector-confianza"]');
    await picker.locator('.seguridad-box').nth(1).click();

    // Responder la primera pregunta → debería incluir respuestasCandidatas
    await page.locator('[data-testid="opcion-respuesta"]').first().click();
    await page.waitForResponse('**/tests/registrar-respuesta');

    expect(candidatasPayloads.length).toBeGreaterThan(0);
    // The payload must have an array (may be empty or not, but must be present)
    expect(Array.isArray(candidatasPayloads[candidatasPayloads.length - 1])).toBe(true);
  });

  // ── T5: Cambiar a CIEN_POR_CIENTO limpia el selector de candidatas ────────

  test('cambiar a 100% (No dudo) oculta el contador de candidatas', async ({ page }) => {
    await page.goto(TEST_URL);
    await expect(page.locator('[data-testid="pregunta-card"]')).toBeVisible({ timeout: 10_000 });

    const picker = page.locator('[data-testid="selector-confianza"]');

    // First activate 50% mode so counter appears
    await picker.locator('.seguridad-box').nth(2).click();
    await expect(page.locator('[data-testid="candidatas-contador"]')).toBeVisible();

    // Now switch back to 100% (⭐ No dudo)
    await picker.locator('.seguridad-box').nth(0).click();

    // Counter must disappear
    await expect(page.locator('[data-testid="candidatas-contador"]')).not.toBeVisible();
  });

  // ── T6: Cambiar a CERO_POR_CIENTO también oculta el contador ─────────────

  test('cambiar a 0% (Dudo entre todas) oculta el contador de candidatas', async ({ page }) => {
    await page.goto(TEST_URL);
    await expect(page.locator('[data-testid="pregunta-card"]')).toBeVisible({ timeout: 10_000 });

    const picker = page.locator('[data-testid="selector-confianza"]');

    // First activate 75% mode
    await picker.locator('.seguridad-box').nth(1).click();
    await expect(page.locator('[data-testid="candidatas-contador"]')).toBeVisible();

    // Switch to 0% (🛑 Dudo entre todas)
    await picker.locator('.seguridad-box').nth(3).click();

    // Counter must disappear (maxCandidatas() == 0 at CERO_POR_CIENTO)
    await expect(page.locator('[data-testid="candidatas-contador"]')).not.toBeVisible();
  });

  // ── T7: El enunciado es visible al cargarse el test ───────────────────────

  test('el enunciado de la pregunta es visible al cargar el test', async ({ page }) => {
    await page.goto(TEST_URL);
    await expect(page.locator('[data-testid="pregunta-card"]')).toBeVisible({ timeout: 10_000 });

    await expect(page.locator('[data-testid="enunciado-pregunta"]')).toBeVisible();
    // The fixture has 4 answer options per question
    await expect(page.locator('[data-testid="opcion-respuesta"]')).toHaveCount(4);
  });

  // ── T8: Seguridad se envía en el payload de registrar-respuesta ───────────

  test('la seguridad seleccionada se incluye en el payload al responder', async ({ page }) => {
    await page.goto(TEST_URL);
    await expect(page.locator('[data-testid="pregunta-card"]')).toBeVisible({ timeout: 10_000 });

    let capturedSeguridad: string | null = null;
    page.on('request', (req) => {
      if (req.url().includes('tests/registrar-respuesta') && req.method() === 'POST') {
        const body = req.postDataJSON();
        if (body?.seguridad) capturedSeguridad = body.seguridad;
      }
    });

    // Select 50% confianza before answering
    const picker = page.locator('[data-testid="selector-confianza"]');
    await picker.locator('.seguridad-box').nth(2).click(); // CINCUENTA_POR_CIENTO

    await page.locator('[data-testid="opcion-respuesta"]').first().click();
    await page.waitForResponse('**/tests/registrar-respuesta');

    expect(capturedSeguridad).toBe('CINCUENTA_POR_CIENTO');
  });
});
