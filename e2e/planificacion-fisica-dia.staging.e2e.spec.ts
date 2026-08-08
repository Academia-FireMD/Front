/**
 * Ejecución real contra staging (sin mocks):
 * E2E_STAGING_BASE_URL=... E2E_STAGING_EMAIL=... E2E_STAGING_PASSWORD=...
 * E2E_STAGING_DATE=YYYY-MM-DD npx playwright test -c playwright.staging.config.ts
 *
 * Las cuatro variables se mantienen fuera del repositorio y nunca se imprimen.
 */
import {
  expect,
  test,
  type Page,
  type Request,
  type Response,
} from '@playwright/test';

const requiredEnvironment = [
  'E2E_STAGING_BASE_URL',
  'E2E_STAGING_EMAIL',
  'E2E_STAGING_PASSWORD',
  'E2E_STAGING_DATE',
] as const;

const missingEnvironment = requiredEnvironment.filter(
  (name) => !process.env[name],
);
const canRunAgainstStaging = missingEnvironment.length === 0;

test.skip(
  !canRunAgainstStaging,
  `Requiere variables de staging: ${missingEnvironment.join(', ')}`,
);

interface DisciplinaDetalle {
  asignacionId: number;
  realizado: boolean;
  grupo?: string;
}

interface DiaDetalle {
  disciplinas: DisciplinaDetalle[];
}

interface ProgresoPut {
  asignacionId: number;
  realizado: unknown;
  bloqueId: string | null;
}

interface CleanupState {
  asignacionId: number;
  estadoOriginal: boolean;
  bloqueId: string | null;
  toggleFuncionalIniciado: boolean;
  putsProgreso: ProgresoPut[];
}

const cleanupTimeout = 10_000;
let cleanupState: CleanupState | undefined;

function esDetalleDia(response: Response): boolean {
  const url = new URL(response.url());
  return (
    response.request().method() === 'GET' &&
    url.pathname.startsWith('/planificacion-fisica/dia/') &&
    response.status() === 200 &&
    response.headers()['content-type']?.includes('application/json') === true
  );
}

async function esperarDetalleDia(
  page: Page,
  timeout?: number,
): Promise<DiaDetalle> {
  const response = await page.waitForResponse(esDetalleDia, { timeout });
  return (await response.json()) as DiaDetalle;
}

function getDisciplinaCompletable(detalle: DiaDetalle): DisciplinaDetalle {
  const disciplina = detalle.disciplinas.find(
    (item) =>
      typeof item.asignacionId === 'number' &&
      typeof item.realizado === 'boolean' &&
      item.grupo !== 'DESCANSO',
  );
  expect(
    disciplina,
    'staging debe devolver una disciplina completable',
  ).toBeDefined();
  return disciplina!;
}

function botonProgreso(page: Page, asignacionId: number, realizado: boolean) {
  return page.getByTestId(
    `pf-dia-boton-${realizado ? 'hecho' : 'marcar'}-${asignacionId}`,
  );
}

function registrarPutProgreso(request: Request, puts: ProgresoPut[]): void {
  if (request.method() !== 'PUT') return;

  const url = new URL(request.url());
  const match = url.pathname.match(/\/planificacion-fisica\/progreso\/(\d+)$/);
  if (!match) return;

  const body = request.postDataJSON() as { realizado?: unknown };
  puts.push({
    asignacionId: Number(match[1]),
    realizado: body.realizado,
    bloqueId: url.searchParams.get('bloqueId'),
  });
}

async function alternarYValidar(
  page: Page,
  asignacionId: number,
  realizado: boolean,
  bloqueId: string | null,
  timeout?: number,
): Promise<void> {
  const respuestaProgreso = page.waitForResponse(
    (response) => {
      const request = response.request();
      return (
        request.method() === 'PUT' &&
        new RegExp(`/planificacion-fisica/progreso/${asignacionId}$`).test(
          new URL(response.url()).pathname,
        ) &&
        response.status() >= 200 &&
        response.status() < 300
      );
    },
    { timeout },
  );

  await botonProgreso(page, asignacionId, !realizado).click({ timeout });
  const response = await respuestaProgreso;
  const request = response.request();
  expect(request.postDataJSON()).toEqual({ realizado });
  expect(new URL(request.url()).searchParams.get('bloqueId')).toBe(bloqueId);
}

test.beforeEach(({ page }) => {
  cleanupState = undefined;
  page.on('request', (request) => {
    if (cleanupState) {
      registrarPutProgreso(request, cleanupState.putsProgreso);
    }
  });
});

test.afterEach(async ({ page }) => {
  const state = cleanupState;
  if (!state) return;

  // Un timeout tras un PUT no demuestra que el servidor no haya persistido el cambio.
  // El teardown tiene presupuesto propio y siempre parte de un GET real.
  const detalleAntesDeLimpiarPromise = esperarDetalleDia(page, cleanupTimeout);
  await page.reload({ timeout: cleanupTimeout });
  const detalleAntesDeLimpiar = await detalleAntesDeLimpiarPromise;
  const estadoActual = detalleAntesDeLimpiar.disciplinas.find(
    (item) => item.asignacionId === state.asignacionId,
  )?.realizado;
  expect(estadoActual).toBeDefined();
  if (estadoActual === undefined) {
    throw new Error('El GET real no devolvió la disciplina seleccionada');
  }

  const requiereLimpieza = estadoActual !== state.estadoOriginal;
  if (requiereLimpieza) {
    await expect(
      botonProgreso(page, state.asignacionId, estadoActual),
    ).toBeVisible({ timeout: cleanupTimeout });
    await alternarYValidar(
      page,
      state.asignacionId,
      state.estadoOriginal,
      state.bloqueId,
      cleanupTimeout,
    );
  }

  const detalleRestauradoPromise = esperarDetalleDia(page, cleanupTimeout);
  await page.reload({ timeout: cleanupTimeout });
  const detalleRestaurado = await detalleRestauradoPromise;
  const disciplinaRestaurada = detalleRestaurado.disciplinas.find(
    (item) => item.asignacionId === state.asignacionId,
  );
  expect(disciplinaRestaurada?.realizado).toBe(state.estadoOriginal);
  await expect(
    botonProgreso(page, state.asignacionId, state.estadoOriginal),
  ).toBeVisible({ timeout: cleanupTimeout });

  const expectedPuts = state.toggleFuncionalIniciado
    ? [
        {
          asignacionId: state.asignacionId,
          realizado: !state.estadoOriginal,
          bloqueId: state.bloqueId,
        },
        ...(requiereLimpieza
          ? [
              {
                asignacionId: state.asignacionId,
                realizado: state.estadoOriginal,
                bloqueId: state.bloqueId,
              },
            ]
          : []),
      ]
    : [];
  expect(state.putsProgreso).toEqual(expectedPuts);
  cleanupState = undefined;
});

test('persiste un único toggle de planificación física', async ({ page }) => {
  const fecha = process.env['E2E_STAGING_DATE']!;
  const email = process.env['E2E_STAGING_EMAIL']!;
  const password = process.env['E2E_STAGING_PASSWORD']!;
  await page.goto('/auth/login');
  await page.locator('input[formControlName=email]').fill(email);
  await page.locator('app-password-input input').fill(password);
  await page.locator('app-async-button button').click();
  await expect(page).toHaveURL(/\/app(?:\/|$)/);

  await page.goto('/app/planificacion-fisica');
  const diaCalendario = page.getByTestId(`pf-dia-${fecha}`);
  await expect(diaCalendario).toBeVisible();
  await expect
    .poll(() => new URL(page.url()).searchParams.get('bloqueId'))
    .toMatch(/^[1-9]\d*$/);
  const bloqueId = new URL(page.url()).searchParams.get('bloqueId');
  if (!bloqueId) {
    throw new Error('El calendario no propagó un bloqueId válido en la URL');
  }

  const detalleInicialPromise = esperarDetalleDia(page);
  await diaCalendario.click();
  await expect(page).toHaveURL(
    new RegExp(
      `/app/planificacion-fisica/dia/${encodeURIComponent(fecha)}\\?[^#]*\\bbloqueId=${bloqueId}(?:&|$)`,
    ),
  );
  const detalleInicial = await detalleInicialPromise;
  const disciplina = getDisciplinaCompletable(detalleInicial);

  // Se registra antes del click para que afterEach pueda reparar un timeout tras el PUT.
  const state: CleanupState = {
    asignacionId: disciplina.asignacionId,
    estadoOriginal: disciplina.realizado,
    bloqueId,
    toggleFuncionalIniciado: false,
    putsProgreso: [],
  };
  cleanupState = state;

  await expect(
    botonProgreso(page, state.asignacionId, state.estadoOriginal),
  ).toBeVisible();
  state.toggleFuncionalIniciado = true;
  await alternarYValidar(
    page,
    state.asignacionId,
    !state.estadoOriginal,
    state.bloqueId,
  );

  const detalleRecargadoPromise = esperarDetalleDia(page);
  await page.reload();
  const detalleRecargado = await detalleRecargadoPromise;
  const disciplinaRecargada = detalleRecargado.disciplinas.find(
    (item) => item.asignacionId === state.asignacionId,
  );
  expect(disciplinaRecargada?.realizado).toBe(!state.estadoOriginal);
  await expect(
    botonProgreso(page, state.asignacionId, !state.estadoOriginal),
  ).toBeVisible();
});
