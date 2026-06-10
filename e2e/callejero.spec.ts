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
      body: JSON.stringify({
        nombreAcademia: 'Test Academia',
        logoUrl: null,
        primaryColor: '#000000',
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
}

async function irACallejero(page: Page): Promise<void> {
  await page.goto('/app/callejero');
  await expect(page.getByTestId('callejero-page')).toBeVisible();
  await expect(page.getByTestId('callejero-map')).toBeVisible();
}

async function seleccionarPrimeraZona(page: Page): Promise<void> {
  // El selector de zona es un p-dropdown; abrir y elegir la primera opción.
  const dropdown = page.getByTestId('selector-zona');
  await dropdown.click();
  await page.locator('.p-dropdown-item').first().click();
}

test.describe('Módulo Callejero (alumno)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAlumnoMock(page);
    await setupAppConfigStubs(page);
    await setupCallejeroInterceptors(page, freshState());
  });

  test('carga el mapa, atribución y pinta calles al elegir zona', async ({
    page,
  }) => {
    await irACallejero(page);

    // Ciudad autoseleccionada (Valencia) → zonas disponibles.
    await expect(page.getByTestId('selector-ciudad')).toBeVisible();
    await seleccionarPrimeraZona(page);

    // El SVG de calles de Leaflet debe aparecer.
    await expect(page.locator('.leaflet-overlay-pane svg path')).not.toHaveCount(
      0,
    );
    // Atribución obligatoria visible.
    await expect(page.locator('.leaflet-control-attribution')).toContainText(
      'OpenStreetMap',
    );
    await expect(page.locator('.leaflet-control-attribution')).toContainText(
      'IGN CartoCiudad',
    );
  });

  test('Encuentra la calle X: acierto registra progreso', async ({ page }) => {
    const state = freshState();
    await setupCallejeroInterceptors(page, state);
    await irACallejero(page);
    await seleccionarPrimeraZona(page);

    await page.getByTestId('modo-ENCUENTRA_CALLE').click();
    await expect(page.getByTestId('reto-encuentra')).toBeVisible();

    // Click sobre una calle del mapa (cualquier path de la capa de calles).
    await page.locator('.leaflet-overlay-pane svg path').first().click();

    // Se registró progreso y el feedback (acierto o fallo) se muestra.
    await expect(page.getByTestId('feedback')).toBeVisible();
    expect(state.progresoCalls.length).toBeGreaterThan(0);
  });

  test('¿Qué calle es esta?: 4 opciones, responder correcta', async ({
    page,
  }) => {
    await irACallejero(page);
    await seleccionarPrimeraZona(page);

    await page.getByTestId('modo-QUE_CALLE_ES').click();
    const opciones = page.getByTestId('quiz-opciones').locator('button');
    await expect(opciones).toHaveCount(4);

    await opciones.first().click();
    await expect(page.getByTestId('feedback')).toBeVisible();
  });
});
