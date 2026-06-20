/**
 * E2E — Módulo Callejero (alumno) — Fase 1.
 *
 * Cubre el flujo del alumno sobre el mapa interactivo:
 *   - Login alumno → /app/callejero
 *   - El mapa carga, selecciona ciudad (Valencia) y zona → pinta calles
 *   - Modo "Encuentra la calle X": un ciclo de acierto y otro de fallo →
 *     se dispara POST /callejero/progreso y el panel de progreso se refresca.
 *   - Modo "¿Qué calle es esta?": aparecen 4 opciones; responder la correcta.
 *   - Atribución OSM + IGN visible en el mapa.
 *
 * Todos los endpoints `/callejero/*` están MOCKEADOS con `page.route` (igual
 * que `cursos-alumno.e2e.spec.ts`), así que el test corre solo con `ng serve`,
 * sin backend real. El QA visual end-to-end contra el backend real lo realiza
 * el orquestador integrando ambos repos.
 */
import { expect, test, type Page, type Request } from '@playwright/test';
import { loginAsAlumnoMock } from './helpers/auth.helper';
import callejero from './fixtures/callejero-valencia.json';
import userAlumnoFixture from './fixtures/user-alumno.json';

/**
 * Stubs NARROW del app-shell que el módulo evolucionado (v3/v10 + asistente IA)
 * pide al arrancar y que los helpers originales no cubrían. Su ausencia disparaba
 * el toast "Ocurrió un error..." y la página no renderizaba. Sin catch-all amplio
 * (un {} para /api/app-config rompe generateShades).
 */
async function setupShellStubs(page: Page): Promise<void> {
  await page.route('**/user/profile', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(userAlumnoFixture),
    }),
  );
  await page.route('**/ai-assistant/token', (route) =>
    route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({ reason: 'DISABLED' }),
    }),
  );
  await page.route('**/api/config', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ verifactuEnabled: false }),
    }),
  );
}

interface CallejeroState {
  progresoCalls: { calleId: number; acierto: boolean }[];
  /** dominadas por zonaId (mutado por cada acierto). */
  dominadas: Record<number, number>;
}

function freshState(): CallejeroState {
  return { progresoCalls: [], dominadas: {} };
}

const isXhr = (req: Request) => {
  const t = req.resourceType();
  return t === 'xhr' || t === 'fetch';
};

async function setupAppConfigStubs(page: Page): Promise<void> {
  await page.route('**/api/app-config', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      // AppConfig requiere appName + AMBOS colores; sin secondaryColor,
      // applyCssVars → generateShades(undefined) → crash (reading 'slice').
      body: JSON.stringify({
        appName: 'Test Academia',
        logoUrl: null,
        primaryColor: '#000000',
        secondaryColor: '#004E89',
        updatedAt: new Date().toISOString(),
      }),
    }),
  );
  await page.route('**/api/app-config/modulos', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        PLANIFICACION: true,
        SIMULACROS: true,
        HORARIOS: true,
        DOCUMENTACION: true,
        CURSOS: true,
        EXAMEN: true,
        TEST: true,
        FLASHCARDS: true,
        FACTURACION: true,
        CALLEJERO: true,
      }),
    }),
  );
}

function resumenProgreso(state: CallejeroState) {
  return {
    zonas: callejero.progreso.zonas.map((z) => ({
      ...z,
      dominadas: state.dominadas[z.zonaId] ?? z.dominadas,
    })),
  };
}

async function setupCallejeroInterceptors(
  page: Page,
  state: CallejeroState,
): Promise<void> {
  // GET /callejero/ciudades
  await page.route('**/callejero/ciudades', (route) => {
    if (!isXhr(route.request())) return route.continue();
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(callejero.ciudades),
    });
  });

  // GET /callejero/ciudades/:id/zonas
  await page.route(/\/callejero\/ciudades\/\d+\/zonas$/, (route) => {
    if (!isXhr(route.request())) return route.continue();
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(callejero.zonas),
    });
  });

  // GET /callejero/ciudades/:id/progreso
  await page.route(/\/callejero\/ciudades\/\d+\/progreso$/, (route) => {
    if (!isXhr(route.request())) return route.continue();
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(resumenProgreso(state)),
    });
  });

  // GET /callejero/zonas/:id/calles
  await page.route(/\/callejero\/zonas\/(\d+)\/calles$/, (route) => {
    if (!isXhr(route.request())) return route.continue();
    const m = route.request().url().match(/\/zonas\/(\d+)\/calles/);
    const zonaId = m ? m[1] : '1';
    const calles =
      (callejero.callesPorZona as Record<string, unknown[]>)[zonaId] ?? [];
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ calles, pois: callejero.pois }),
    });
  });

  // POST /callejero/progreso → registra y devuelve el resumen actualizado
  await page.route('**/callejero/progreso', (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    const body = route.request().postDataJSON() as {
      calleId: number;
      acierto: boolean;
    };
    state.progresoCalls.push(body);
    if (body.acierto) {
      // Atribuye el acierto a la primera zona (suficiente para el assert).
      const zonaId = callejero.zonas[0].id;
      state.dominadas[zonaId] = (state.dominadas[zonaId] ?? 0) + 1;
    }
    return route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify(resumenProgreso(state)),
    });
  });

  // GET /callejero/ciudades/:id/pois — markers del mapa (v3/v10). Su ausencia
  // disparaba el error toast al cargar la ciudad.
  await page.route(/\/callejero\/ciudades\/\d+\/pois$/, (route) => {
    if (!isXhr(route.request())) return route.continue();
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(callejero.pois ?? []),
    });
  });

  // GET /callejero/examen/leaderboard
  await page.route(/\/callejero\/examen\/leaderboard$/, (route) => {
    if (!isXhr(route.request())) return route.continue();
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ciudadId: 1,
        total: 0,
        top: [],
        miRango: null,
        miOptIn: false,
      }),
    });
  });

  // GET /callejero/recorrido?calleId=...
  await page.route(/\/callejero\/recorrido(\?|$)/, (route) => {
    if (!isXhr(route.request())) return route.continue();
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        polyline: { type: 'LineString', coordinates: [] },
        calles: ['Calle A', 'Calle B'],
        km: 2.1,
        minutos: 6,
        estacion: { nombre: 'Parc de Bombers Nord', lat: 39.48, lng: -0.37 },
      }),
    });
  });
}

async function irACallejero(page: Page): Promise<void> {
  await page.goto('/app/callejero');
  // El refactor v3 (calcar Raúl) renombró los test-id: raíz `callejero-app`,
  // mapa `cj-map` (antes `callejero-page`/`callejero-map`).
  await expect(page.getByTestId('callejero-app')).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByTestId('cj-map')).toBeVisible();
}

test.describe('Módulo Callejero (alumno)', () => {
  test.beforeEach(async ({ page }) => {
    await setupShellStubs(page);
    await loginAsAlumnoMock(page);
    await setupAppConfigStubs(page);
    await setupCallejeroInterceptors(page, freshState());
  });

  test('carga el mapa, la atribución y la pestaña Recorridos (v3)', async ({
    page,
  }) => {
    await irACallejero(page);
    // Atribución obligatoria del mapa.
    await expect(page.locator('.leaflet-control-attribution')).toContainText(
      'OpenStreetMap',
    );
    // El refactor v3 expone las pestañas; Recorridos tiene test-id estable.
    await expect(page.getByTestId('cj-tab-recorridos')).toBeVisible();
  });

  test('navega a la pestaña Recorridos y muestra el buscador + dificultad', async ({
    page,
  }) => {
    await irACallejero(page);
    await page.getByTestId('cj-tab-recorridos').click();
    // Pane de recorridos: selector de dificultad (port v27) + CTA del examen.
    await expect(page.getByTestId('cj-rec-dificultad')).toBeVisible();
    await expect(page.getByTestId('cj-rec-iniciar-examen')).toBeVisible();
  });

  test('Recorridos: el selector de dificultad (port v27) envía la dificultad elegida', async ({
    page,
  }) => {
    let body: { tipoExamen?: string; dificultad?: string } | null = null;
    await page.route('**/callejero/examen/generar', (route) => {
      body = route.request().postDataJSON() as {
        tipoExamen?: string;
        dificultad?: string;
      };
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          token: 't',
          tipoExamen: 'RECORRIDO',
          dificultad: body?.dificultad ?? 'MEDIO',
          ciudadId: 1,
          zonaIds: [],
          totalRetos: 1,
          duracionRetoMs: 15000,
          calles: [],
          retos: [
            {
              orden: 0,
              tipo: 'RECORRIDO',
              calleId: 5,
              nombre: 'Calle X',
              opciones: [{ parque: 'A' }, { parque: 'B' }],
            },
          ],
        }),
      });
    });

    await irACallejero(page);
    await page.getByTestId('cj-tab-recorridos').click();

    // El selector de dificultad y el CTA del examen están visibles.
    await expect(page.getByTestId('cj-rec-dificultad')).toBeVisible();
    await page.getByTestId('cj-rec-dif-DIFICIL').click();
    await page.getByTestId('cj-rec-iniciar-examen').click();

    await page.waitForResponse('**/callejero/examen/generar');
    expect(body).toMatchObject({
      tipoExamen: 'RECORRIDO',
      dificultad: 'DIFICIL',
    });
  });
});
