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
    const isBorrador = !isOmitida && respuestaDada === -1;
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
        respuestaDada: isOmitida || isBorrador ? -1 : respuestaDada,
        esCorrecta:
          respuestaDada ===
          testFixture.preguntas[indicePregunta]?.respuestaCorrectaIndex,
        indicePregunta,
        estado: isOmitida
          ? 'OMITIDA'
          : isBorrador
            ? 'NO_RESPONDIDA'
            : 'RESPONDIDA',
        seguridad,
        respuestasCandidatas,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        pregunta: {
          respuestaCorrectaIndex:
            testFixture.preguntas[indicePregunta]?.respuestaCorrectaIndex ?? 0,
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

async function seleccionarSeguridad(
  page: import('@playwright/test').Page,
  indice: number,
): Promise<void> {
  // updateSecurity persiste un borrador con debounce y la respuesta puede
  // reconstruir el template del selector; esperar aquí evita clicar un nodo
  // que Angular acaba de reemplazar.
  await Promise.all([
    page.waitForResponse('**/tests/registrar-respuesta'),
    page
      .locator('[data-testid="selector-confianza"] .seguridad-box')
      .nth(indice)
      .click(),
  ]);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('Candidatas de duda', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAlumnoMock(page);
    await setupCandidatasInterceptors(page);
  });

  // ── T1: Seguridad picker renders and candidatas-contador appears ──────────

  test('al seleccionar 50% aparece el contador de candidatas', async ({
    page,
  }) => {
    await page.goto(TEST_URL);
    await expect(page.locator('[data-testid="pregunta-card"]')).toBeVisible({
      timeout: 10_000,
    });

    // Contador should NOT be visible initially (100% seguridad = maxCandidatas() == 0)
    await expect(
      page.locator('[data-testid="candidatas-contador"]'),
    ).not.toBeVisible();

    // Click the 50%-duda button (emoji 👎 / "Dudo entre 3" at CINCUENTA_POR_CIENTO)
    // The seguridad picker renders inside [data-testid="selector-confianza"]
    // CINCUENTA_POR_CIENTO is the third button (index 2): ⭐, 👍, 👎, 🛑
    await seleccionarSeguridad(page, 2);

    // 50% → "Dudo entre 3" → cap 3 (maxCandidatas): "0 / 3 candidatas".
    await expect(
      page.locator('[data-testid="candidatas-contador"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="candidatas-contador"]'),
    ).toContainText('/ 3');
  });

  // ── T2: Descartar (toggle candidata) updates the counter ─────────────────

  test('descarta una opción y el contador se actualiza', async ({ page }) => {
    await page.goto(TEST_URL);
    await expect(page.locator('[data-testid="pregunta-card"]')).toBeVisible({
      timeout: 10_000,
    });

    // Switch to 50% duda → 3 candidatas max (75% sería cap 2).
    await seleccionarSeguridad(page, 2); // 👎 CINCUENTA_POR_CIENTO

    await expect(
      page.locator('[data-testid="candidatas-contador"]'),
    ).toBeVisible();

    // Entrar al modo de selección de candidatas.
    await page.locator('[data-testid="abrir-seleccion-candidatas"]').click();

    // En modo selección, clicar una opción la marca/desmarca como candidata
    // (toggle); el estado se refleja en el contador.
    const opciones = page.locator('[data-testid="opcion-respuesta"]');
    const contador = page.locator('[data-testid="candidatas-banner"]');
    await opciones.nth(0).click();
    await expect(contador).toContainText('1 / 3');
    await opciones.nth(1).click();
    await opciones.nth(2).click();
    await expect(contador).toContainText('3 / 3');

    // Desmarcar una candidata → el contador baja.
    await opciones.nth(0).click();
    await expect(contador).toContainText('2 / 3');
  });

  // ── T3: Rescatar devuelve la opción al pool de candidatas ─────────────────

  test('rescata una opción descartada', async ({ page }) => {
    await page.goto(TEST_URL);
    await expect(page.locator('[data-testid="pregunta-card"]')).toBeVisible({
      timeout: 10_000,
    });

    // Switch to 50% → max 3 candidatas
    await seleccionarSeguridad(page, 2);

    await expect(
      page.locator('[data-testid="candidatas-contador"]'),
    ).toBeVisible();

    // Entrar al modo de selección de candidatas.
    await page.locator('[data-testid="abrir-seleccion-candidatas"]').click();

    // Marcar una opción como candidata, descartarla y volver a rescatarla,
    // verificando que el contador refleja cada paso (marcar→descartar→rescatar).
    const opcion = page.locator('[data-testid="opcion-respuesta"]').first();
    const contador = page.locator('[data-testid="candidatas-banner"]');
    await opcion.click(); // marcar candidata
    await expect(contador).toContainText('1 / 3');
    await opcion.click(); // descartar
    await expect(contador).toContainText('0 / 3');
    await opcion.click(); // rescatar de vuelta
    await expect(contador).toContainText('1 / 3');
  });

  // ── T4: Candidatas persisten en el payload de registrar-respuesta ─────────

  test('las candidatas se incluyen en el payload al responder', async ({
    page,
  }) => {
    await page.goto(TEST_URL);
    await expect(page.locator('[data-testid="pregunta-card"]')).toBeVisible({
      timeout: 10_000,
    });

    const candidatasPayloads: number[][] = [];
    page.on('request', (req) => {
      if (
        req.url().includes('tests/registrar-respuesta') &&
        req.method() === 'POST'
      ) {
        const body = req.postDataJSON();
        if (body?.respuestasCandidatas != null) {
          candidatasPayloads.push(body.respuestasCandidatas);
        }
      }
    });

    // Switch to 75% duda
    await seleccionarSeguridad(page, 1);

    // Responder la primera pregunta → debería incluir respuestasCandidatas
    await Promise.all([
      page.waitForResponse('**/tests/registrar-respuesta'),
      page.locator('[data-testid="opcion-respuesta"]').first().click(),
    ]);

    expect(candidatasPayloads.length).toBeGreaterThan(0);
    // The payload must have an array (may be empty or not, but must be present)
    expect(
      Array.isArray(candidatasPayloads[candidatasPayloads.length - 1]),
    ).toBe(true);
  });

  // ── T5: Cambiar a CIEN_POR_CIENTO limpia el selector de candidatas ────────

  test('cambiar a 100% (No dudo) oculta el contador de candidatas', async ({
    page,
  }) => {
    await page.goto(TEST_URL);
    await expect(page.locator('[data-testid="pregunta-card"]')).toBeVisible({
      timeout: 10_000,
    });

    // First activate 50% mode so counter appears
    await seleccionarSeguridad(page, 2);
    await expect(
      page.locator('[data-testid="candidatas-contador"]'),
    ).toBeVisible();

    // Now switch back to 100% (⭐ No dudo)
    await seleccionarSeguridad(page, 0);

    // Counter must disappear
    await expect(
      page.locator('[data-testid="candidatas-contador"]'),
    ).not.toBeVisible();
  });

  // ── T6: Cambiar a CERO_POR_CIENTO también oculta el contador ─────────────

  test('cambiar a 0% (Dudo entre todas) oculta el contador de candidatas', async ({
    page,
  }) => {
    await page.goto(TEST_URL);
    await expect(page.locator('[data-testid="pregunta-card"]')).toBeVisible({
      timeout: 10_000,
    });

    // First activate 75% mode
    await seleccionarSeguridad(page, 1);
    await expect(
      page.locator('[data-testid="candidatas-contador"]'),
    ).toBeVisible();

    // Switch to 0% (🛑 Dudo entre todas)
    await seleccionarSeguridad(page, 3);

    // Counter must disappear (maxCandidatas() == 0 at CERO_POR_CIENTO)
    await expect(
      page.locator('[data-testid="candidatas-contador"]'),
    ).not.toBeVisible();
  });

  // ── T7: El enunciado es visible al cargarse el test ───────────────────────

  test('el enunciado de la pregunta es visible al cargar el test', async ({
    page,
  }) => {
    await page.goto(TEST_URL);
    await expect(page.locator('[data-testid="pregunta-card"]')).toBeVisible({
      timeout: 10_000,
    });

    await expect(
      page.locator('[data-testid="enunciado-pregunta"]'),
    ).toBeVisible();
    // The fixture has 4 answer options per question
    await expect(page.locator('[data-testid="opcion-respuesta"]')).toHaveCount(
      4,
    );
  });

  // ── T8: Seguridad se envía en el payload de registrar-respuesta ───────────

  test('la seguridad seleccionada se incluye en el payload al responder', async ({
    page,
  }) => {
    await page.goto(TEST_URL);
    await expect(page.locator('[data-testid="pregunta-card"]')).toBeVisible({
      timeout: 10_000,
    });

    let capturedSeguridad: string | null = null;
    page.on('request', (req) => {
      if (
        req.url().includes('tests/registrar-respuesta') &&
        req.method() === 'POST'
      ) {
        const body = req.postDataJSON();
        if (body?.seguridad) capturedSeguridad = body.seguridad;
      }
    });

    // Select 50% confianza before answering
    await seleccionarSeguridad(page, 2); // CINCUENTA_POR_CIENTO

    await Promise.all([
      page.waitForResponse('**/tests/registrar-respuesta'),
      page.locator('[data-testid="opcion-respuesta"]').first().click(),
    ]);

    expect(capturedSeguridad).toBe('CINCUENTA_POR_CIENTO');
  });
});
