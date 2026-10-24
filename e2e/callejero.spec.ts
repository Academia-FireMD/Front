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
import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createContext, runInContext } from 'node:vm';
import { loginAsRoleMock } from './helpers/auth.helper';
import callejero from './fixtures/callejero-valencia.json';
import userAlumnoFixture from './fixtures/user-alumno.json';

const PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEAQH/XPWsWQAAAABJRU5ErkJggg==',
  'base64',
);

/** Stub versionado (sin clave). En los tests se inyecta una clave ficticia. */
const MAPAS_CONFIG_SRC = readFileSync(
  resolve(__dirname, '../public/callejero-embed/mapas-config.js'),
  'utf8',
);
function mapasConfigConClave(clave: string): string {
  return MAPAS_CONFIG_SRC.replace("cartoKey: ''", `cartoKey: '${clave}'`);
}
async function servirMapasConfig(page: Page, clave: string | null): Promise<void> {
  await page.route('**/mapas-config.js', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: clave ? mapasConfigConClave(clave) : MAPAS_CONFIG_SRC,
    }),
  );
}

/** Intercepta teselas externas: falla los hosts indicados, sirve píxel al resto. */
async function instalarTeselas(
  page: Page,
  hostsEnFallo: Set<string>,
  solicitudes: Request[],
): Promise<void> {
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (['localhost', '127.0.0.1'].includes(url.hostname)) {
      await route.fallback();
      return;
    }
    const tileHosts = [
      'tile.openstreetmap.org',
      'basemaps.cartocdn.com',
      'arcgisonline.com',
      'ign.es',
      'idee.es',
      'opentopomap.org',
    ];
    if (!tileHosts.some((h) => url.hostname === h || url.hostname.endsWith(`.${h}`))) {
      await route.fallback();
      return;
    }
    solicitudes.push(route.request());
    const enFallo = [...hostsEnFallo].some(
      (h) => url.hostname === h || url.hostname.endsWith(`.${h}`),
    );
    if (enFallo) {
      await route.abort('failed');
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'image/png',
      headers: {
        'access-control-allow-origin': '*',
        'cache-control': 'no-store',
      },
      body: PIXEL_PNG,
    });
  });
}

function hostnameDe(request: Request): string {
  return new URL(request.url()).hostname;
}
function peticionesA(solicitudes: Request[], host: string): Request[] {
  return solicitudes.filter(
    (r) => r.url().length > 0 && (hostnameDe(r) === host || hostnameDe(r).endsWith(`.${host}`)),
  );
}

/**
 * Nivel de zoom (tilematrix) pedido por una tesela, admitiendo OSM/Esri/OpenTopo
 * (/…/z/…) e IGN/IDEE (?tilematrix=).
 */
function zoomDe(request: Request): number {
  const raw = request.url();
  const tilematrix = new URL(raw).searchParams.get('tilematrix');
  if (tilematrix) return Number(tilematrix);
  const zParam = raw.match(/[?&]z=(\d+)(?:&|$)/);
  if (zParam) return Number(zParam[1]);
  const match = new URL(raw).pathname.match(/\/(\d+)\/\d+\/\d+(?:\.\w+)?$/);
  return match ? Number(match[1]) : Number.NaN;
}

/** Pulsa zoom-in hasta el máximo del mapa (el botón se deshabilita al llegar). */
async function subirZoomAlMaximo(
  frame: FrameLocator,
  page: Page,
): Promise<void> {
  const zoomIn = frame.locator('.leaflet-control-zoom-in');
  for (let i = 0; i < 25; i += 1) {
    const deshabilitado = await zoomIn.evaluate((el) =>
      el.classList.contains('leaflet-disabled'),
    );
    if (deshabilitado) break;
    await zoomIn.click();
    await page.waitForTimeout(300);
  }
}

const userAlumnoValenciaFixture = {
  ...userAlumnoFixture,
  suscripciones: userAlumnoFixture.suscripciones.map((suscripcion) => ({
    ...suscripcion,
    oposicion: 'VALENCIA_AYUNTAMIENTO',
  })),
};

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
      body: JSON.stringify(userAlumnoValenciaFixture),
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
  geocodeQueries: string[];
  routeApiCalls: number;
  routeQueries: string[];
  routeApiUnavailable: boolean;
  routePayload: unknown | null;
  valenciaAutorizada: boolean;
  escriturasProgresoEmbed: { method: string; body: unknown }[];
}

function freshState(): CallejeroState {
  return {
    progresoCalls: [],
    dominadas: {},
    ciudadesApiCalls: 0,
    callesApiCalls: 0,
    geocodeApiCalls: 0,
    geocodeQueries: [],
    routeApiCalls: 0,
    routeQueries: [],
    routeApiUnavailable: false,
    routePayload: null,
    valenciaAutorizada: true,
    escriturasProgresoEmbed: [],
  };
}

function estadoValenciaEscrito(
  state: CallejeroState,
): Record<string, unknown> | null {
  const escritura = [...state.escriturasProgresoEmbed]
    .reverse()
    .find(({ method }) => method === 'PUT' || method === 'POST');
  if (!escritura?.body || typeof escritura.body !== 'object') return null;
  const estado = (escritura.body as { estado?: unknown }).estado;
  return estado && typeof estado === 'object' && !Array.isArray(estado)
    ? (estado as Record<string, unknown>)
    : null;
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
  let progresoRemoto: Record<string, unknown> | null = null;
  let revisionProgreso = 0;
  await page.route('**/callejero/mi-progreso/valencia**', async (route) => {
    const method = route.request().method();
    const url = new URL(route.request().url());
    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          modalidad: 'valencia',
          versionFormato: 1,
          revision: revisionProgreso,
          estado: progresoRemoto,
          actualizadoEn: revisionProgreso ? '2026-10-24T09:00:00.000Z' : null,
        }),
      });
      return;
    }
    if (method === 'PUT' || method === 'POST') {
      const body = route.request().postDataJSON() as {
        estado?: Record<string, unknown>;
      };
      state.escriturasProgresoEmbed.push({ method, body });
      progresoRemoto = body.estado ?? null;
      revisionProgreso += 1;
      const importada = url.pathname.endsWith('/importar');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          modalidad: 'valencia',
          versionFormato: 1,
          revision: revisionProgreso,
          estado: progresoRemoto,
          actualizadoEn: '2026-10-24T09:00:01.000Z',
          ...(importada ? { importado: true } : {}),
        }),
      });
      return;
    }
    if (method === 'DELETE') {
      state.escriturasProgresoEmbed.push({ method, body: null });
      progresoRemoto = null;
      revisionProgreso += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          modalidad: 'valencia',
          versionFormato: 1,
          revision: revisionProgreso,
          estado: null,
          actualizadoEn: '2026-10-24T09:00:02.000Z',
        }),
      });
      return;
    }
    await route.fallback();
  });

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
    state.geocodeQueries.push(url.searchParams.get('q') ?? '');
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
    const url = new URL(route.request().url());
    state.routeQueries.push(url.searchParams.get('q') ?? '');
    if (state.routeApiUnavailable) {
      return route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'ROUTE_UNAVAILABLE' }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        state.routePayload ?? {
          direccionResuelta: url.searchParams.get('q') ?? 'Calle API Real',
          lat: 39.45,
          lng: -0.35,
          parqueNombre: 'Parc API',
          calles: ['Carrer de la Reina', 'Carrer de Xàtiva'],
          estacion: { nombre: 'Parc API', lat: 39.44, lng: -0.34 },
          polyline: [
            [39.45, -0.35],
            [39.46, -0.36],
          ],
          km: 2.1,
          minutos: 6,
        },
      ),
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

interface PreguntaExamen {
  tipo: string;
  poi: {
    n: string;
    c: string;
    lat: number;
    lng: number;
  } | null;
  zona: { Parque: string; Coopera: string } | null;
  mod: { nuevo: string; antiguo: string } | null;
  direccion: string | null;
}

async function planExamen(frame: FrameLocator): Promise<PreguntaExamen[]> {
  return frame.locator('html').evaluate(() =>
    eval(
      `EX.qs.map(q=>({tipo:q.tipo,poi:q.poi?{n:q.poi.n,c:q.poi.c,lat:q.poi.lat,lng:q.poi.lng}:null,zona:q.zona?{Parque:q.zona.Parque,Coopera:q.zona.Coopera}:null,mod:q.mod?{nuevo:q.mod.nuevo,antiguo:q.mod.antiguo}:null,direccion:q._dir||null}))`,
    ),
  ) as Promise<PreguntaExamen[]>;
}

async function preguntaActual(frame: FrameLocator): Promise<PreguntaExamen> {
  return frame.locator('html').evaluate(() =>
    eval(
      `(()=>{const q=EX.qs[EX.i];return {tipo:q.tipo,poi:q.poi?{n:q.poi.n,c:q.poi.c,lat:q.poi.lat,lng:q.poi.lng}:null,zona:q.zona?{Parque:q.zona.Parque,Coopera:q.zona.Coopera}:null,mod:q.mod?{nuevo:q.mod.nuevo,antiguo:q.mod.antiguo}:null,direccion:q._dir||null};})()`,
    ),
  ) as Promise<PreguntaExamen>;
}

async function elegirOpcion(
  frame: FrameLocator,
  selector: string,
  valor: string,
  correcta: boolean,
): Promise<void> {
  const opciones = frame.locator(selector);
  const indice = await opciones.evaluateAll(
    (elements, target) =>
      elements.findIndex((element) => {
        const button = element as HTMLButtonElement;
        const actual = button.dataset['v'] ?? button.textContent?.trim() ?? '';
        return target.correcta ? actual === target.valor : actual !== target.valor;
      }),
    { valor, correcta },
  );
  if (indice < 0) throw new Error(`No se encontró opción para ${selector}: ${valor}`);
  await opciones.nth(indice).click();
}

async function responderPregunta(frame: FrameLocator, correcta: boolean): Promise<void> {
  const pregunta = await preguntaActual(frame);
  if (pregunta.tipo === 'localiza') {
    if (!pregunta.poi) throw new Error('La pregunta de localización no tiene POI');
    const punto = await frame.locator('#map').evaluate(
      (element, target) => {
        const mapa = eval('map') as {
          setView: (center: [number, number], zoom: number, options: object) => void;
          latLngToContainerPoint: (latlng: [number, number]) => { x: number; y: number };
        };
        mapa.setView([target.poi.lat, target.poi.lng], target.correcta ? 15 : 12.5, {
          animate: false,
        });
        const lat = target.correcta ? target.poi.lat : target.poi.lat + 0.02;
        const lng = target.correcta ? target.poi.lng : target.poi.lng + 0.02;
        const point = mapa.latLngToContainerPoint([lat, lng]);
        const rect = element.getBoundingClientRect();
        return {
          x: Math.max(4, Math.min(rect.width - 4, point.x)),
          y: Math.max(4, Math.min(rect.height - 4, point.y)),
        };
      },
      { poi: pregunta.poi, correcta },
    );
    await frame.locator('#map').click({ position: punto });
  } else if (pregunta.tipo === 'calleRapida') {
    if (!pregunta.zona) throw new Error('La pregunta rápida no tiene zona');
    await elegirOpcion(frame, '#crParque button', pregunta.zona.Parque, correcta);
    await elegirOpcion(frame, '#crCoopera button', pregunta.zona.Coopera, correcta);
    await frame.locator('#crComprobar').click();
  } else {
    const valor =
      pregunta.tipo === 'zona'
        ? pregunta.zona?.Parque
        : pregunta.tipo === 'coopera'
          ? pregunta.zona?.Coopera
          : pregunta.tipo === 'modificada' && pregunta.mod
            ? pregunta.direccion === 'antes'
              ? pregunta.mod.antiguo
              : pregunta.mod.nuevo
            : null;
    if (!valor) throw new Error(`No hay respuesta para el tipo ${pregunta.tipo}`);
    await elegirOpcion(frame, '#qopts > button', valor, correcta);
  }
  await expect(frame.locator('#qfb')).toHaveClass(/show/);
  if (!correcta && pregunta.poi && pregunta.tipo !== 'calleRapida') {
    await expect(frame.locator('#card')).toHaveClass(/show/, { timeout: 2_000 });
    await frame.locator('#cardCerrar').click();
  }
}

test.describe('Módulo Callejero (alumno)', () => {
  const forbiddenExternalDomains = [
    'overpass.private.coffee',
    'overpass-api.de',
    'overpass.kumi.systems',
    'maps.mail.ru',
    'nominatim.openstreetmap.org',
    'router.project-osrm.org',
    'openstreetmap.fr',
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
    await loginAsRoleMock(page, {
      rol: 'ALUMNO',
      email: 'alumno@test.com',
      userFixture: userAlumnoValenciaFixture,
    });
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

  test('las calles usa teselas OSM estándar, atribución y Referer del embed', async ({
    page,
  }) => {
    const solicitudes: Request[] = [];
    await instalarTeselas(page, new Set(), solicitudes);

    const frame = await irACallejero(page);
    await expect(frame.locator('#attrib')).toContainText('OpenStreetMap');
    await expect
      .poll(
        () => peticionesA(solicitudes, 'tile.openstreetmap.org').length,
        { timeout: 12_000 },
      )
      .toBeGreaterThan(0);

    const osm = peticionesA(solicitudes, 'tile.openstreetmap.org');
    expect(new URL(osm[0].url()).pathname).toMatch(/^\/\d+\/\d+\/\d+\.png$/);
    expect(osm[0].headers()['referer']).toContain('localhost');
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

  test('el dataset bilingüe v32 trae 3162 viales y las búsquedas locales ignoran acentos y alias', async ({
    page,
  }) => {
    const frame = await irACallejero(page);
    await expect(frame.locator('#callejeroEstado')).toContainText(
      '3.162 calles · OpenStreetMap · incluido en la app (2026-10-21)',
      { timeout: 12_000 },
    );
    expect(currentState.callesApiCalls).toBe(0);

    await frame.locator('#tabEstudio').click();
    const buscar = frame.locator('#buscar');
    for (const [consulta, resultado] of [
      ['jativa', 'Xàtiva'],
      ['paz', 'Pau'],
      ['9 de octubre', "Nou d'Octubre"],
      ['economista gay', 'Just Ramírez'],
    ]) {
      await buscar.fill(consulta);
      await expect(frame.locator('#listas')).toContainText(resultado);
    }
  });

  test('no expone el dataset v32 cuando Valencia no autoriza la sesión', async ({
    page,
  }) => {
    currentState.valenciaAutorizada = false;
    const frame = await irACallejero(page);

    await expect
      .poll(() => currentState.ciudadesApiCalls, { timeout: 8_000 })
      .toBeGreaterThan(0);
    await expect(frame.locator('#callejeroEstado')).not.toContainText(
      '3.162 calles',
    );
    expect(currentState.callesApiCalls).toBe(0);
  });

  test('el Centre Històric no aparece en capas, listas, parques ni preguntas', async ({
    page,
  }) => {
    const frame = await irACallejero(page);
    await frame.locator('#tabEstudio').click();
    await expect(frame.locator('#listas')).toContainText('Parques de bomberos (5)');
    await frame.locator('#buscar').fill('Centre Històric');
    await expect(frame.locator('#listas')).not.toContainText('Centre Històric');

    await frame.locator('#tabMapa').click();
    await expect(
      frame.locator('#tgl_bomberos').locator('xpath=..').locator('.num'),
    ).toHaveText('5');
    const markers = await frame.locator('html').evaluate(() =>
      eval(
        `({fire:capas.bomberos.getLayers().length,stations:capaEst.getLayers().length,zones:PARQUES.slice(),questionFire:POIS.filter(p=>p.c==='bomberos').map(p=>p.n)})`,
      ),
    );
    expect(markers).toEqual({
      fire: 5,
      stations: 5,
      zones: expect.arrayContaining(['Campanar', 'Norte', 'Oeste', 'Sur', 'Saler']),
      questionFire: expect.arrayContaining([
        'Parque Central de Bomberos (Av. de la Plata)',
        'Parque de Bomberos Campanar',
        'Parque de Bomberos Norte (Benimaclet)',
        'Parque de Bomberos Oeste (L’Olivereta)',
        'Parque de Bomberos de la Devesa (El Saler)',
      ]),
    });
    expect(markers.zones).toHaveLength(5);
    expect(markers.questionFire).toHaveLength(5);
    expect(JSON.stringify(markers)).not.toMatch(/centre hist[oò]ric|centro hist[oó]rico/i);

    await frame.locator('#tabExamen').click();
    await expect(frame.locator('#zonaExam .zona-chip')).toHaveCount(5);
    await frame.locator('#cfgN').selectOption({ label: '40' });
    await frame.locator('#btnEmpezar').click();
    const preguntasBomberos = await frame.locator('html').evaluate(() =>
      eval(
        `EX.qs.filter(q=>q.poi&&q.poi.c==='bomberos').map(q=>q.poi.n)`,
      ),
    );
    expect(preguntasBomberos.join(' ')).not.toMatch(/centre hist[oò]ric|centro hist[oó]rico/i);
  });

  test('sanea el legado al migrarlo sin modificar la copia de solo lectura', async ({
    page,
  }) => {
    const history = String.raw`{"asked":{"p|Hospital Clínico Universitario":4,"m|Pl. de la Llotgeta":2,"v|Carrer de la Pau|39.4700,-0.3700":3,"p|Parque de Bomberos Centre Històric":7,"v|dato inválido":"3","constructor":99,"__proto__":{"polluted":true}},"fallos":{"p|Hospital Clínico Universitario":{"n":2,"t":1700000000000,"q":{"poi":{"n":"Hospital Clínico Universitario","c":"hospital","lat":39.478678,"lng":-0.36129,"_m":{"leaflet":true},"_ix":{"bad":true},"datoPrivado":"quitar"},"zona":{"Parque":"Norte","Coopera":"Nord","AreaName":"Norte","nombre":"Zona Norte","polys":[[[39,-0.3],[40,-0.3],[40,-0.4]]]},"tipo":"localiza","extra":"quitar"}},"m|Pl. de la Llotgeta":{"n":1,"t":1700000000001,"q":{"mod":{"nuevo":"Pl. de la Llotgeta","antiguo":"Pl. dels Màrtirs"},"tipo":"modificada","extra":"quitar"}},"p|Hospital Casa de Salud (La Salud)":{"n":1,"t":1700000000003,"q":{"poi":{"n":"Hospital Casa de Salud (La Salud)","c":"hospital","lat":39.48,"lng":-0.36},"zona":{"Parque":"Norte"},"tipo":"coopera"}},"p|Parque de Bomberos Centre Històric":{"n":1,"t":1700000000002,"q":{"poi":{"n":"Parque de Bomberos Centre Històric","c":"bomberos","lat":39.477007,"lng":-0.380257},"tipo":"localiza"}},"basura":{"n":"x","q":null}}}`;
    await page.addInitScript((serialized) => {
      if (location.pathname.endsWith('/valencia_27.html')) {
        localStorage.setItem('tf_hist_v1', serialized);
      }
    }, history);

    const frame = await irACallejero(page);
    await expect(page.getByRole('status')).toContainText('Guardado en tu cuenta.');
    await expect(frame.locator('#btnEmpezar + .nota')).not.toContainText(
      'se guarda en tu navegador',
    );
    await frame.locator('#tabExamen').click();
    await expect(frame.locator('#btnRepasarFallos')).toHaveText('Repasar fallos (2)');

    const saved = await frame.locator('html').evaluate(() => eval('HIST'));
    expect(Object.keys(saved.asked).sort()).toEqual(
      [
        'm|Pl. de la Llotgeta',
        'p|Hospital Clínico Universitario',
        'v|Carrer de la Pau|39.4700,-0.3700',
      ].sort(),
    );
    expect(Object.keys(saved.fallos).sort()).toEqual(
      ['m|Pl. de la Llotgeta', 'p|Hospital Clínico Universitario'].sort(),
    );
    expect(Object.keys(saved.fallos['p|Hospital Clínico Universitario'].q).sort()).toEqual(
      ['poi', 'tipo', 'zona'],
    );
    expect(Object.keys(saved.fallos['p|Hospital Clínico Universitario'].q.poi).sort()).toEqual(
      ['c', 'lat', 'lng', 'n'],
    );
    expect(Object.keys(saved.fallos['p|Hospital Clínico Universitario'].q.zona).sort()).toEqual(
      ['AreaName', 'Coopera', 'Parque', 'nombre'],
    );
    expect(
      await frame.locator('html').evaluate(() =>
        eval(`({polluted:Object.prototype.polluted,nonOperational:Object.keys(HIST.fallos).some(k=>/centre hist[oò]ric|centro hist[oó]rico/i.test(k))})`),
      ),
    ).toEqual({ polluted: undefined, nonOperational: false });
    expect(
      await page.evaluate(() => localStorage.getItem('tf_hist_v1')),
    ).toBe(history);
    expect(currentState.escriturasProgresoEmbed[0]).toMatchObject({
      method: 'POST',
      body: {
        versionFormato: 1,
        estado: {
          asked: expect.any(Object),
          fallos: expect.any(Object),
        },
      },
    });
  });

  test('el repaso de historial legado muestra el resumen como texto y no ejecuta HTML', async ({
    page,
  }) => {
    const ataque = '<img src=x onerror="window.__histXss=1">';
    const nombrePoi = 'Hospital de prueba del historial';
    const historial = JSON.stringify({
      asked: {},
      fallos: {
        [`p|${nombrePoi}`]: {
          n: 1,
          t: 1_700_000_000_000,
          q: {
            poi: {
              n: nombrePoi,
              c: 'hospital',
              lat: 39.478678,
              lng: -0.36129,
            },
            zona: {
              Parque: ataque,
              Coopera: 'Nord',
              AreaName: 'Norte',
              nombre: 'Zona Norte',
            },
            tipo: 'zona',
          },
        },
      },
    });
    await page.addInitScript((serialized) => {
      if (!location.pathname.endsWith('/valencia_27.html')) return;
      (window as typeof window & { __histXss?: number }).__histXss = 0;
      localStorage.setItem('tf_hist_v1', serialized);
    }, historial);

    const frame = await irACallejero(page);
    await frame.locator('#tabExamen').click();
    await expect(frame.locator('#btnRepasarFallos')).toHaveText(
      'Repasar fallos (1)',
    );
    await frame.locator('#btnRepasarFallos').click();
    await expect(frame.locator('#qNum')).toContainText('/ 1');
    expect((await preguntaActual(frame)).zona?.Parque).toBe(ataque);

    await responderPregunta(frame, false);
    const feedback = await frame.locator('#qfb').evaluate((element) => ({
      text: element.textContent ?? '',
      elementosAtacantes: element.querySelectorAll('img,svg,iframe').length,
      ejecucion: (window as typeof window & { __histXss?: number }).__histXss ?? 0,
    }));
    expect(feedback.text).toContain(ataque);
    expect(feedback.elementosAtacantes).toBe(0);
    expect(feedback.ejecucion).toBe(0);
    await frame.locator('#btnSig').click();
    await expect(frame.locator('#velo')).toHaveClass(/show/);
    await expect(frame.locator('#resSub')).toContainText('repaso de fallos');

    const resumen = await frame.locator('#resTabla').evaluate((element) => ({
      text: element.textContent ?? '',
      elementosAtacantes: element.querySelectorAll('img,svg,iframe').length,
      ejecucion: (window as typeof window & { __histXss?: number }).__histXss ?? 0,
    }));
    expect(resumen).toMatchObject({ elementosAtacantes: 0, ejecucion: 0 });
    expect(resumen.text).toContain(ataque);
  });

  test('el repaso de historial muestra como texto los nombres de POI en tooltips', async ({
    page,
  }) => {
    const ataque = '<img src=x onerror="window.__histPoiXss=1">';
    const nombrePoi = `Hospital del historial ${ataque}`;
    const historial = JSON.stringify({
      asked: {},
      fallos: {
        [`p|${nombrePoi}`]: {
          n: 1,
          t: 1_700_000_000_000,
          q: {
            poi: {
              n: nombrePoi,
              c: 'hospital',
              lat: 39.478678,
              lng: -0.36129,
            },
            zona: {
              Parque: 'Norte',
              Coopera: 'Nord',
              AreaName: 'Norte',
              nombre: 'Zona Norte',
            },
            tipo: 'zona',
          },
        },
      },
    });
    await page.addInitScript((serialized) => {
      if (!location.pathname.endsWith('/valencia_27.html')) return;
      (window as typeof window & { __histPoiXss?: number }).__histPoiXss = 0;
      localStorage.setItem('tf_hist_v1', serialized);
    }, historial);

    const frame = await irACallejero(page);
    await frame.locator('#tabExamen').click();
    await frame.locator('#btnRepasarFallos').click();
    await responderPregunta(frame, false);

    const tooltipState = await frame.locator('#map').evaluate((element) => ({
      tooltipText: Array.from(element.querySelectorAll('.leaflet-tooltip'))
        .map((tooltip) => tooltip.textContent ?? '')
        .join(' '),
      elementosAtacantes: element.querySelectorAll('img[onerror]').length,
      ejecucion: (window as typeof window & { __histPoiXss?: number })
        .__histPoiXss ?? 0,
    }));
    expect(tooltipState.tooltipText).toContain(ataque);
    expect(tooltipState.elementosAtacantes).toBe(0);
    expect(tooltipState.ejecucion).toBe(0);

    await frame.locator('#btnSig').click();
    await expect(frame.locator('#velo')).toHaveClass(/show/);
    const nombreEnResumen = await frame
      .locator('#resTabla')
      .textContent();
    expect(nombreEnResumen).toContain(nombrePoi);
  });

  test('repasa cuarenta preguntas legítimas del historial y conserva el progreso', async ({
    page,
  }) => {
    const fallos = Object.fromEntries(
      Array.from({ length: 40 }, (_, index) => {
        const nombre = `Hospital historial ${String(index + 1).padStart(2, '0')}`;
        return [
          `p|${nombre}`,
          {
            n: 1,
            t: 1_700_000_000_000 + index,
            q: {
              poi: {
                n: nombre,
                c: 'hospital',
                lat: 39.478678,
                lng: -0.36129,
              },
              zona: {
                Parque: 'Norte',
                Coopera: 'Nord',
                AreaName: 'Norte',
                nombre: 'Zona Norte',
              },
              tipo: index % 2 === 0 ? 'zona' : 'coopera',
            },
          },
        ];
      }),
    );
    const historialLegado = JSON.stringify({ asked: {}, fallos });
    await page.addInitScript((serialized) => {
      if (location.pathname.endsWith('/valencia_27.html')) {
        localStorage.setItem('tf_hist_v1', serialized);
      }
    }, historialLegado);

    const frame = await irACallejero(page);
    await frame.locator('#tabExamen').click();
    await expect(frame.locator('#btnRepasarFallos')).toHaveText(
      'Repasar fallos (40)',
    );
    await frame.locator('#btnRepasarFallos').click();
    await expect(frame.locator('#qNum')).toContainText('/ 40');

    for (let index = 0; index < 40; index += 1) {
      await responderPregunta(frame, true);
      if (index < 39) await frame.locator('#btnSig').click();
    }
    await frame.locator('#btnSig').click();
    await expect(frame.locator('#velo')).toHaveClass(/show/);
    await expect(frame.locator('#resSub')).toContainText(
      '40 preguntas · tolerancia',
    );
    await expect(frame.locator('#resSub')).toContainText('repaso de fallos');
    await expect(frame.locator('#resAcierto')).toHaveText('40/40');
    await expect(frame.locator('#resTabla tr')).toHaveCount(40);

    await expect
      .poll(() => {
        const estado = estadoValenciaEscrito(currentState);
        return Object.keys(
          (estado?.['fallos'] as Record<string, unknown>) ?? {},
        ).length;
      })
      .toBe(0);
    const estadoRemoto = estadoValenciaEscrito(currentState);
    expect(
      Object.keys((estadoRemoto?.['asked'] as Record<string, unknown>) ?? {}),
    ).toHaveLength(40);
    expect(await page.evaluate(() => localStorage.getItem('tf_hist_v1'))).toBe(
      historialLegado,
    );
  });

  test('fallar bomberos y hospitales persiste en examen mixto y repasar un solo fallo lo elimina', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.addInitScript(() => {
      if (!location.pathname.endsWith('/valencia_27.html')) return;
      let seed = 0x1a2b3c4d;
      Math.random = () => {
        seed = (Math.imul(seed, 1_664_525) + 1_013_904_223) >>> 0;
        return seed / 0x1_0000_0000;
      };
    });
    let frame = await irACallejero(page);
    await frame.locator('#tabExamen').click();
    await frame.locator('#cfgN').selectOption({ label: '40' });

    let plan: PreguntaExamen[] = [];
    for (let intento = 0; intento < 8; intento += 1) {
      await frame.locator('#btnEmpezar').click();
      await expect(frame.locator('#qNum')).toContainText('/ 40');
      plan = await planExamen(frame);
      const categorias = new Set(
        plan.filter((q) => q.poi).map((q) => q.poi!.c),
      );
      if (categorias.has('bomberos') && categorias.has('hospital')) break;
      await frame.locator('#btnAbandonar').click();
    }
    const categorias = new Set(plan.filter((q) => q.poi).map((q) => q.poi!.c));
    expect(categorias.has('bomberos')).toBe(true);
    expect(categorias.has('hospital')).toBe(true);

    const fallados = new Set<string>();
    for (let i = 0; i < 40; i += 1) {
      const pregunta = await preguntaActual(frame);
      const fallar =
        !!pregunta.poi &&
        ['bomberos', 'hospital'].includes(pregunta.poi.c) &&
        !fallados.has(pregunta.poi.c);
      await responderPregunta(frame, !fallar);
      if (fallar) fallados.add(pregunta.poi!.c);
      if (i < 39) await frame.locator('#btnSig').click();
    }
    await frame.locator('#btnSig').click();
    expect([...fallados].sort()).toEqual(['bomberos', 'hospital']);
    await expect(frame.locator('#velo')).toHaveClass(/show/);

    type HistorialFallosPersistidos = {
      asked: Record<string, number>;
      fallos: Record<string, { q: { poi: { c: string } } }>;
    };
    await expect
      .poll(() => {
        const estado = estadoValenciaEscrito(currentState);
        return Object.keys(
          (estado?.['fallos'] as Record<string, unknown>) ?? {},
        ).length;
      })
      .toBe(2);
    const historyWithTwoFailures = estadoValenciaEscrito(
      currentState,
    )! as HistorialFallosPersistidos;
    const failureKeys = Object.keys(historyWithTwoFailures.fallos).sort();
    expect(failureKeys).toHaveLength(2);
    const failedCategories = Object.values(historyWithTwoFailures.fallos).map(
      (entry) => entry.q.poi.c,
    );
    expect(failedCategories).toEqual(
      expect.arrayContaining(['hospital', 'bomberos']),
    );
    expect(JSON.stringify(historyWithTwoFailures)).not.toMatch(/"_(m|ix)"|"polys"/);
    expect(await page.evaluate(() => localStorage.getItem('tf_hist_v1'))).toBeNull();

    await frame.locator('#btnCerrarRes').click();
    await page.reload();
    frame = await irACallejero(page);
    await frame.locator('#tabExamen').click();
    await expect(frame.locator('#btnRepasarFallos')).toHaveText('Repasar fallos (2)');
    await frame.locator('#btnRepasarFallos').click();
    await expect(frame.locator('#qNum')).toContainText('/ 2');
    await responderPregunta(frame, true);
    await frame.locator('#btnAbandonar').click();
    await frame.locator('#btnCerrarRes').click();
    await expect(frame.locator('#btnRepasarFallos')).toHaveText('Repasar fallos (1)');

    await expect
      .poll(() => {
        const estado = estadoValenciaEscrito(currentState);
        return Object.keys(
          (estado?.['fallos'] as Record<string, unknown>) ?? {},
        ).length;
      })
      .toBe(1);
    const historyWithOneFailure = estadoValenciaEscrito(
      currentState,
    )! as HistorialFallosPersistidos;
    expect(Object.keys(historyWithOneFailure.fallos)).toHaveLength(1);
    expect(Object.values(historyWithOneFailure.fallos)[0].q.poi.c).not.toBe(
      (await preguntaActual(frame)).poi?.c,
    );
    expect(await page.evaluate(() => localStorage.getItem('tf_hist_v1'))).toBeNull();
  });

  test('JSON de historial corrupto y almacenamiento bloqueado no impiden abrir el examen', async ({
    page,
  }) => {
    const errores: string[] = [];
    page.on('pageerror', (error) => errores.push(error.message));
    await page.addInitScript(() => {
      if (!location.pathname.endsWith('/valencia_27.html')) return;
      try {
        localStorage.setItem('tf_hist_v1', '{no es json');
      } catch (_) {}
      const getItem = Storage.prototype.getItem;
      const setItem = Storage.prototype.setItem;
      Storage.prototype.getItem = function (key) {
        if (key === 'tf_hist_v1') throw new DOMException('blocked', 'SecurityError');
        return getItem.call(this, key);
      };
      Storage.prototype.setItem = function (key, value) {
        if (key === 'tf_hist_v1') throw new DOMException('quota', 'QuotaExceededError');
        return setItem.call(this, key, value);
      };
    });

    const frame = await irACallejero(page);
    await expect(frame.locator('#callejeroEstado')).toContainText('3.162');
    await frame.locator('#tabExamen').click();
    await frame.locator('#cfgN').selectOption({ label: '5' });
    await frame.locator('#btnEmpezar').click();
    await expect(frame.locator('#qNum')).toContainText('/ 5');
    expect(errores).toEqual([]);
  });

  test('una búsqueda A tardía no pisa el recorrido B que terminó antes', async ({
    page,
  }) => {
    const consultaA = 'CalleForáneaPuestoA937461';
    const consultaB = 'CalleForáneaPuestoB937461';
    const consultasGeocodeadas: string[] = [];
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
      if (query === consultaA) {
        consultasGeocodeadas.push(query);
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
      if (query === consultaB) {
        consultasGeocodeadas.push(query);
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
    await input.fill(consultaA);
    const firstSearch = frame.locator('#recBtnTrazar').click();
    await aStarted;

    await input.fill(consultaB);
    await frame.locator('#recBtnTrazar').click();
    await expect(frame.locator('#rpBody')).toContainText('Destino B', {
      timeout: 12_000,
    });
    await expect(frame.locator('#rpBody')).toContainText('Destino B');

    releaseA();
    await firstSearch;
    await expect(frame.locator('#rpTit')).toContainText('Destino B');
    await expect(frame.locator('#rpBody')).not.toContainText('Destino A');
    expect(consultasGeocodeadas).toEqual([consultaA, consultaB]);
    expect(
      await frame.locator('#map .leaflet-overlay-pane path').count(),
    ).toBeGreaterThan(0);
  });

  test('usa Valencia por slug, muestra recorrido canónico de la API y no persiste el dataset', async ({
    page,
  }) => {
    let frame = await irACallejero(page);
    await expect(frame.locator('#callejeroEstado')).toContainText('3.162', {
      timeout: 12_000,
    });
    expect(currentState.callesApiCalls).toBe(0);
    expect(currentState.ciudadesApiCalls).toBeGreaterThan(0);

    await frame.locator('#tabRecorridos').click();
    await frame.locator('#recTexto').fill('Calle API Real');
    await frame.locator('#recBtnTrazar').click();
    await expect(frame.locator('#rpBody')).toContainText('Parc API', {
      timeout: 12_000,
    });
    await expect(frame.locator('#rpBody')).toContainText('Calle API Real');
    await expect(frame.locator('#rpBody')).toContainText('Carrer de Xàtiva');
    await expect(frame.locator('#rpBody')).toContainText('2.1 km');
    expect(currentState.routeApiCalls).toBe(1);
    expect(currentState.routeQueries).toEqual(['Calle API Real']);

    expect(
      await page.evaluate(() =>
        Object.keys(localStorage).filter((key) =>
          /tf_viales_|tf_geo_|tf_salida/.test(key),
        ),
      ),
    ).toEqual([]);

    await page.reload();
    frame = await irACallejero(page);
    await expect(frame.locator('#callejeroEstado')).toContainText('3.162', {
      timeout: 8_000,
    });
    expect(currentState.ciudadesApiCalls).toBeGreaterThan(1);
    expect(currentState.callesApiCalls).toBe(0);
    expect(
      await page.evaluate(() =>
        Object.keys(sessionStorage).some((key) => key.startsWith('tf_viales_')),
      ),
    ).toBe(false);
  });

  test('la capa de calles modificadas usa la cache válida y geocodifica solo el vial no local restante', async ({
    page,
  }) => {
    const calleCacheKey = JSON.stringify([
      'Pl. de Francisco Javier Goerlich Lleó',
      'Pl. de Federico Mayo',
      'pl',
    ]);
    const calleSinCacheKey = JSON.stringify([
      "Pl. de l'Equip Crònica",
      'Pl. de Francisco Bosch i Ariño',
      'pl',
    ]);
    await page.addInitScript(() => {
      localStorage.setItem(
        'tf_mod_v1:valencia',
        JSON.stringify({
          version: 1,
          entries: {
            [JSON.stringify([
              'Pl. de Francisco Javier Goerlich Lleó',
              'Pl. de Federico Mayo',
              'pl',
            ])]: {
              nombre: 'Plaça de Francisco Javier Goerlich Lleó',
              lat: 39.4705,
              lng: -0.3795,
            },
          },
        }),
      );
    });

    const frame = await irACallejero(page);
    const embed = page
      .frames()
      .find(
        (candidate) =>
          candidate !== page.mainFrame() &&
          candidate.url().includes('callejero-embed/valencia_27.html'),
      );
    if (!embed) throw new Error('No se encontró el frame del callejero');

    await frame.locator('#tglMod').check();
    await expect
      .poll(
        () => embed.evaluate(() => eval('modListo')),
        { timeout: 20_000 },
      )
      .toBe(true);

    expect(
      await embed.evaluate(() =>
        eval(
          `({marcadores:capaMod.getLayers().length,completo:modListo})`,
        ),
      ),
    ).toEqual({ marcadores: 52, completo: true });
    expect(currentState.geocodeApiCalls).toBe(1);
    expect(currentState.geocodeQueries).toEqual([
      "Plaça de l'Equip Crònica, València, España",
    ]);
    expect(currentState.geocodeQueries).not.toContain(
      "Avinguda de l'Oest, València, España",
    );
    expect(currentState.geocodeQueries).not.toContain(
      'Manuela Solís Claràs, València, España',
    );

    const cache = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('tf_mod_v1:valencia') ?? 'null') as {
        entries: Record<string, { nombre: string; lat: number; lng: number }>;
      },
    );
    expect(Object.keys(cache.entries).sort()).toEqual(
      [calleCacheKey, calleSinCacheKey].sort(),
    );
    expect(cache.entries[calleSinCacheKey]).toEqual({
      nombre: 'Calle API Real',
      lat: 39.45,
      lng: -0.35,
    });
  });

  test('comparte la cache de modificadas entre localizaMod y la capa', async ({
    page,
  }) => {
    const frame = await irACallejero(page);
    const embed = page
      .frames()
      .find(
        (candidate) =>
          candidate !== page.mainFrame() &&
          candidate.url().includes('callejero-embed/valencia_27.html'),
      );
    if (!embed) throw new Error('No se encontró el frame del callejero');

    await embed.evaluate(async () => {
      const scope = globalThis as typeof globalThis & {
        localizaMod?: (
          nuevo: string,
          antiguo: string,
          tipo?: string,
        ) => Promise<void>;
      };
      if (typeof scope.localizaMod !== 'function') {
        throw new Error('No se encontró localizaMod en el embed');
      }
      await scope.localizaMod(
        'Pl. de Francisco Javier Goerlich Lleó',
        'Pl. de Federico Mayo',
        'pl',
      );
    });
    expect(currentState.geocodeApiCalls).toBe(1);
    expect(currentState.geocodeQueries).toEqual([
      'Plaça de Francisco Javier Goerlich Lleó, València, España',
    ]);

    await frame.locator('#tglMod').check();
    await expect
      .poll(() => currentState.geocodeApiCalls, { timeout: 20_000 })
      .toBe(2);
    await expect
      .poll(() => embed.evaluate(() => eval('modListo')), { timeout: 20_000 })
      .toBe(true);

    expect(currentState.geocodeQueries).toEqual([
      'Plaça de Francisco Javier Goerlich Lleó, València, España',
      "Plaça de l'Equip Crònica, València, España",
    ]);
    expect(
      await embed.evaluate(() =>
        eval(
          `({marcadores:capaMod.getLayers().length,completo:modListo})`,
        ),
      ),
    ).toEqual({ marcadores: 52, completo: true });

    const cache = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('tf_mod_v1:valencia') ?? 'null') as {
        entries: Record<string, { nombre: string; lat: number; lng: number }>;
      },
    );
    expect(Object.keys(cache.entries).sort()).toEqual(
      [
        JSON.stringify([
          'Pl. de Francisco Javier Goerlich Lleó',
          'Pl. de Federico Mayo',
          'pl',
        ]),
        JSON.stringify([
          "Pl. de l'Equip Crònica",
          'Pl. de Francisco Bosch i Ariño',
          'pl',
        ]),
      ].sort(),
    );
  });

  test('apagar calles modificadas aborta el geocode activo y no continúa la cola', async ({
    page,
  }) => {
    let releaseFirst!: () => void;
    let markFirstStarted!: () => void;
    const firstStarted = new Promise<void>((resolve) => {
      markFirstStarted = resolve;
    });
    const firstRelease = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let markFirstFinished!: () => void;
    const firstFinished = new Promise<void>((resolve) => {
      markFirstFinished = resolve;
    });
    let firstHeld = false;

    await page.route(/\/callejero\/geocode\/buscar\?/, async (route) => {
      if (!isXhr(route.request())) return route.fallback();
      const url = new URL(route.request().url());
      if (url.searchParams.get('ciudadId') !== '1' || firstHeld) {
        return route.fallback();
      }
      firstHeld = true;
      currentState.geocodeApiCalls += 1;
      currentState.geocodeQueries.push(url.searchParams.get('q') ?? '');
      markFirstStarted();
      await firstRelease;
      try {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            items: [{ nombre: 'Calle liberada', lat: 39.45, lng: -0.35 }],
          }),
        });
      } catch (_) {
        // Al apagar la capa, el fetch se aborta y la ruta puede quedar cerrada.
      } finally {
        markFirstFinished();
      }
    });

    try {
      const frame = await irACallejero(page);
      await frame.locator('#tglMod').check();
      await firstStarted;
      expect(currentState.geocodeApiCalls).toBe(1);

      await frame.locator('#tglMod').uncheck();
      await page.waitForTimeout(250);
      expect(currentState.geocodeApiCalls).toBe(1);
    } finally {
      releaseFirst();
      await firstFinished;
    }
    // Libera la request retenida y confirma también después de su resolución
    // que abortar la capa no reanuda la cola pendiente.
    await page.waitForTimeout(250);
    expect(currentState.geocodeApiCalls).toBe(1);
  });

  test('ignora cache hostil y conserva el contrato de clasificacion de viales', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const key = JSON.stringify([
        'Pl. de Francisco Javier Goerlich Lleó',
        'Pl. de Federico Mayo',
        'pl',
      ]);
      (window as typeof window & { __tfXss?: number }).__tfXss = 0;
      localStorage.setItem(
        'tf_mod_v1:valencia',
        JSON.stringify({
          version: 1,
          entries: {
            [key]: {
              nombre: '<img src=x onerror=window.__tfXss=1>',
              lat: 999,
              lng: 0,
            },
          },
        }),
      );
    });

    const frame = await irACallejero(page);
    const embed = page
      .frames()
      .find(
        (candidate) =>
          candidate !== page.mainFrame() &&
          candidate.url().includes('callejero-embed/valencia_27.html'),
      );
    if (!embed) throw new Error('No se encontró el frame del callejero');
    expect(
      await embed.evaluate(() =>
        localStorage.getItem('tf_mod_v1:valencia'),
      ),
    ).toBeNull();

    const clasificaciones = await embed.evaluate(async () => {
      type Vial = { nombre: string; tipo: 'av' | 'principal' | 'otra' };
      const scope = globalThis as typeof globalThis & {
        cargarViales?: () => Promise<{ n: string; t: Vial['tipo'] }[]>;
      };
      if (typeof scope.cargarViales !== 'function') {
        throw new Error('No se encontró cargarViales en el embed');
      }
      const viales = await scope.cargarViales();
      const tipos: Record<Vial['tipo'], number> = {
        av: 0,
        principal: 0,
        otra: 0,
      };
      for (const vial of viales) tipos[vial.t] += 1;
      return {
        total: viales.length,
        tipos,
        ejemplos: [
          {
            nombre: "Avinguda de l'Oest",
            tipo: viales.find((vial) => vial.n === "Avinguda de l'Oest")?.t,
          },
          {
            nombre: 'Carrer de Colón',
            tipo: viales.find((vial) => vial.n === 'Carrer de Colón')?.t,
          },
          {
            nombre: 'Carrer de Manuela Solís Claràs',
            tipo: viales.find(
              (vial) => vial.n === 'Carrer de Manuela Solís Claràs',
            )?.t,
          },
        ],
      };
    });
    expect(clasificaciones).toEqual({
      total: 3162,
      tipos: { av: 111, principal: 220, otra: 2831 },
      ejemplos: [
        { nombre: "Avinguda de l'Oest", tipo: 'av' },
        { nombre: 'Carrer de Colón', tipo: 'principal' },
        { nombre: 'Carrer de Manuela Solís Claràs', tipo: 'otra' },
      ],
    });

    await embed.evaluate(async () => {
      const scope = globalThis as typeof globalThis & {
        localizaMod?: (
          nuevo: string,
          antiguo: string,
          tipo?: string,
        ) => Promise<void>;
      };
      if (typeof scope.localizaMod !== 'function') {
        throw new Error('No se encontró localizaMod en el embed');
      }
      await scope.localizaMod(
        'Pl. de Francisco Javier Goerlich Lleó',
        'Pl. de Federico Mayo',
        'pl',
      );
    });
    expect(currentState.geocodeApiCalls).toBe(1);
    expect(currentState.geocodeQueries).toEqual([
      'Plaça de Francisco Javier Goerlich Lleó, València, España',
    ]);
    expect(
      await embed.evaluate(() =>
        Boolean((window as typeof window & { __tfXss?: number }).__tfXss),
      ),
    ).toBe(false);
    expect(await frame.locator('#map img[onerror]').count()).toBe(0);
  });

  test('los tooltips de viales tratan nombres externos como texto', async ({
    page,
  }) => {
    const xssPayload = '<img src=x onerror="window.__tfXss=1">';
    await page.addInitScript(() => {
      (window as typeof window & { __tfXss?: number }).__tfXss = 0;
    });
    await page.route(
      /\/callejero-embed\/valencia_27\.html(?:\?|$)/,
      async (route) => {
        const response = await route.fetch();
        const html = await response.text();
        const dataScript = html.match(
          /(<script type="application\/json" id="viales-data">)([\s\S]*?)(<\/script>)/,
        );
        if (!dataScript) throw new Error('No se encontró el dataset v32');

        const data = JSON.parse(dataScript[2]) as {
          rows: (string | number | string[] | undefined)[][];
        };
        const row = data.rows.find(
          (candidate) =>
            candidate[0] === 'Carrer de Colón' && candidate[3] === 'p',
        );
        if (!row) throw new Error('No se encontró el vial principal de fixture');
        row[0] = xssPayload;

        const body = html.replace(
          dataScript[0],
          `${dataScript[1]}${JSON.stringify(data)}${dataScript[3]}`,
        );
        await route.fulfill({ response, body });
      },
    );

    const frame = await irACallejero(page);
    const embed = page
      .frames()
      .find(
        (candidate) =>
          candidate !== page.mainFrame() &&
          candidate.url().includes('callejero-embed/valencia_27.html'),
      );
    if (!embed) throw new Error('No se encontró el frame del callejero');

    await expect(frame.locator('#callejeroEstado')).toContainText('3.162', {
      timeout: 12_000,
    });
    await frame.locator('#tglCalles').check();
    await expect(
      frame.locator('#tglCalles').locator('xpath=..').locator('.num'),
    ).toHaveText('220');
    await expect
      .poll(() => embed.evaluate(() => eval('capaCalles.getLayers().length')))
      .toBe(220);

    const target = await embed.evaluate(async (maliciousName) => {
      type Marker = {
        getTooltip: () => { getContent: () => string | HTMLElement } | null;
        getLatLng: () => { lat: number; lng: number };
      };
      const scope = globalThis as typeof globalThis & {
        cargarViales?: () => Promise<{
          n: string;
          t: string;
          lat: number;
          lng: number;
        }[]>;
      };
      if (typeof scope.cargarViales !== 'function') {
        throw new Error('No se encontró cargarViales en el embed');
      }
      const viales = await scope.cargarViales();
      const vial = viales.find(
        (candidate) => candidate.n === maliciousName && candidate.t === 'principal',
      );
      if (!vial) throw new Error('No se encontró el vial malicioso en el dataset');

      const mapa = eval('map') as {
        setView: (center: [number, number], zoom: number, options: object) => void;
        latLngToContainerPoint: (latlng: [number, number]) => {
          x: number;
          y: number;
        };
      };
      mapa.setView([vial.lat, vial.lng], 16, { animate: false });
      const marcador = (eval('capaCalles.getLayers()') as Marker[]).find(
        (candidate) => {
          const content = candidate.getTooltip()?.getContent();
          return content instanceof HTMLElement && content.textContent === maliciousName;
        },
      );
      if (!marcador) throw new Error('No se encontró el marcador con tooltip');
      const location = marcador.getLatLng();
      return mapa.latLngToContainerPoint([location.lat, location.lng]);
    }, xssPayload);

    await frame.locator('#map').hover({ position: target, force: true });
    const tooltip = frame.locator('.leaflet-tooltip').last();
    await expect(tooltip).toBeVisible();
    expect(await tooltip.textContent()).toContain(xssPayload);
    expect(await tooltip.locator('img').count()).toBe(0);
    expect(
      await embed.evaluate(() =>
        Boolean((window as typeof window & { __tfXss?: number }).__tfXss),
      ),
    ).toBe(false);
  });

  test('coalesce consumidores concurrentes de la carga inicial del callejero', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const originalFetch = window.fetch.bind(window);
      const scope = globalThis as typeof globalThis & {
        __tfCityFetchCount?: number;
      };
      scope.__tfCityFetchCount = 0;
      window.fetch = (input, init) => {
        const url =
          typeof input === 'string'
            ? input
            : input instanceof Request
              ? input.url
              : input.href;
        if (/\/callejero\/ciudades(?:[/?#]|$)/.test(url)) {
          scope.__tfCityFetchCount = (scope.__tfCityFetchCount ?? 0) + 1;
        }
        return originalFetch(input, init);
      };
    });
    let releaseFirstCity!: () => void;
    let markFirstCityStarted!: () => void;
    let firstCitySeen = false;
    let cityRequestsObserved = 0;
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
      cityRequestsObserved += 1;
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
      await expect
        .poll(
          () =>
            embed.evaluate(
              () =>
                (
                  globalThis as typeof globalThis & {
                    __tfCityFetchCount?: number;
                  }
                ).__tfCityFetchCount ?? 0,
            ),
          { timeout: 3_000 },
        )
        .toBe(1);
      expect(cityRequestsObserved).toBe(1);
      releaseFirstCity();
      await concurrentLoads;

      await expect(frame.locator('#callejeroEstado')).toContainText('3.162', {
        timeout: 12_000,
      });
      expect(cityRequestsObserved).toBeGreaterThan(0);
      expect(currentState.callesApiCalls).toBe(0);
    } finally {
      releaseFirstCity();
    }
  });

  test('vuelve a autorizar Valencia antes de reutilizar el callejero en memoria', async ({
    page,
  }) => {
    const frame = await irACallejero(page);
    await expect(frame.locator('#callejeroEstado')).toContainText('3.162', {
      timeout: 12_000,
    });
    const ciudadesAntes = currentState.ciudadesApiCalls;
    currentState.valenciaAutorizada = false;
    const embed = page
      .frames()
      .find(
        (candidate) =>
          candidate !== page.mainFrame() &&
          candidate.url().includes('callejero-embed/valencia_27.html'),
      );
    if (!embed) throw new Error('No se encontró el frame del callejero');
    const resultado = await embed.evaluate(async () => {
      const scope = globalThis as typeof globalThis & {
        cargarViales?: () => Promise<unknown>;
      };
      try {
        await scope.cargarViales?.();
        return 'resuelto';
      } catch (_) {
        return 'denegado';
      }
    });

    expect(resultado).toBe('denegado');
    expect(currentState.ciudadesApiCalls).toBeGreaterThan(ciudadesAntes);
    expect(currentState.callesApiCalls).toBe(0);
  });

  test('no dibuja una ruta recta ficticia si el servicio de recorridos falla', async ({
    page,
  }) => {
    currentState.routeApiUnavailable = true;
    const frame = await irACallejero(page);
    await frame.locator('#tabRecorridos').click();
    const pathsAntes = await frame.locator('#map .leaflet-overlay-pane path').count();
    await frame.locator('#recTexto').fill('Calle API Real');
    await frame.locator('#recBtnTrazar').click();

    await expect(frame.locator('#rpBody')).toContainText('No se pudo calcular', {
      timeout: 12_000,
    });
    await expect(frame.locator('#rpBody')).not.toContainText('línea recta');
    expect(await frame.locator('#map .leaflet-overlay-pane path').count()).toBe(
      pathsAntes,
    );
    expect(currentState.routeApiCalls).toBe(1);
    currentState.routeApiUnavailable = false;
    await frame.locator('#rpReintentar').click();
    await expect(frame.locator('#rpBody')).toContainText('recorrido verificado', {
      timeout: 12_000,
    });
    expect(currentState.routeApiCalls).toBe(2);
  });

  test('rechaza recorrido sin calles completas y permite reintentar sin dibujar', async ({
    page,
  }) => {
    currentState.routePayload = {
      direccionResuelta: 'Calle API Real, 1',
      lat: 39.45,
      lng: -0.35,
      parqueNombre: 'Parc API',
      estacion: { nombre: 'Parc API', lat: 39.44, lng: -0.34 },
      polyline: [
        [39.45, -0.35],
        [39.46, -0.36],
      ],
      km: 2.1,
      minutos: 6,
    };
    const frame = await irACallejero(page);
    await frame.locator('#tabRecorridos').click();
    const pathsAntes = await frame.locator('#map .leaflet-overlay-pane path').count();
    await frame.locator('#recTexto').fill('Calle API Real');
    await frame.locator('#recBtnTrazar').click();

    await expect(frame.locator('#rpBody')).toContainText('No se pudo calcular', {
      timeout: 12_000,
    });
    await expect(frame.locator('#rpReintentar')).toBeVisible();
    expect(await frame.locator('#map .leaflet-overlay-pane path').count()).toBe(
      pathsAntes,
    );
    expect(currentState.routeApiCalls).toBe(1);
  });

  test('acepta recorrido sin viales cuando calles es un array vacío y estacion es null', async ({
    page,
  }) => {
    currentState.routePayload = {
      direccionResuelta: 'Calle API Real, 1',
      lat: 39.45,
      lng: -0.35,
      parqueNombre: null,
      calles: [],
      estacion: null,
      polyline: [
        [39.45, -0.35],
        [39.46, -0.36],
      ],
      km: 2.1,
      minutos: 6,
    };
    const frame = await irACallejero(page);
    await frame.locator('#tabRecorridos').click();
    await frame.locator('#recTexto').fill('Calle API Real');
    await frame.locator('#recBtnTrazar').click();

    await expect(frame.locator('#rpBody')).toContainText(
      '0 viales · recorrido verificado',
      { timeout: 12_000 },
    );
    expect(currentState.routeApiCalls).toBe(1);
  });

  test('acepta viales vacíos y nombres de más de 200 caracteres', async ({
    page,
  }) => {
    currentState.routePayload = {
      direccionResuelta: 'Calle API Real, 1',
      lat: 39.45,
      lng: -0.35,
      parqueNombre: '',
      calles: ['', 'C'.repeat(201)],
      estacion: { nombre: 'Parc API', lat: 39.44, lng: -0.34 },
      polyline: [
        [39.45, -0.35],
        [39.46, -0.36],
      ],
      km: 2.1,
      minutos: 6,
    };
    const frame = await irACallejero(page);
    await frame.locator('#tabRecorridos').click();
    await frame.locator('#recTexto').fill('Calle API Real');
    await frame.locator('#recBtnTrazar').click();

    await expect(frame.locator('#rpBody')).toContainText(
      '2 viales · recorrido verificado',
      { timeout: 12_000 },
    );
    expect(currentState.routeApiCalls).toBe(1);
  });

  test('rechaza recorrido si estacion falta o no es null ni un objeto válido', async ({
    page,
  }) => {
    const frame = await irACallejero(page);
    await frame.locator('#tabRecorridos').click();
    await frame.locator('#recTexto').fill('Calle API Real');

    const rutaSinEstacion = {
      direccionResuelta: 'Calle API Real, 1',
      lat: 39.45,
      lng: -0.35,
      parqueNombre: 'Parc API',
      calles: ['Carrer de Xàtiva'],
      polyline: [
        [39.45, -0.35],
        [39.46, -0.36],
      ],
      km: 2.1,
      minutos: 6,
    };
    currentState.routePayload = rutaSinEstacion;
    await frame.locator('#recBtnTrazar').click();
    await expect(frame.locator('#rpBody')).toContainText('No se pudo calcular', {
      timeout: 12_000,
    });
    await expect(frame.locator('#rpReintentar')).toBeVisible();

    currentState.routePayload = { ...rutaSinEstacion, estacion: false };
    await frame.locator('#rpReintentar').click();
    await expect(frame.locator('#rpBody')).toContainText('No se pudo calcular', {
      timeout: 12_000,
    });
    await expect(frame.locator('#rpReintentar')).toBeVisible();
    expect(currentState.routeApiCalls).toBe(2);
  });

  test('el contenido malicioso de la ruta se muestra como texto, no como HTML ejecutable', async ({
    page,
  }) => {
    currentState.routePayload = {
      direccionResuelta: '<img src=x onerror="window.__routeXss=1">',
      lat: 39.45,
      lng: -0.35,
      parqueNombre: 'Parc API',
      calles: ['<script>window.__routeXss=2</script>'],
      estacion: { nombre: 'Parc API', lat: 39.44, lng: -0.34 },
      polyline: [
        [39.45, -0.35],
        [39.46, -0.36],
      ],
      km: 2.1,
      minutos: 6,
    };
    const frame = await irACallejero(page);
    await frame.locator('html').evaluate(() => {
      (window as typeof window & { __routeXss?: number }).__routeXss = 0;
    });
    await frame.locator('#tabRecorridos').click();
    await frame.locator('#recTexto').fill('Calle API Real');
    await frame.locator('#recBtnTrazar').click();

    await expect(frame.locator('#rpBody')).toContainText('recorrido verificado', {
      timeout: 12_000,
    });
    await expect(frame.locator('#rpBody')).toContainText(
      '<script>window.__routeXss=2</script>',
    );
    await expect(frame.locator('#rpBody script')).toHaveCount(0);
    await expect(frame.locator('#rpTit img, #rpTit script')).toHaveCount(0);
    expect(
      await frame.locator('html').evaluate(
        () => (window as typeof window & { __routeXss?: number }).__routeXss,
      ),
    ).toBe(0);
  });

  test('CARTO usa la clave configurada y no hace peticiones anónimas', async ({
    page,
  }) => {
    const solicitudes: Request[] = [];
    await servirMapasConfig(page, 'CLAVE_E2E');
    await instalarTeselas(page, new Set(), solicitudes);

    const frame = await irACallejero(page);
    const conClave = await frame
      .locator('html')
      .evaluate(
        () =>
          Boolean(
            (window as unknown as { TFMapas?: { tieneCarto(): boolean } })
              .TFMapas?.tieneCarto(),
          ),
      );
    expect(conClave).toBe(true);

    await frame.locator('.chip[data-base="mudo"]').click();
    await expect
      .poll(() => peticionesA(solicitudes, 'basemaps.cartocdn.com').length, {
        timeout: 15_000,
      })
      .toBeGreaterThan(0);

    const carto = peticionesA(solicitudes, 'basemaps.cartocdn.com');
    for (const request of carto) {
      expect(new URL(request.url()).searchParams.get('key')).toBe('CLAVE_E2E');
      expect(request.headers()['authorization']).toBeUndefined();
    }
  });

  test('con clave, el mudo de Valencia cae a PNOA sin error y con tilematrix entero', async ({
    page,
  }) => {
    const solicitudes: Request[] = [];
    const erroresPagina: string[] = [];
    page.on('pageerror', (err) => erroresPagina.push(err.message));
    await servirMapasConfig(page, 'CLAVE_E2E');
    await instalarTeselas(
      page,
      new Set(['basemaps.cartocdn.com']),
      solicitudes,
    );

    const frame = await irACallejero(page);
    await frame.locator('.chip[data-base="mudo"]').click();

    // CARTO (primario mudo) cae por completo → respaldo PNOA visible.
    await expect(frame.locator('.tf-mapa-aviso:visible')).toBeVisible({
      timeout: 15_000,
    });
    await expect
      .poll(() => peticionesA(solicitudes, 'ign.es').length, { timeout: 15_000 })
      .toBeGreaterThan(0);

    // Regresión compartida: PNOA nunca se pide con un zoom fraccional; un
    // `redraw` a mitad de animación generaba `tilematrix` inválido y falsos
    // errores que agotaban la recuperación.
    for (const request of peticionesA(solicitudes, 'ign.es')) {
      const tilematrix = new URL(request.url()).searchParams.get('tilematrix');
      expect(tilematrix).not.toBeNull();
      expect(Number.isInteger(Number(tilematrix))).toBe(true);
    }
    await expect(frame.locator('.tf-mapa-error:visible')).toHaveCount(0);
    expect(erroresPagina).toEqual([]);
  });

  test('sin clave el mudo usa PNOA y nunca CARTO ni Esri Light Gray', async ({
    page,
  }) => {
    const solicitudes: Request[] = [];
    await servirMapasConfig(page, null);
    await instalarTeselas(page, new Set(), solicitudes);

    const frame = await irACallejero(page);
    const cartoNulo = await frame.locator('html').evaluate(() => {
      const tf = (window as unknown as { TFMapas?: { proveedores(): Record<string, () => unknown> } })
        .TFMapas;
      return tf ? tf.proveedores()['cartoVoyagerSinEtiquetas']() : 'sin-utilidad';
    });
    expect(cartoNulo).toBeNull();

    await frame.locator('.chip[data-base="mudo"]').click();
    await expect
      .poll(
        () => peticionesA(solicitudes, 'ign.es').length > 0,
        { timeout: 15_000 },
      )
      .toBe(true);
    expect(peticionesA(solicitudes, 'basemaps.cartocdn.com')).toHaveLength(0);
    // Nunca Esri Light Gray (sus teselas llevan topónimos).
    expect(peticionesA(solicitudes, 'arcgisonline.com')).toHaveLength(0);
  });

  test('OSM estándar cae a IGNBaseTodo; fallo total muestra Reintentar y recupera OSM', async ({
    page,
  }) => {
    const solicitudes: Request[] = [];
    const enFallo = new Set<string>(['tile.openstreetmap.org']);
    await servirMapasConfig(page, 'CLAVE_E2E');
    await instalarTeselas(page, enFallo, solicitudes);

    const frame = await irACallejero(page);
    // OSM estándar falla → transición única al respaldo IGNBaseTodo.
    await expect(frame.locator('.tf-mapa-aviso:visible')).toBeVisible({
      timeout: 15_000,
    });
    await expect
      .poll(() => peticionesA(solicitudes, 'ign.es').length, {
        timeout: 15_000,
      })
      .toBeGreaterThan(0);
    expect(peticionesA(solicitudes, 'basemaps.cartocdn.com')).toHaveLength(0);

    // El respaldo también falla → aviso de fallo con Reintentar (sin bucle).
    enFallo.add('ign.es');
    await frame.locator('.leaflet-control-zoom-in').click();
    await expect(frame.locator('.tf-mapa-error:visible')).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      frame.locator('.tf-mapa-error:visible .tf-mapa-reintentar'),
    ).toBeVisible();
    await expect(frame.locator('.tf-mapa-aviso:visible')).toHaveCount(0);

    // Reintento explícito: se restablece el proveedor primario.
    const antes = peticionesA(solicitudes, 'tile.openstreetmap.org').length;
    enFallo.clear();
    await frame.locator('.tf-mapa-error:visible .tf-mapa-reintentar').click();
    await expect(frame.locator('.tf-mapa-error:visible')).toHaveCount(0, {
      timeout: 15_000,
    });
    await expect
      .poll(() => peticionesA(solicitudes, 'tile.openstreetmap.org').length, {
        timeout: 15_000,
      })
      .toBeGreaterThan(antes);
  });

  test('una tesela fallida aislada no dispara la transición al respaldo', async ({
    page,
  }) => {
    const solicitudes: Request[] = [];
    let fallosRestantes = 1;
    await servirMapasConfig(page, 'CLAVE_E2E');
    await page.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (['localhost', '127.0.0.1'].includes(url.hostname)) {
        await route.fallback();
        return;
      }
      if (url.hostname !== 'tile.openstreetmap.org') {
        await route.fallback();
        return;
      }
      solicitudes.push(route.request());
      if (fallosRestantes > 0) {
        fallosRestantes -= 1;
        await route.abort('failed');
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'image/png',
        headers: {
        'access-control-allow-origin': '*',
        'cache-control': 'no-store',
      },
        body: PIXEL_PNG,
      });
    });

    const frame = await irACallejero(page);
    await page.waitForTimeout(2_000);
    await expect(frame.locator('.tf-mapa-aviso:visible')).toHaveCount(0);
    expect(peticionesA(solicitudes, 'basemaps.cartocdn.com')).toHaveLength(0);
  });

  test('sin clave, el fallo de calles cae a IGNBaseTodo y nunca a CARTO', async ({
    page,
  }) => {
    const solicitudes: Request[] = [];
    const erroresPagina: string[] = [];
    page.on('pageerror', (err) => erroresPagina.push(err.message));
    await servirMapasConfig(page, null);
    await instalarTeselas(page, new Set(['tile.openstreetmap.org']), solicitudes);

    const frame = await irACallejero(page);
    await expect(frame.locator('.tf-mapa-aviso:visible')).toBeVisible({
      timeout: 15_000,
    });
    await expect
      .poll(() => peticionesA(solicitudes, 'ign.es').length, { timeout: 15_000 })
      .toBeGreaterThan(0);
    expect(peticionesA(solicitudes, 'basemaps.cartocdn.com')).toHaveLength(0);
    // La transición no debe romper Leaflet (p. ej. subdomains undefined).
    expect(erroresPagina).toEqual([]);
  });

  test('OSM conserva el zoom al caer a IGN y Reintentar restaura las teselas estándar', async ({
    page,
  }) => {
    const solicitudes: Request[] = [];
    let fallarOsm = false;
    let fallarTodo = false;
    const erroresPagina: string[] = [];
    page.on('pageerror', (err) => erroresPagina.push(err.message));
    await servirMapasConfig(page, 'CLAVE_E2E');
    await page.route('**/*', async (route) => {
      const host = new URL(route.request().url()).hostname;
      if (['localhost', '127.0.0.1'].includes(host)) {
        await route.fallback();
        return;
      }
      const esOsm = host === 'tile.openstreetmap.org';
      const esIgn = host.endsWith('ign.es');
      if (!esOsm && !esIgn) {
        await route.fallback();
        return;
      }
      solicitudes.push(route.request());
      if ((esOsm && fallarOsm) || ((esOsm || esIgn) && fallarTodo)) {
        await route.abort('failed');
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'image/png',
        headers: {
        'access-control-allow-origin': '*',
        'cache-control': 'no-store',
      },
        body: PIXEL_PNG,
      });
    });

    const frame = await irACallejero(page);
    // OSM estándar admite hasta el zoom 19 configurado.
    await subirZoomAlMaximo(frame, page);
    await expect
      .poll(
        () =>
          Math.max(0, ...peticionesA(solicitudes, 'tile.openstreetmap.org').map(zoomDe)),
        { timeout: 15_000 },
      )
      .toBe(19);

    // OSM falla → respaldo IGNBaseTodo.
    fallarOsm = true;
    await frame.locator('.leaflet-control-zoom-out').click();
    await frame.locator('.leaflet-control-zoom-in').click();
    await expect(frame.locator('.tf-mapa-aviso:visible')).toBeVisible({
      timeout: 15_000,
    });
    await expect
      .poll(
        () => peticionesA(solicitudes, 'ign.es').length,
        { timeout: 15_000 },
      )
      .toBeGreaterThan(0);

    // Las teselas IGN conservan matrices enteras y no superan su zoom nativo.
    const zoomsIgn = peticionesA(solicitudes, 'ign.es').map(
      zoomDe,
    );
    expect(Math.max(...zoomsIgn)).toBeLessThanOrEqual(19);
    await expect(frame.locator('.tf-mapa-error:visible')).toHaveCount(0);
    await expect(
      frame.locator('img.leaflet-tile-loaded').first(),
    ).toBeVisible();

    // Fallo total primario+respaldo → Reintentar restaura OSM estándar.
    fallarTodo = true;
    // Varios niveles de zoom fuerzan nuevas teselas nativas en cada paso.
    for (let i = 0; i < 5; i += 1) {
      await frame.locator('.leaflet-control-zoom-out').click();
      await page.waitForTimeout(300);
    }
    await expect(frame.locator('.tf-mapa-error:visible')).toBeVisible({
      timeout: 15_000,
    });
    fallarOsm = false;
    fallarTodo = false;
    await frame.locator('.tf-mapa-error:visible .tf-mapa-reintentar').click();
    await expect(frame.locator('.tf-mapa-error:visible')).toHaveCount(0, {
      timeout: 15_000,
    });
    // El proveedor OSM queda restaurado después del reintento.
    await subirZoomAlMaximo(frame, page);
    await expect
      .poll(
        () =>
          Math.max(0, ...peticionesA(solicitudes, 'tile.openstreetmap.org').map(zoomDe)),
        { timeout: 15_000 },
      )
      .toBe(19);
    expect(erroresPagina).toEqual([]);
  });
});

/**
 * El script de build (scripts/escribir-mapa-key.mjs) es el único punto que
 * inyecta la clave en la copia GENERADA. Estas pruebas lo ejecutan contra una
 * copia temporal (nunca contra public/) y evalúan el TFMapas resultante.
 */
test.describe('Configuración de mapas (build)', () => {
  const RAIZ = resolve(__dirname, '..');
  const STUB = resolve(RAIZ, 'public/callejero-embed/mapas-config.js');
  const SCRIPT = resolve(RAIZ, 'scripts/escribir-mapa-key.mjs');
  const RUTA_RELATIVA = 'dist/front/browser/callejero-embed/mapas-config.js';

  interface TfMapasEvaluado {
    config: { cartoKey: string };
    tieneCarto(): boolean;
  }

  function prepararCopia(): string {
    const base = mkdtempSync(join(tmpdir(), 'tf-mapas-'));
    mkdirSync(join(base, 'dist/front/browser/callejero-embed'), {
      recursive: true,
    });
    copyFileSync(STUB, join(base, RUTA_RELATIVA));
    return base;
  }

  function evaluar(archivo: string): TfMapasEvaluado {
    const contexto = createContext({});
    runInContext(readFileSync(archivo, 'utf8'), contexto);
    return (contexto as { TFMapas: TfMapasEvaluado }).TFMapas;
  }

  test('inyecta la clave en la copia generada y deja intacto el stub', () => {
    const base = prepararCopia();
    try {
      execFileSync(process.execPath, [SCRIPT], {
        cwd: base,
        env: { ...process.env, CALLEJERO_CARTO_API_KEY: 'CLAVE_FICTICIA_E2E' },
        stdio: 'pipe',
      });
      const api = evaluar(join(base, RUTA_RELATIVA));
      expect(api.config.cartoKey).toBe('CLAVE_FICTICIA_E2E');
      expect(api.tieneCarto()).toBe(true);
      // El stub versionado sigue SIN clave real.
      expect(readFileSync(STUB, 'utf8')).toContain("cartoKey: ''");
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });

  test('sin CALLEJERO_CARTO_API_KEY conserva el stub vacío (respaldos)', () => {
    const base = prepararCopia();
    try {
      const env = { ...process.env };
      delete env.CALLEJERO_CARTO_API_KEY;
      execFileSync(process.execPath, [SCRIPT], { cwd: base, env, stdio: 'pipe' });
      const api = evaluar(join(base, RUTA_RELATIVA));
      expect(api.config.cartoKey).toBe('');
      expect(api.tieneCarto()).toBe(false);
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });

  interface TfMapasUtil {
    crearRecuperable(
      L: unknown,
      capa: CapaFalsa,
      opciones: {
        respaldo?: { url: string; opts: Record<string, unknown> } | null;
        maxFallos?: number;
      },
    ): {
      fase(): string;
      reintentar(): void;
    };
  }

  interface CapaFalsa {
    _url: string;
    options: Record<string, unknown>;
    _map: null;
    _handlers: Array<[string, () => void]>;
    on(ev: string, fn: () => void): CapaFalsa;
    off(ev: string, fn: () => void): CapaFalsa;
    setUrl(url: string): CapaFalsa;
    redraw(): CapaFalsa;
  }

  function crearCapaFalsa(
    url: string,
    options: Record<string, unknown>,
  ): CapaFalsa {
    const capa: CapaFalsa = {
      _url: url,
      options: { ...options },
      _map: null,
      _handlers: [],
      on(ev, fn) {
        capa._handlers.push([ev, fn]);
        return capa;
      },
      off(ev, fn) {
        capa._handlers = capa._handlers.filter(
          ([e, f]) => e !== ev || f !== fn,
        );
        return capa;
      },
      setUrl(u) {
        capa._url = u;
        return capa;
      },
      redraw() {
        return capa;
      },
    };
    return capa;
  }

  function cargarTfMapas(): TfMapasUtil {
    const contexto = createContext({});
    runInContext(MAPAS_CONFIG_SRC, contexto);
    return (contexto as unknown as { TFMapas: TfMapasUtil }).TFMapas;
  }

  test('provee teselas OSM estándar de Valencia con atribución visible', () => {
    const tf = cargarTfMapas() as TfMapasUtil & {
      proveedores(): Record<
        string,
        () => { url: string; opts: Record<string, unknown> } | null
      >;
    };
    const calles = tf.proveedores()['osmStandard']();

    expect(calles).not.toBeNull();
    expect(calles!.url).toBe('https://tile.openstreetmap.org/{z}/{x}/{y}.png');
    expect(calles!.opts['attribution']).toContain('OpenStreetMap');
  });

  function emitir(capa: CapaFalsa, evento: string, veces: number): void {
    for (let i = 0; i < veces; i += 1) {
      for (const [e, f] of [...capa._handlers]) {
        if (e === evento) f();
      }
    }
  }

  test('el respaldo conserva maxZoom de vista y fija el maxNativeZoom del proveedor', () => {
    const tf = cargarTfMapas();
    const capa = crearCapaFalsa('GOOGLE', {
      maxZoom: 21,
      subdomains: ['mt0', 'mt1'],
      attribution: 'G',
    });
    const ctrl = tf.crearRecuperable({}, capa, {
      respaldo: {
        url: 'CARTO',
        opts: { maxZoom: 20, subdomains: 'abcd', attribution: 'C' },
      },
    });

    emitir(capa, 'tileerror', 3);
    expect(ctrl.fase()).toBe('respaldo');
    expect(capa._url).toBe('CARTO');
    // La vista original (21) se conserva; el nativo pasa a 20 (inferido del respaldo).
    expect(capa.options['maxZoom']).toBe(21);
    expect(capa.options['maxNativeZoom']).toBe(20);
    expect(capa.options['subdomains']).toBe('abcd');

    ctrl.reintentar();
    expect(ctrl.fase()).toBe('primario');
    expect(capa._url).toBe('GOOGLE');
    expect(capa.options['maxZoom']).toBe(21);
    expect(capa.options['maxNativeZoom']).toBeUndefined();
    expect(capa.options['subdomains']).toEqual(['mt0', 'mt1']);
    expect(capa.options['attribution']).toBe('G');
  });

  test('de Esri Topo (19) a OpenTopo (17): se limpia el maxNativeZoom previo y se infiere el del respaldo', () => {
    const tf = cargarTfMapas();
    const capa = crearCapaFalsa('ESRI_TOPO', {
      maxZoom: 19,
      maxNativeZoom: 16,
      attribution: 'E',
    });
    const ctrl = tf.crearRecuperable({}, capa, {
      respaldo: { url: 'OPENTOPO', opts: { maxZoom: 17, attribution: 'OTM' } },
    });

    emitir(capa, 'tileerror', 3);
    expect(capa._url).toBe('OPENTOPO');
    expect(capa.options['maxZoom']).toBe(19);
    expect(capa.options['maxNativeZoom']).toBe(17);
    // El respaldo NO declara subdomains: Leaflet siempre llama a _getSubdomain,
    // así que debe quedar un valor válido (por defecto 'abc'), no undefined.
    expect(capa.options['subdomains']).toBe('abc');
    expect(capa.options['tms']).toBe(false);
    expect(capa.options['zoomOffset']).toBe(0);
    expect(capa.options['zoomReverse']).toBe(false);

    ctrl.reintentar();
    expect(capa._url).toBe('ESRI_TOPO');
    expect(capa.options['maxZoom']).toBe(19);
    expect(capa.options['maxNativeZoom']).toBe(16);
  });
});
