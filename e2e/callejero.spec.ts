/**
 * E2E — Módulo Callejero (alumno) — Fase 1.
 *
 * Cubre el flujo del alumno sobre el mapa interactivo:
 *   - Login alumno → /app/callejero
 *   - El mapa carga, selecciona ciudad (Valencia) y zona → pinta calles
 *   - Modo "Encuentra la calle X": un ciclo de acierto y otro de fallo →
 *     se dispara POST /callejero/progreso y el panel de progreso se refresca.
 *   - Modo "¿Qué calle es esta?": aparecen 4 opciones; responder la correcta.
 *   - Atribución de OpenStreetMap y de las capas de mapa visible.
 *
 * Todos los endpoints `/callejero/*` están MOCKEADOS con `page.route` (igual
 * que `cursos-alumno.e2e.spec.ts`), así que el test corre solo con `ng serve`,
 * sin backend real. El QA visual end-to-end contra el backend real lo realiza
 * el orquestador integrando ambos repos.
 */
import {
  expect,
  test,
  type FrameLocator,
  type Page,
  type Request,
} from '@playwright/test';
import { loginAsAlumnoMock, loginAsRoleMock } from './helpers/auth.helper';
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
  ciudadesApiCalls: number;
  callesApiCalls: number;
  geocodeApiCalls: number;
  routeApiCalls: number;
  valenciaAutorizada: boolean;
}

function freshState(): CallejeroState {
  return {
    progresoCalls: [],
    dominadas: {},
    ciudadesApiCalls: 0,
    callesApiCalls: 0,
    geocodeApiCalls: 0,
    routeApiCalls: 0,
    valenciaAutorizada: true,
  };
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
    state.ciudadesApiCalls += 1;
    if (!state.valenciaAutorizada) {
      return route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Callejero no autorizado' }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      // Valencia no es la primera: el embed debe resolver por slug, no por
      // orden de la respuesta.
      body: JSON.stringify([
        { id: 99, slug: 'madrid', nombre: 'Madrid' },
        ...callejero.ciudades,
      ]),
    });
  });

  // GET /callejero/ciudades/:id/calles — fuente única del callejero del embed.
  await page.route(/\/callejero\/ciudades\/1\/calles$/, (route) => {
    if (!isXhr(route.request())) return route.continue();
    state.callesApiCalls += 1;
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        calles: [
          {
            id: 101,
            nombre: 'Calle API Real',
            tipoVia: 'Calle',
            lat: 39.45,
            lng: -0.35,
            longitudM: 500,
            parquesCobertura: [],
            bb: [39.4, -0.4, 39.5, -0.3],
          },
        ],
      }),
    });
  });

  // Geocodificación propia, siempre ligada a ciudadId.
  await page.route(/\/callejero\/geocode\/buscar\?/, (route) => {
    if (!isXhr(route.request())) return route.continue();
    const url = new URL(route.request().url());
    if (url.searchParams.get('ciudadId') !== '1') return route.continue();
    state.geocodeApiCalls += 1;
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [{ nombre: 'Calle API Real', lat: 39.45, lng: -0.35 }],
      }),
    });
  });

  await page.route(/\/callejero\/geocode\/reverse\?/, (route) => {
    if (!isXhr(route.request())) return route.continue();
    const url = new URL(route.request().url());
    if (url.searchParams.get('ciudadId') !== '1') return route.continue();
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ direccion: 'Calle API Real, 1' }),
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
    const m = route
      .request()
      .url()
      .match(/\/zonas\/(\d+)\/calles/);
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
    state.routeApiCalls += 1;
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        polyline: [
          [39.45, -0.35],
          [39.46, -0.36],
        ],
        calles: ['Avenida API', 'Calle API Real'],
        km: 2.1,
        minutos: 6,
        estacion: { nombre: 'Parc API', lat: 39.44, lng: -0.34 },
      }),
    });
  });

  await page.route(/\/callejero\/recorrido-libre\?/, (route) => {
    if (!isXhr(route.request())) return route.continue();
    state.routeApiCalls += 1;
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        polyline: [
          [39.45, -0.35],
          [39.46, -0.36],
        ],
        calles: ['Avenida API', 'Calle API Real'],
        km: 2.1,
        minutos: 6,
        estacion: { nombre: 'Parc API', lat: 39.44, lng: -0.34 },
      }),
    });
  });
}

async function irACallejero(page: Page): Promise<FrameLocator> {
  await page.goto('/app/callejero');
  // La ruta pública actual conserva el HTML de Raúl dentro de un iframe. Los
  // test-id del port nativo viven en /app/callejero/nativo y no deben usarse
  // para verificar el flujo que realmente ve el alumno.
  const embed = page.locator('[data-testid="callejero-embed-iframe"]');
  await expect(embed).toBeVisible({ timeout: 15_000 });
  const frame = page.frameLocator('[data-testid="callejero-embed-iframe"]');
  await expect(frame.locator('#app')).toBeVisible({
    timeout: 15_000,
  });
  await expect(frame.locator('#map')).toBeVisible();
  return frame;
}

test.describe('Módulo Callejero (alumno)', () => {
  const forbiddenExternalDomains = [
    'overpass-api.de',
    'overpass.kumi.systems',
    'nominatim.openstreetmap.org',
    'router.project-osrm.org',
  ];
  let currentState: CallejeroState;
  let blockedExternalUrls: string[];

  test.beforeEach(async ({ page }) => {
    currentState = freshState();
    blockedExternalUrls = [];
    await page.route('**/*', async (route) => {
      const url = route.request().url();
      if (forbiddenExternalDomains.some((domain) => url.includes(domain))) {
        blockedExternalUrls.push(url);
        await route.abort();
        return;
      }
      await route.continue();
    });
    await setupShellStubs(page);
    await loginAsAlumnoMock(page);
    await setupAppConfigStubs(page);
    await setupCallejeroInterceptors(page, currentState);
  });

  test.afterEach(() => {
    expect(blockedExternalUrls).toEqual([]);
  });

  test('carga el mapa, la atribución y la pestaña Recorridos (v3)', async ({
    page,
  }) => {
    const frame = await irACallejero(page);
    // Atribución obligatoria del mapa.
    await expect(frame.locator('#attrib')).toContainText('OpenStreetMap');
    await expect(frame.locator('#tabRecorridos')).toBeVisible();
  });

  test('navega a la pestaña Recorridos y muestra el buscador + dificultad', async ({
    page,
  }) => {
    const frame = await irACallejero(page);
    await frame.locator('#tabRecorridos').click();
    await expect(frame.locator('#paneRecorridos')).toHaveClass(/act/);
    await expect(frame.locator('#recTexto')).toBeVisible();
    await expect(frame.locator('#recBtnTrazar')).toBeVisible();
  });

  test('Recorridos: permite seleccionar la dificultad del modo pregunta', async ({
    page,
  }) => {
    const frame = await irACallejero(page);
    await frame.locator('#tabRecorridos').click();
    await frame.locator('#recModoPregunta').check();
    await expect(frame.locator('#recPreguntaBox')).toBeVisible();
    await frame.locator('#difRec button[data-d="dificil"]').click();
    await expect(frame.locator('#difRec button[data-d="dificil"]')).toHaveClass(
      /on/,
    );
  });

  test('el embed reintenta una petición propia una vez tras 401 con el JWT nuevo', async ({
    page,
  }) => {
    const refreshRequests: Request[] = [];
    const geocodeRequests: Request[] = [];
    let rejectFirstGeocode = true;

    page.on('request', (request) => {
      if (
        request.url().includes('/auth/refresh') &&
        request.method() === 'POST'
      ) {
        refreshRequests.push(request);
      }
      if (
        request.url().includes('/callejero/geocode/buscar') &&
        new URL(request.url()).searchParams.get('q') === 'Calle API Real'
      ) {
        geocodeRequests.push(request);
      }
    });

    await page.route(/\/auth\/refresh\/?$/, (route) =>
      route.request().method() === 'POST'
        ? route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              access_token: 'fresh-iframe-token',
              refresh_token: 'fresh-iframe-refresh-token',
            }),
          })
        : route.fallback(),
    );
    await page.route(/\/callejero\/geocode\/buscar\?/, (route) => {
      const url = new URL(route.request().url());
      if (
        url.searchParams.get('q') === 'Calle API Real' &&
        rejectFirstGeocode
      ) {
        rejectFirstGeocode = false;
        return route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'expired' }),
        });
      }
      return route.fallback();
    });

    const frame = await irACallejero(page);
    await frame.locator('#tabRecorridos').click();
    await frame.locator('#recTexto').fill('Calle API Real');
    await frame.locator('#recBtnTrazar').click();
    await expect(frame.locator('#rpBody')).toContainText('Parc API', {
      timeout: 12_000,
    });

    expect(refreshRequests).toHaveLength(1);
    expect(geocodeRequests).toHaveLength(2);
    expect(geocodeRequests[0].headers()['authorization']).toMatch(/^Bearer /);
    expect(geocodeRequests[1].headers()['authorization']).toBe(
      'Bearer fresh-iframe-token',
    );
  });

  test('una búsqueda A tardía no pisa el recorrido B que terminó antes', async ({
    page,
  }) => {
    let releaseA!: () => void;
    let markAStarted!: () => void;
    const aStarted = new Promise<void>((resolve) => {
      markAStarted = resolve;
    });
    const aRelease = new Promise<void>((resolve) => {
      releaseA = resolve;
    });

    await page.route(/\/callejero\/geocode\/buscar\?/, async (route) => {
      const query = new URL(route.request().url()).searchParams.get('q');
      if (query === 'A') {
        markAStarted();
        await aRelease;
        try {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              items: [{ nombre: 'Destino A', lat: 39.45, lng: -0.35 }],
            }),
          });
        } catch (_) {
          // La petición A puede haber sido abortada por la nueva búsqueda.
        }
        return;
      }
      if (query === 'B') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            items: [{ nombre: 'Destino B', lat: 39.46, lng: -0.36 }],
          }),
        });
        return;
      }
      await route.fallback();
    });

    const frame = await irACallejero(page);
    await frame.locator('#tabRecorridos').click();
    const input = frame.locator('#recTexto');
    await input.fill('A');
    const firstSearch = frame.locator('#recBtnTrazar').click();
    await aStarted;

    await input.fill('B');
    await frame.locator('#recBtnTrazar').click();
    await expect(frame.locator('#rpBody')).toContainText('Destino B', {
      timeout: 12_000,
    });
    await expect(frame.locator('#rpBody')).toContainText('Avenida API');

    releaseA();
    await firstSearch;
    await expect(frame.locator('#rpTit')).toContainText('Destino B');
    await expect(frame.locator('#rpBody')).not.toContainText('Destino A');
    expect(
      await frame.locator('#map .leaflet-overlay-pane path').count(),
    ).toBeGreaterThan(0);
  });

  test('usa Valencia por slug, muestra la ruta de la API y reutiliza cache de sesión', async ({
    page,
  }) => {
    let frame = await irACallejero(page);
    await expect(frame.locator('#callejeroEstado')).toContainText('1', {
      timeout: 12_000,
    });
    expect(currentState.callesApiCalls).toBe(1);
    expect(currentState.ciudadesApiCalls).toBe(1);

    await frame.locator('#tabRecorridos').click();
    await frame.locator('#recTexto').fill('Calle API Real');
    await frame.locator('#recBtnTrazar').click();
    await expect(frame.locator('#rpBody')).toContainText('Parc API', {
      timeout: 12_000,
    });
    await expect(frame.locator('#rpBody')).toContainText('Avenida API');
    await expect(frame.locator('#rpBody')).toContainText('2.1 km');
    expect(currentState.routeApiCalls).toBe(1);

    const cacheKeysBeforeReload = await page.evaluate(() =>
      Object.keys(sessionStorage).filter((key) =>
        key.startsWith('tf_viales_v6'),
      ),
    );
    expect(cacheKeysBeforeReload).toContain('tf_viales_v6:valencia');
    expect(
      await page.evaluate(() =>
        Object.keys(localStorage).filter((key) =>
          /tf_viales_v5|tf_geo_|tf_salida/.test(key),
        ),
      ),
    ).toEqual([]);

    await page.reload();
    frame = await irACallejero(page);
    await expect(frame.locator('#callejeroEstado')).toContainText('1', {
      timeout: 8_000,
    });
    expect(currentState.ciudadesApiCalls).toBe(2);
    expect(currentState.callesApiCalls).toBe(1);
    expect(
      await page.evaluate(() =>
        Object.keys(sessionStorage).some((key) => key.includes('tf_viales_v5')),
      ),
    ).toBe(false);
  });

  test('coalesce consumidores concurrentes de la carga inicial del callejero', async ({
    page,
  }) => {
    let releaseFirstCity!: () => void;
    let markFirstCityStarted!: () => void;
    let firstCitySeen = false;
    const firstCityStarted = new Promise<void>((resolve) => {
      markFirstCityStarted = resolve;
    });
    const firstCityRelease = new Promise<void>((resolve) => {
      releaseFirstCity = resolve;
    });

    // Retiene la primera autorización para que dos consumidores puedan entrar
    // en cargarViales() mientras resolverCiudad() sigue pendiente.
    await page.route('**/callejero/ciudades', async (route) => {
      if (!isXhr(route.request())) return route.fallback();
      if (!firstCitySeen) {
        firstCitySeen = true;
        markFirstCityStarted();
        await firstCityRelease;
      }
      return route.fallback();
    });

    try {
      const frame = await irACallejero(page);
      await firstCityStarted;
      const embed = page
        .frames()
        .find(
          (candidate) =>
            candidate !== page.mainFrame() &&
            candidate.url().includes('callejero-embed/valencia_27.html'),
        );
      if (!embed) throw new Error('No se encontró el frame del callejero');

      // El arranque ya tiene un consumidor bloqueado. Añade dos consumidores
      // explícitos antes de liberar la autorización compartida.
      const concurrentLoads = embed.evaluate(() => {
        const scope = globalThis as typeof globalThis & {
          cargarViales?: () => Promise<unknown>;
          __tfConcurrentLoadStarted?: boolean;
        };
        const load = scope.cargarViales;
        if (typeof load !== 'function') {
          throw new Error('cargarViales no está expuesto en el embed');
        }
        scope.__tfConcurrentLoadStarted = true;
        return Promise.all([load(), load()]);
      });
      await expect
        .poll(
          () =>
            embed.evaluate(() =>
              Boolean(
                (
                  globalThis as typeof globalThis & {
                    __tfConcurrentLoadStarted?: boolean;
                  }
                ).__tfConcurrentLoadStarted,
              ),
            ),
          { timeout: 3_000 },
        )
        .toBe(true);
      releaseFirstCity();
      await concurrentLoads;

      await expect(frame.locator('#callejeroEstado')).toContainText('1', {
        timeout: 12_000,
      });
      expect(currentState.ciudadesApiCalls).toBe(1);
      expect(currentState.callesApiCalls).toBe(1);
    } finally {
      releaseFirstCity();
    }
  });

  test('no reutiliza el cache de otra cuenta si Valencia está denegada', async ({
    page,
  }) => {
    let frame = await irACallejero(page);
    await expect(frame.locator('#callejeroEstado')).toContainText('1', {
      timeout: 12_000,
    });
    expect(currentState.callesApiCalls).toBe(1);

    const cache = await page.evaluate(() =>
      sessionStorage.getItem('tf_viales_v6:valencia'),
    );
    expect(cache).toBeTruthy();

    // Simula logout y login con otra cuenta conservando únicamente el catálogo
    // que la cuenta anterior dejó en sessionStorage.
    currentState.valenciaAutorizada = false;
    await page.evaluate((cached) => {
      sessionStorage.clear();
      if (cached) sessionStorage.setItem('tf_viales_v6:valencia', cached);
    }, cache);
    await loginAsRoleMock(page, {
      rol: 'ALUMNO',
      email: 'otro-alumno@example.invalid',
      userFixture: userAlumnoFixture,
    });

    frame = await irACallejero(page);
    await expect
      .poll(() => currentState.ciudadesApiCalls, { timeout: 8_000 })
      .toBe(2);
    expect(currentState.callesApiCalls).toBe(1);
    await expect(frame.locator('#listas')).not.toContainText('Calle API Real');
    await expect(frame.locator('#callejeroEstado')).not.toContainText(
      'calles cargadas',
    );
  });
});
