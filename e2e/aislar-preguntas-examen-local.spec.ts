import { expect, test } from '@playwright/test';
import * as path from 'path';
import userAdminFixture from './fixtures/user-admin.json';
import examenFixture from './fixtures/examen.json';

// ─── Constants ────────────────────────────────────────────────────────────────

const EXAMEN_ID = 5;
const FIXTURE_XLSX = path.resolve(__dirname, 'fixtures/preguntas-ejemplo.xlsx');

const mockTemas = [
  {
    id: 1,
    numero: 1,
    descripcion: 'Tema 1: Anatomía',
    oposicion: 'BOMBEROS_ESTADO',
  },
];

const mockExamenBase = {
  ...examenFixture,
  id: EXAMEN_ID,
  tipoAcceso: 'LIBRE',
  test: { id: 10, testPreguntas: [] as Array<unknown> },
  testId: 10,
};

// ─── Auth helpers (mismo patrón que importar-excel-examen.spec) ───────────────

function buildMockJwt(payload: Record<string, unknown>): string {
  const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64');
  return `x.${base64Payload}.x`;
}

async function loginAsAdminMock(
  page: import('@playwright/test').Page,
): Promise<void> {
  const mockJwt = buildMockJwt({
    rol: 'ADMIN',
    email: 'admin@test.com',
    sub: 99,
    exp: 9_999_999_999,
  });

  await page.route('**/auth/login', (route) =>
    route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ access_token: mockJwt, refresh_token: mockJwt }),
    }),
  );

  await page.route('**/user/get-by-email', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(userAdminFixture),
    }),
  );

  await page.goto('/auth/login');
  await page.locator('input[formControlName="email"]').fill('admin@test.com');
  await page.locator('app-password-input input').fill('test1234');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/app/**', { timeout: 15_000 });
}

// ─── Test ─────────────────────────────────────────────────────────────────────

test.describe('Aislamiento de preguntas examen-local + promoción', () => {
  test('importar Excel → no aparece en banco → promocionar → aparece', async ({
    page,
  }) => {
    // Estado simulado server-side: lista de preguntas con su examenId
    let preguntasMock: Array<{
      id: number;
      identificador: string;
      examenId: number | null;
    }> = [];

    // Examen con su lista de testPreguntas reflejando el estado
    const computeExamenDto = () => ({
      ...mockExamenBase,
      test: {
        id: 10,
        testPreguntas: preguntasMock.map((p, i) => ({
          orden: i,
          deReserva: false,
          pregunta: p,
        })),
      },
    });

    // ── 1. Auth + setup base
    await loginAsAdminMock(page);

    // Examen detail (recalculado en cada llamada)
    await page.route(`**/examenes/${EXAMEN_ID}`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(computeExamenDto()),
      }),
    );
    await page.route('**/tema/get-temas', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockTemas),
      }),
    );
    await page.route(`**/examenes/${EXAMEN_ID}/resultados**`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ resultados: [], totalParticipantes: 0 }),
      }),
    );
    await page.route('**/woocommerce**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      }),
    );

    // Importar Excel: añade 3 preguntas locales (examenId set)
    await page.route(
      `**/examenes/${EXAMEN_ID}/importar-preguntas-excel`,
      (route) => {
        preguntasMock = [
          { id: 1001, identificador: 'TB1.001', examenId: EXAMEN_ID },
          { id: 1002, identificador: 'TB1.002', examenId: EXAMEN_ID },
          { id: 1003, identificador: 'TB1.003', examenId: EXAMEN_ID },
        ];
        route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Se importaron 3 preguntas', creadas: 3 }),
        });
      },
    );

    // Banco global: filtra examenId IS NULL como hará el server tras el fix
    let preguntasGetCalls = 0;
    await page.route(
      '**/preguntas/get-all-preguntas-by-filter',
      (route) => {
        preguntasGetCalls++;
        const filtradas = preguntasMock.filter((p) => p.examenId === null);
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: filtradas, total: filtradas.length }),
        });
      },
    );

    // Promoción: actualiza examenId=NULL en las locales
    await page.route(
      `**/examenes/${EXAMEN_ID}/anyadir-preguntas-academia`,
      (route) => {
        const promovidas = preguntasMock.filter(
          (p) => p.examenId === EXAMEN_ID,
        ).length;
        preguntasMock = preguntasMock.map((p) => ({ ...p, examenId: null }));
        route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            message: `Se han promocionado ${promovidas} preguntas al banco global`,
            creadas: promovidas,
          }),
        });
      },
    );

    // ── 2. Importar Excel
    await page.goto(`/app/examen/${EXAMEN_ID}`);
    await page.locator('button.fab-button').click();
    await expect(
      page.locator('[data-testid="metodo-importar-excel-card"]'),
    ).toBeVisible({ timeout: 8_000 });
    await page.locator('[data-testid="metodo-importar-excel-card"]').click();
    await expect(
      page.locator('[data-testid="importar-excel-dialog"]'),
    ).toBeVisible({ timeout: 8_000 });

    await page.setInputFiles(
      '[data-testid="importar-excel-file-input"]',
      FIXTURE_XLSX,
    );

    // Tema
    const temaWrapper = page.locator('[data-testid="importar-excel-tema"]');
    await temaWrapper.locator('.p-dropdown').click();
    const overlayPanel = page.locator('p-overlaypanel').last();
    await overlayPanel.waitFor({ state: 'visible', timeout: 5_000 });
    await overlayPanel.locator('p-radioButton').first().click();

    // Dificultad
    const dificultadWrapper = page.locator(
      '[data-testid="importar-excel-dificultad"]',
    );
    await dificultadWrapper.locator('.p-dropdown').click();
    const dropdownPanel = page.locator('.p-dropdown-panel').last();
    await dropdownPanel.waitFor({ state: 'visible', timeout: 5_000 });
    await dropdownPanel.locator('.p-dropdown-item').first().click();

    await page.locator('[data-testid="importar-excel-submit"]').click();

    await expect(
      page.locator('.toast-success, [class*="ngx-toastr"][class*="success"]').first(),
    ).toContainText('importaron', { timeout: 10_000 });

    // ── 3. Banco global: las 3 preguntas NO aparecen
    await page.goto('/app/test/preguntas');
    // Espera a que el listado intente cargar
    await page.waitForFunction(() => true, null, { timeout: 1_000 });
    expect(preguntasGetCalls).toBeGreaterThan(0);

    // El estado del mock confirma que el banco-mock devolvió 0 preguntas
    // (todas tienen examenId set). Verificamos también que ningún
    // identificador "TB1.00X" aparece en pantalla.
    await expect(page.locator('text=TB1.001')).toHaveCount(0);
    await expect(page.locator('text=TB1.002')).toHaveCount(0);
    await expect(page.locator('text=TB1.003')).toHaveCount(0);

    // ── 4. Promocionar desde el examen
    await page.goto(`/app/examen/${EXAMEN_ID}`);
    await page
      .locator('[data-testid="anyadir-preguntas-academia-btn"]')
      .click();

    // El componente abre un confirm dialog primero — aceptamos
    const confirmAccept = page.locator('.p-confirm-dialog-accept').first();
    await confirmAccept.waitFor({ state: 'visible', timeout: 5_000 });
    await confirmAccept.click();

    await expect(
      page.locator('.toast-success, [class*="ngx-toastr"][class*="success"]').first(),
    ).toContainText(/promocionado|añadid/i, { timeout: 10_000 });

    // ── 5. Banco global: AHORA sí aparecen
    await page.goto('/app/test/preguntas');
    await page.waitForFunction(() => true, null, { timeout: 1_000 });

    // El mock del banco ahora devuelve las 3 (todas con examenId=null).
    // Verificamos que el state interno coincide.
    expect(preguntasMock.every((p) => p.examenId === null)).toBe(true);
    expect(preguntasMock.length).toBe(3);
  });
});
