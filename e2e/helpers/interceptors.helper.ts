import { Page } from '@playwright/test';
import examenFixture from '../fixtures/examen.json';
import flashcardTestFixture from '../fixtures/flashcard-test.json';
import testGeneradoFixture from '../fixtures/test-generado.json';

// ─── Mock responses ────────────────────────────────────────────────────────────

const mockRespuesta = {
  id: 999,
  testId: 123,
  preguntaId: 1,
  respuestaDada: 0,
  esCorrecta: true,
  indicePregunta: 0,
  estado: 'RESPONDIDA',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  pregunta: { respuestaCorrectaIndex: 0 },
};

const mockRespuestaOmitida = {
  ...mockRespuesta,
  omitida: true,
  respuestaDada: -1,
  esCorrecta: false,
  estado: 'OMITIDA',
};

// ─── Test práctica interceptors ────────────────────────────────────────────────

/**
 * Mocks all HTTP calls made by CompletarTestComponent.
 * Call this BEFORE page.goto().
 */
export async function setupTestPracticaInterceptors(
  page: Page,
  testFixture: typeof testGeneradoFixture = testGeneradoFixture
): Promise<void> {
  // Load test data
  await page.route('**/tests/por-id/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(testFixture),
    })
  );

  // Register individual answer
  await page.route('**/tests/registrar-respuesta', (route) => {
    const postData = route.request().postDataJSON();
    const isOmitida = postData?.omitida === true;
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(isOmitida ? mockRespuestaOmitida : mockRespuesta),
    });
  });

  // Finalize test — returns updated test (status FINALIZADO)
  await page.route('**/tests/finalizar-test/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...testFixture, status: 'FINALIZADO' }),
    })
  );
}

/**
 * Mocks the test generation endpoint (POST /tests/start).
 */
export async function setupTestGenerarInterceptors(page: Page): Promise<void> {
  await page.route('**/tests/start', (route) =>
    route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ id: 123, message: 'Test creado correctamente' }),
    })
  );

  await page.route('**/tests/tests-alumno', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [], total: 0, page: 1, pageSize: 10 }),
    })
  );

  await page.route('**/tests/obtener-fallos-count', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(0),
    })
  );

  // Temas / topics for dropdowns
  await page.route('**/temas**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: 1, numero: 1, descripcion: 'Sistema Cardiovascular' },
        { id: 2, numero: 2, descripcion: 'Sistema Respiratorio' },
      ]),
    })
  );
}

// ─── Flashcard interceptors ────────────────────────────────────────────────────

/**
 * Mocks all HTTP calls made by CompletarFlashCardTestComponent.
 */
export async function setupFlashcardInterceptors(
  page: Page,
  fixture: typeof flashcardTestFixture = flashcardTestFixture
): Promise<void> {
  await page.route('**/flashcards/por-id/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(fixture),
    })
  );

  await page.route('**/flashcards/registrar-respuesta', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({}),
    })
  );

  await page.route('**/flashcards/finalizar-test/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({}),
    })
  );
}

// ─── Simulacro interceptors ───────────────────────────────────────────────────

/**
 * Mocks all HTTP calls made by RealizarSimulacroComponent and
 * CompletarTestSimulacroComponent.
 */
export async function setupSimulacroInterceptors(
  page: Page,
  opts: { examenId?: number; testId?: number } = {}
): Promise<void> {
  const examenId = opts.examenId ?? 5;
  const testId = opts.testId ?? 42;

  // Load simulacro info
  await page.route(`**/examenes/simulacro/${examenId}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...examenFixture, id: examenId }),
    })
  );

  // Subscription check — always allow access
  await page.route(`**/examenes/verificar-acceso-simulacro/${examenId}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ tieneAcceso: true, necesitaCodigo: false }),
    })
  );

  // Start simulacro → returns the Test id
  await page.route(`**/examenes/start-simulacro/${examenId}`, (route) =>
    route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ id: testId }),
    })
  );

  // Load the actual test once redirected to "completar"
  await setupTestPracticaInterceptors(page, testGeneradoFixture as any);

  // Test service calls from CompletarTestSimulacroComponent
  await page.route('**/tests/por-id/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...testGeneradoFixture, id: testId }),
    })
  );
}

// ─── Auth interceptors (for login flow) ───────────────────────────────────────

/**
 * Mocks /auth/login with the mock JWT response for the given role.
 */
export async function setupAuthInterceptors(
  page: Page,
  opts: {
    email: string;
    rol: 'ALUMNO' | 'ADMIN';
    statusCode?: number;
    errorBody?: Record<string, unknown>;
  }
): Promise<void> {
  if (opts.statusCode && opts.statusCode >= 400) {
    await page.route('**/auth/login', (route) =>
      route.fulfill({
        status: opts.statusCode!,
        contentType: 'application/json',
        body: JSON.stringify(opts.errorBody ?? { message: 'Credenciales incorrectas' }),
      })
    );
    return;
  }

  const payload = Buffer.from(
    JSON.stringify({ rol: opts.rol, email: opts.email, sub: 1, exp: 9_999_999_999 })
  ).toString('base64');
  const mockJwt = `x.${payload}.x`;

  await page.route('**/auth/login', (route) =>
    route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ access_token: mockJwt, refresh_token: mockJwt }),
    })
  );
}
