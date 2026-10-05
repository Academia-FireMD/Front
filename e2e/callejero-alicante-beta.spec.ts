/**
 * E2E — beta autónoma del Callejero Alicante.
 *
 * La suite mantiene separados los dos contratos del callejero:
 * - el shell decide el destino a partir de las oposiciones del usuario;
 * - el HTML Alicante funciona de forma autónoma y nunca recibe el JWT/API base
 *   que el wrapper histórico de Valencia entrega por `postMessage`.
 *
 * Los proveedores cartográficos se interceptan para que las pruebas sean
 * deterministas y para detectar cualquier host nuevo que no esté en la lista
 * explícita de dependencias de la beta.
 */
import {
  expect,
  test,
  type FrameLocator,
  type Page,
  type Request,
} from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loginAsRoleMock } from './helpers/auth.helper';
import userAlumnoFixture from './fixtures/user-alumno.json';

type Rol = 'ALUMNO' | 'ADMIN';
type Oposicion = 'VALENCIA_AYUNTAMIENTO' | 'ALICANTE_CPBA';

type AuthProbeWindow = Window & {
  __callejeroAuthMessages?: unknown[];
};

const PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEAQH/XPWsWQAAAABJRU5ErkJggg==',
  'base64',
);

const MALICIOUS_MARKUP =
  '<img data-external-xss src=x onerror="window.__externalXss=1">';

const EXTERNAL_HOSTS = [
  'tile.opentopomap.org',
  'openstreetmap.org',
  'openstreetmap.de',
  'arcgisonline.com',
  'ign.es',
  'idee.es',
  'basemaps.cartocdn.com',
  'nominatim.openstreetmap.org',
  'router.project-osrm.org',
  'overpass-api.de',
];

const MAPAS_CONFIG_SRC = readFileSync(
  resolve(__dirname, '../public/callejero-embed/mapas-config.js'),
  'utf8',
);
function mapasConfigConClave(clave: string): string {
  return MAPAS_CONFIG_SRC.replace("cartoKey: ''", `cartoKey: '${clave}'`);
}
async function servirMapasConfigAlicante(
  page: Page,
  clave: string | null,
): Promise<void> {
  await page.route('**/mapas-config.js', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: clave ? mapasConfigConClave(clave) : MAPAS_CONFIG_SRC,
    }),
  );
}

function esTileExterna(hostname: string): boolean {
  const hosts = [
    'tile.opentopomap.org',
    'arcgisonline.com',
    'ign.es',
    'idee.es',
    'basemaps.cartocdn.com',
  ];
  return hosts.some((h) => hostname === h || hostname.endsWith(`.${h}`));
}

/** Intercepta teselas: falla los hosts indicados, sirve píxel al resto. */
async function instalarTeselasAlicante(
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
    if (!esTileExterna(url.hostname)) {
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

function peticionesAlHost(
  solicitudes: Request[],
  host: string,
): Request[] {
  return solicitudes.filter(
    (r) =>
      new URL(r.url()).hostname === host ||
      new URL(r.url()).hostname.endsWith(`.${host}`),
  );
}

function peticionesConPath(
  solicitudes: Request[],
  fragmento: string,
): Request[] {
  return solicitudes.filter((r) => r.url().includes(fragmento));
}

function zoomDeAlicante(request: Request): number {
  const raw = request.url();
  const tilematrix = new URL(raw).searchParams.get('tilematrix');
  if (tilematrix) return Number(tilematrix);
  const zParam = raw.match(/[?&]z=(\d+)(?:&|$)/);
  if (zParam) return Number(zParam[1]);
  const match = new URL(raw).pathname.match(/\/(\d+)\/\d+\/\d+(?:\.\w+)?$/);
  return match ? Number(match[1]) : Number.NaN;
}

/** Selecciona una capa base en el control de capas de Leaflet (Alicante).
 *  Usa el input real vía JS: el toggle queda tapado por la lista expandida. */
async function seleccionarBaseAlicante(
  frame: FrameLocator,
  etiqueta: string,
): Promise<void> {
  const ok = await frame.locator('html').evaluate((_el, texto) => {
    const labels = Array.from(
      document.querySelectorAll<HTMLLabelElement>(
        '.leaflet-control-layers-base label',
      ),
    );
    const objetivo = labels.find((l) =>
      (l.textContent || '').includes(texto),
    );
    const input = objetivo?.querySelector('input');
    if (!input) return false;
    input.click();
    return true;
  }, etiqueta);
  if (!ok) throw new Error(`No se encontró la capa base "${etiqueta}"`);
}

/** Marca "Mapa mudo durante el examen" (QZ.mute) antes de arrancar el examen. */
async function activarMudoExamen(frame: FrameLocator): Promise<void> {
  await frame.locator('#qzMute').evaluate((el) => {
    const input = el as HTMLInputElement;
    input.checked = true;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

/** Pulsa zoom-in hasta llegar al zoom máximo del mapa (el botón se deshabilita). */
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

function usuarioCon(
  oposiciones: Oposicion[],
  rol: Rol = 'ALUMNO',
): Record<string, unknown> {
  return {
    ...userAlumnoFixture,
    rol,
    oposiciones,
    suscripciones: oposiciones.map((oposicion, index) => ({
      ...(userAlumnoFixture.suscripciones[0] ?? {}),
      id: index + 1,
      oposicion,
      status: 'ACTIVE',
    })),
  };
}

function hostPermitido(hostname: string): boolean {
  return EXTERNAL_HOSTS.some(
    (host) => hostname === host || hostname.endsWith(`.${host}`),
  );
}

async function instalarSondaAuth(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const scope = window as AuthProbeWindow;
    scope.__callejeroAuthMessages = [];
    window.addEventListener('message', (event) => {
      const data = event.data;
      if (
        data &&
        typeof data === 'object' &&
        typeof (data as { type?: unknown }).type === 'string' &&
        (data as { type: string }).type.startsWith('tf-callejero-auth')
      ) {
        scope.__callejeroAuthMessages?.push(data);
      }
    });
  });
}

async function instalarRedDeterminista(
  page: Page,
  solicitudesExternas: Request[],
  hostsNoPermitidos: string[],
): Promise<void> {
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (!['http:', 'https:'].includes(url.protocol)) {
      await route.continue();
      return;
    }

    const esLocal = ['localhost', '127.0.0.1'].includes(url.hostname);
    if (esLocal) {
      await route.continue();
      return;
    }

    solicitudesExternas.push(request);
    if (!hostPermitido(url.hostname)) {
      hostsNoPermitidos.push(url.hostname);
      await route.abort('blockedbyclient');
      return;
    }

    const corsHeaders = { 'access-control-allow-origin': '*' };
    if (url.hostname === 'nominatim.openstreetmap.org') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: corsHeaders,
        body: JSON.stringify([
          {
            lat: '38.44557',
            lon: '-0.64365',
            class: 'place',
            type: 'town',
            display_name: `${MALICIOUS_MARKUP}, Alicante, España`,
          },
        ]),
      });
      return;
    }

    if (url.hostname === 'router.project-osrm.org') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: corsHeaders,
        body: JSON.stringify({
          code: 'Ok',
          routes: [
            {
              distance: 12_300,
              duration: 900,
              geometry: {
                type: 'LineString',
                coordinates: [
                  [-0.62, 38.43],
                  [-0.64365, 38.44557],
                ],
              },
              legs: [
                {
                  steps: [
                    {
                      distance: 8_000,
                      duration: 500,
                      ref: `A-7${MALICIOUS_MARKUP}`,
                      name: '',
                    },
                    {
                      distance: 4_300,
                      duration: 400,
                      ref: 'CV-820',
                      name: '',
                    },
                  ],
                },
              ],
            },
          ],
        }),
      });
      return;
    }

    if (url.hostname === 'overpass-api.de') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: corsHeaders,
        body: JSON.stringify({ elements: [] }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'image/png',
      headers: corsHeaders,
      body: PIXEL_PNG,
    });
  });
}

async function login(
  page: Page,
  oposiciones: Oposicion[],
  rol: Rol = 'ALUMNO',
): Promise<void> {
  await loginAsRoleMock(page, {
    rol,
    email: `${rol.toLowerCase()}-callejero@test.com`,
    userFixture: usuarioCon(oposiciones, rol),
  });
}

async function iframeAlicante(page: Page): Promise<FrameLocator> {
  const iframe = page.locator('[data-testid="callejero-alicante-iframe"]');
  await expect(iframe).toBeVisible({ timeout: 15_000 });
  await expect(iframe).toHaveAttribute(
    'src',
    '/callejero-embed/alicante_16.html',
  );
  const frame = await iframe.contentFrame();
  if (!frame) throw new Error('No se pudo resolver el iframe Alicante');
  await expect(frame.locator('#app')).toBeVisible({ timeout: 15_000 });
  return frame;
}

test.describe('Callejero Alicante — acceso por oposición', () => {
  test.beforeEach(async ({ page }) => {
    await instalarSondaAuth(page);
  });

  test('un alumno CPBA entra directamente en Alicante', async ({ page }) => {
    await login(page, ['ALICANTE_CPBA']);
    await page.goto('/app/callejero');

    await expect(page).toHaveURL(/\/app\/callejero\/alicante$/);
    const frame = await iframeAlicante(page);
    await expect(frame.locator('#mapa')).toBeVisible();
    await expect(frame.locator('#beta-aviso')).toContainText('Beta temporal');
  });

  test('un alumno Valencia conserva el embed histórico', async ({ page }) => {
    await login(page, ['VALENCIA_AYUNTAMIENTO']);
    await page.goto('/app/callejero');

    await expect(page).toHaveURL(/\/app\/callejero\/valencia$/);
    await expect(
      page.locator('[data-testid="callejero-embed-iframe"]'),
    ).toHaveAttribute('src', '/callejero-embed/valencia_27.html');
    await expect(
      page.locator('[data-testid="callejero-alicante-iframe"]'),
    ).toHaveCount(0);
  });

  test('un alumno con ambas oposiciones elige el callejero', async ({
    page,
  }) => {
    await login(page, ['VALENCIA_AYUNTAMIENTO', 'ALICANTE_CPBA']);
    await page.goto('/app/callejero');

    await expect(page.getByTestId('callejero-selector')).toBeVisible();
    await expect(
      page.getByTestId('callejero-oposicion-valencia'),
    ).toBeVisible();
    await page.getByTestId('callejero-oposicion-alicante').click();
    await expect(page).toHaveURL(/\/app\/callejero\/alicante$/);
    await iframeAlicante(page);
  });

  test('un alumno sin oposición compatible no puede abrir Alicante', async ({
    page,
  }) => {
    await login(page, []);
    await page.goto('/app/callejero');
    await expect(page.getByTestId('callejero-sin-oposicion')).toBeVisible();

    await page.goto('/app/callejero/alicante');

    await expect(page).toHaveURL(/\/app\/profile$/);
    await expect(
      page.locator('[data-testid="callejero-alicante-iframe"]'),
    ).toHaveCount(0);
  });

  test('un administrador puede elegir cualquiera de los dos callejeros', async ({
    page,
  }) => {
    await login(page, [], 'ADMIN');
    await page.goto('/app/callejero');

    await expect(page.getByTestId('callejero-selector')).toBeVisible();
    await expect(
      page.getByTestId('callejero-oposicion-alicante'),
    ).toBeVisible();
    await expect(
      page.getByTestId('callejero-oposicion-valencia'),
    ).toBeVisible();
  });
});

test.describe('Callejero Alicante — beta autónoma', () => {
  let solicitudesExternas: Request[];
  let hostsNoPermitidos: string[];

  test.beforeEach(async ({ page }) => {
    solicitudesExternas = [];
    hostsNoPermitidos = [];
    await instalarSondaAuth(page);
    await instalarRedDeterminista(page, solicitudesExternas, hostsNoPermitidos);
    await login(page, ['ALICANTE_CPBA']);
  });

  test.afterEach(() => {
    expect(hostsNoPermitidos).toEqual([]);
    for (const request of solicitudesExternas) {
      expect(request.headers()['authorization']).toBeUndefined();
    }
  });

  test('carga mapa, recorrido mockeado y solo usa hosts permitidos', async ({
    page,
  }) => {
    await page.goto('/app/callejero/alicante');
    const frame = await iframeAlicante(page);

    await expect(frame.locator('#mapa.leaflet-container')).toBeVisible();
    expect(
      solicitudesExternas.some((request) =>
        new URL(request.url()).hostname.endsWith('arcgisonline.com'),
      ),
    ).toBe(true);
    expect(
      solicitudesExternas.some((request) =>
        new URL(request.url()).hostname.endsWith('tile.opentopomap.org'),
      ),
    ).toBe(false);
    await expect(frame.locator('#mapa canvas').first()).toBeVisible();
    await frame.locator('#tab2Rec').click();
    await expect(frame.locator('#rec2BoxEscribo')).toBeVisible();
    await frame.locator('#rec2Texto').fill('Agost');
    await frame.locator('#rec2BtnTrazar').click();

    await expect(frame.locator('#rec2pop')).toHaveClass(/show/, {
      timeout: 15_000,
    });
    await expect(frame.locator('#rec2body')).toContainText('12.3 km');
    await expect(frame.locator('#rec2body')).toContainText('A-7');
    expect(
      solicitudesExternas.some(
        (request) =>
          new URL(request.url()).hostname === 'nominatim.openstreetmap.org',
      ),
    ).toBe(true);
    expect(
      solicitudesExternas.some(
        (request) =>
          new URL(request.url()).hostname === 'router.project-osrm.org',
      ),
    ).toBe(true);
  });

  test('el examen registra progreso solo en localStorage', async ({ page }) => {
    await page.goto('/app/callejero/alicante');
    const frame = await iframeAlicante(page);

    await frame.locator('#tab2Qz').click();
    await frame.locator('#qzBtnStart').click();
    await expect(frame.locator('#qzpop')).toHaveClass(/show/);

    const opciones = frame.locator('#qp-body .qp-opts .qp-opt');
    const entrada = frame.locator('#qp-in');
    const orden = frame.locator('#qp-order .qp-opt');
    if ((await opciones.count()) > 0) {
      await opciones.first().click();
    } else if ((await entrada.count()) > 0) {
      await entrada.fill('respuesta de prueba');
      await frame.locator('#qp-ok').click();
    } else if ((await orden.count()) > 0) {
      for (let index = 0; index < (await orden.count()); index += 1) {
        await orden.nth(index).click();
      }
    } else {
      // Las preguntas cartográficas se resuelven sobre el centro visible.
      await frame.locator('#mapa').click({ position: { x: 300, y: 220 } });
    }

    await expect(frame.locator('#qp-res')).not.toBeEmpty();
    const progreso = await frame
      .locator('html')
      .evaluate(() => localStorage.getItem('tf_atlas_qz'));
    expect(progreso).toBeTruthy();
    expect(JSON.parse(progreso ?? '{}')).toHaveProperty('cats');
  });

  test('escapa nombres y vías devueltos por proveedores externos', async ({
    page,
  }) => {
    await page.goto('/app/callejero/alicante');
    const frame = await iframeAlicante(page);

    await frame.locator('#tab2Rec').click();
    await frame.locator('#rec2Texto').fill('resultado externo');
    const sugerencia = frame.locator('#rec2Sug .osm-item');
    await expect(sugerencia).toBeVisible({ timeout: 5_000 });
    await expect(sugerencia).toContainText(MALICIOUS_MARKUP);
    await expect(frame.locator('[data-external-xss]')).toHaveCount(0);

    await sugerencia.click();
    await expect(frame.locator('#rec2pop')).toHaveClass(/show/, {
      timeout: 15_000,
    });
    await expect(frame.locator('#rec2body')).toContainText('data-external-xss');
    const recorridoHtml = await frame.locator('#rec2body').innerHTML();
    expect(recorridoHtml).toContain('&lt;img');
    expect(recorridoHtml).not.toContain('<img data-external-xss');
    await expect(frame.locator('[data-external-xss]')).toHaveCount(0);
    await expect(
      frame
        .locator('html')
        .evaluate(
          () =>
            (window as Window & { __externalXss?: number }).__externalXss ??
            null,
        ),
    ).resolves.toBeNull();
  });

  test('no solicita ni recibe credenciales del shell', async ({ page }) => {
    await page.goto('/app/callejero/alicante');
    const frame = await iframeAlicante(page);

    await page.waitForTimeout(500);
    const parentMessages = await page.evaluate(
      () => (window as AuthProbeWindow).__callejeroAuthMessages ?? [],
    );
    const iframeMessages = await frame
      .locator('html')
      .evaluate(
        () => (window as AuthProbeWindow).__callejeroAuthMessages ?? [],
      );
    expect(parentMessages).toEqual([]);
    expect(iframeMessages).toEqual([]);

    const html = await frame
      .locator('html')
      .evaluate((element) => element.innerHTML);
    expect(html).not.toContain('tf-callejero-auth');
    expect(html).not.toContain('apiBase');
  });
});

test.describe('Callejero Alicante — recuperación cartográfica', () => {
  test.beforeEach(async ({ page }) => {
    await instalarSondaAuth(page);
    await login(page, ['ALICANTE_CPBA']);
  });

  test('con clave: el fondo Esri cae a CARTO con clave y el fallo total ofrece Reintentar', async ({
    page,
  }) => {
    const solicitudes: Request[] = [];
    const enFallo = new Set<string>(['arcgisonline.com']);
    await servirMapasConfigAlicante(page, 'CLAVE_ALC');
    await instalarTeselasAlicante(page, enFallo, solicitudes);

    await page.goto('/app/callejero/alicante');
    const frame = await iframeAlicante(page);

    // Fondo claro Esri (por defecto) falla → respaldo CARTO light_nolabels.
    await expect(frame.locator('.tf-mapa-aviso:visible')).toBeVisible({
      timeout: 15_000,
    });
    await expect
      .poll(
        () =>
          peticionesAlHost(solicitudes, 'basemaps.cartocdn.com').length,
        { timeout: 15_000 },
      )
      .toBeGreaterThan(0);
    const carto = peticionesAlHost(solicitudes, 'basemaps.cartocdn.com');
    expect(new URL(carto[0].url()).searchParams.get('key')).toBe('CLAVE_ALC');
    expect(carto[0].headers()['authorization']).toBeUndefined();

    // El respaldo también falla → "No se puede cargar el mapa" + Reintentar.
    enFallo.add('basemaps.cartocdn.com');
    await frame.locator('.leaflet-control-zoom-in').click();
    await expect(frame.locator('.tf-mapa-error:visible')).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      frame.locator('.tf-mapa-error:visible .tf-mapa-reintentar'),
    ).toBeVisible();

    // Reintento explícito con proveedores restablecidos.
    const antes = peticionesAlHost(solicitudes, 'arcgisonline.com').length;
    enFallo.clear();
    await frame.locator('.tf-mapa-error:visible .tf-mapa-reintentar').click();
    await expect(frame.locator('.tf-mapa-error:visible')).toHaveCount(0, {
      timeout: 15_000,
    });
    await expect
      .poll(
        () => peticionesAlHost(solicitudes, 'arcgisonline.com').length,
        { timeout: 15_000 },
      )
      .toBeGreaterThan(antes);
  });

  test('una tesela fallida aislada no dispara el respaldo', async ({ page }) => {
    const solicitudes: Request[] = [];
    let fallosRestantes = 1;
    await servirMapasConfigAlicante(page, 'CLAVE_ALC');
    await page.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (['localhost', '127.0.0.1'].includes(url.hostname)) {
        await route.fallback();
        return;
      }
      if (!url.hostname.endsWith('arcgisonline.com')) {
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

    await page.goto('/app/callejero/alicante');
    const frame = await iframeAlicante(page);
    await page.waitForTimeout(2_000);
    await expect(frame.locator('.tf-mapa-aviso:visible')).toHaveCount(0);
    expect(peticionesAlHost(solicitudes, 'basemaps.cartocdn.com')).toHaveLength(
      0,
    );
  });

  test('sin clave no se solicita CARTO y el fallo del fondo pide Reintentar', async ({
    page,
  }) => {
    const solicitudes: Request[] = [];
    await servirMapasConfigAlicante(page, null);
    await instalarTeselasAlicante(
      page,
      new Set(['arcgisonline.com']),
      solicitudes,
    );

    await page.goto('/app/callejero/alicante');
    const frame = await iframeAlicante(page);
    await expect(frame.locator('.tf-mapa-error:visible')).toBeVisible({
      timeout: 15_000,
    });
    expect(peticionesAlHost(solicitudes, 'basemaps.cartocdn.com')).toHaveLength(
      0,
    );
  });

  test('el examen en mudo con clave usa CARTO light_nolabels y no Esri Light Gray', async ({
    page,
  }) => {
    const solicitudes: Request[] = [];
    await servirMapasConfigAlicante(page, 'CLAVE_ALC');
    await instalarTeselasAlicante(page, new Set(), solicitudes);

    await page.goto('/app/callejero/alicante');
    const frame = await iframeAlicante(page);
    await expect
      .poll(
        () => peticionesConPath(solicitudes, 'World_Light_Gray_Base').length,
        { timeout: 15_000 },
      )
      .toBeGreaterThan(0);
    const lgAntes = peticionesConPath(
      solicitudes,
      'World_Light_Gray_Base',
    ).length;

    await frame.locator('#tab2Qz').click();
    await activarMudoExamen(frame);
    await frame.locator('#qzBtnStart').click();
    await expect(frame.locator('#qzpop')).toHaveClass(/show/, {
      timeout: 15_000,
    });

    await expect
      .poll(
        () => peticionesAlHost(solicitudes, 'basemaps.cartocdn.com').length,
        { timeout: 15_000 },
      )
      .toBeGreaterThan(0);
    const carto = peticionesAlHost(solicitudes, 'basemaps.cartocdn.com');
    expect(carto[0].url()).toContain('light_nolabels');
    expect(new URL(carto[0].url()).searchParams.get('key')).toBe('CLAVE_ALC');
    // Tras arrancar el examen, Esri Light Gray deja de pedir teselas nuevas.
    await expect
      .poll(async () => {
        const antes = peticionesConPath(
          solicitudes,
          'World_Light_Gray_Base',
        ).length;
        await page.waitForTimeout(400);
        return (
          peticionesConPath(solicitudes, 'World_Light_Gray_Base').length - antes
        );
      }, { timeout: 10_000 })
      .toBe(0);
    expect(lgAntes).toBeGreaterThan(0);
    await expect(frame.locator('.tf-mapa-aviso:visible')).toHaveCount(0);
  });

  test('el examen en mudo sin clave usa PNOA y nunca CARTO ni Esri Light Gray', async ({
    page,
  }) => {
    const solicitudes: Request[] = [];
    await servirMapasConfigAlicante(page, null);
    await instalarTeselasAlicante(page, new Set(), solicitudes);

    await page.goto('/app/callejero/alicante');
    const frame = await iframeAlicante(page);
    await expect
      .poll(
        () => peticionesConPath(solicitudes, 'World_Light_Gray_Base').length,
        { timeout: 15_000 },
      )
      .toBeGreaterThan(0);
    await frame.locator('#tab2Qz').click();
    await activarMudoExamen(frame);
    await frame.locator('#qzBtnStart').click();
    await expect(frame.locator('#qzpop')).toHaveClass(/show/, {
      timeout: 15_000,
    });

    await expect
      .poll(() => peticionesAlHost(solicitudes, 'ign.es').length, {
        timeout: 15_000,
      })
      .toBeGreaterThan(0);
    expect(peticionesAlHost(solicitudes, 'basemaps.cartocdn.com')).toHaveLength(
      0,
    );
    // Tras arrancar el examen, Esri Light Gray deja de pedir teselas nuevas.
    await expect
      .poll(async () => {
        const antes = peticionesConPath(
          solicitudes,
          'World_Light_Gray_Base',
        ).length;
        await page.waitForTimeout(400);
        return (
          peticionesConPath(solicitudes, 'World_Light_Gray_Base').length - antes
        );
      }, { timeout: 10_000 })
      .toBe(0);
  });

  test('"Mapa mudo · claro" sin clave usa PNOA y nunca Esri Light Gray ni CARTO', async ({
    page,
  }) => {
    const solicitudes: Request[] = [];
    await servirMapasConfigAlicante(page, null);
    await instalarTeselasAlicante(page, new Set(), solicitudes);

    await page.goto('/app/callejero/alicante');
    const frame = await iframeAlicante(page);
    // La etiqueta ya no atribuye el fondo mudo a Esri.
    await expect(
      frame.locator('label', { hasText: 'Mapa mudo · claro (Esri)' }),
    ).toHaveCount(0);
    await expect
      .poll(
        () => peticionesConPath(solicitudes, 'World_Light_Gray_Base').length,
        { timeout: 15_000 },
      )
      .toBeGreaterThan(0);
    const lgAntes = peticionesConPath(
      solicitudes,
      'World_Light_Gray_Base',
    ).length;

    await seleccionarBaseAlicante(frame, 'Mapa mudo · claro');
    await expect
      .poll(() => peticionesAlHost(solicitudes, 'ign.es').length, {
        timeout: 15_000,
      })
      .toBeGreaterThan(0);
    expect(peticionesAlHost(solicitudes, 'basemaps.cartocdn.com')).toHaveLength(
      0,
    );
    await page.waitForTimeout(700);
    expect(
      peticionesConPath(solicitudes, 'World_Light_Gray_Base').length,
    ).toBe(lgAntes);
  });

  test('Esri Topo a zoom 19: el respaldo OpenTopo limita el nativo a 17 y Reintentar restaura', async ({
    page,
  }) => {
    const solicitudes: Request[] = [];
    let fallarTopo = false;
    let fallarTodo = false;
    const erroresPagina: string[] = [];
    page.on('pageerror', (err) => erroresPagina.push(err.message));
    await servirMapasConfigAlicante(page, null);
    await page.route('**/*', async (route) => {
      const host = new URL(route.request().url()).hostname;
      if (['localhost', '127.0.0.1'].includes(host)) {
        await route.fallback();
        return;
      }
      const esEsri = host.endsWith('arcgisonline.com');
      const esOpenTopo = host.endsWith('opentopomap.org');
      if (!esEsri && !esOpenTopo) {
        await route.fallback();
        return;
      }
      solicitudes.push(route.request());
      if ((esEsri && fallarTopo) || ((esEsri || esOpenTopo) && fallarTodo)) {
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

    await page.goto('/app/callejero/alicante');
    const frame = await iframeAlicante(page);
    await seleccionarBaseAlicante(frame, 'Relieve (Esri Topo)');
    await subirZoomAlMaximo(frame, page);
    await expect
      .poll(
        () =>
          Math.max(
            0,
            ...peticionesConPath(solicitudes, 'World_Topo_Map').map(
              zoomDeAlicante,
            ),
          ),
        { timeout: 15_000 },
      )
      .toBe(19);

    // Esri Topo empieza a fallar → respaldo OpenTopoMap (nativo 17).
    fallarTopo = true;
    await frame.locator('.leaflet-control-zoom-out').click();
    await frame.locator('.leaflet-control-zoom-in').click();
    await expect(frame.locator('.tf-mapa-aviso:visible')).toBeVisible({
      timeout: 15_000,
    });
    await expect
      .poll(
        () => peticionesAlHost(solicitudes, 'tile.opentopomap.org').length,
        { timeout: 15_000 },
      )
      .toBeGreaterThan(0);
    const zoomsOtm = peticionesAlHost(
      solicitudes,
      'tile.opentopomap.org',
    ).map(zoomDeAlicante);
    expect(Math.max(...zoomsOtm)).toBeLessThanOrEqual(17);
    expect(zoomsOtm).not.toContain(19);

    // Fallo total primario+respaldo → Reintentar restaura Esri Topo a zoom 19.
    fallarTodo = true;
    for (let i = 0; i < 5; i += 1) {
      await frame.locator('.leaflet-control-zoom-out').click();
      await page.waitForTimeout(300);
    }
    await expect(frame.locator('.tf-mapa-error:visible')).toBeVisible({
      timeout: 15_000,
    });
    fallarTopo = false;
    fallarTodo = false;
    await frame.locator('.tf-mapa-error:visible .tf-mapa-reintentar').click();
    await expect(frame.locator('.tf-mapa-error:visible')).toHaveCount(0, {
      timeout: 15_000,
    });
    await subirZoomAlMaximo(frame, page);
    await expect
      .poll(
        () =>
          Math.max(
            0,
            ...peticionesConPath(solicitudes, 'World_Topo_Map').map(
              zoomDeAlicante,
            ),
          ),
        { timeout: 15_000 },
      )
      .toBe(19);
    expect(erroresPagina).toEqual([]);
  });

  test('el examen mudo con CARTO caído recupera en PNOA y muestra el aviso sin error', async ({
    page,
  }) => {
    const solicitudes: Request[] = [];
    const erroresPagina: string[] = [];
    page.on('pageerror', (err) => erroresPagina.push(err.message));
    await servirMapasConfigAlicante(page, 'CLAVE_ALC');
    await instalarTeselasAlicante(
      page,
      new Set(['basemaps.cartocdn.com']),
      solicitudes,
    );

    await page.goto('/app/callejero/alicante');
    const frame = await iframeAlicante(page);
    await frame.locator('#tab2Qz').click();
    await activarMudoExamen(frame);
    await frame.locator('#qzBtnStart').click();
    await expect(frame.locator('#qzpop')).toHaveClass(/show/, {
      timeout: 15_000,
    });

    // El primario mudo (CARTO light_nolabels) cae por completo → respaldo PNOA.
    await expect(frame.locator('.tf-mapa-aviso:visible')).toBeVisible({
      timeout: 15_000,
    });
    await expect(frame.locator('.tf-mapa-aviso:visible')).toContainText(
      'respaldo',
    );
    await expect
      .poll(() => peticionesAlHost(solicitudes, 'ign.es').length, {
        timeout: 15_000,
      })
      .toBeGreaterThan(0);

    // Regresión: PNOA se pide SIEMPRE con un `tilematrix` entero. El `flyTo` del
    // examen hace que `map.getZoom()` sea fraccional; un `redraw` sin redondear
    // pedía `tilematrix=8.9999…`, el servidor respondía con algo no-imagen y el
    // navegador lo bloqueaba (ORB) → 25 falsos tileerror agotaban el respaldo.
    const ign = peticionesAlHost(solicitudes, 'ign.es');
    for (const request of ign) {
      const tilematrix = new URL(request.url()).searchParams.get('tilematrix');
      expect(tilematrix).not.toBeNull();
      expect(Number.isInteger(Number(tilematrix))).toBe(true);
    }

    // Se ve PNOA completo y NO aparece el cuadro de error.
    await expect
      .poll(
        () =>
          frame
            .locator('#mapa img.leaflet-tile-loaded')
            .evaluateAll(
              (images) =>
                images.filter((img) => {
                  try {
                    return new URL(img.src).hostname.endsWith('ign.es');
                  } catch {
                    return false;
                  }
                }).length,
            ),
        { timeout: 15_000 },
      )
      .toBeGreaterThan(0);
    await expect(frame.locator('.tf-mapa-error:visible')).toHaveCount(0);
    expect(erroresPagina).toEqual([]);
  });

  test('tras recuperar en PNOA, el fallo del respaldo ofrece Reintentar y restaura CARTO', async ({
    page,
  }) => {
    const solicitudes: Request[] = [];
    let fallarCarto = true;
    let fallarPnoa = false;
    await servirMapasConfigAlicante(page, 'CLAVE_ALC');
    await page.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (['localhost', '127.0.0.1'].includes(url.hostname)) {
        await route.fallback();
        return;
      }
      const esCarto =
        url.hostname === 'basemaps.cartocdn.com' ||
        url.hostname.endsWith('.basemaps.cartocdn.com');
      const esIgn =
        url.hostname === 'www.ign.es' || url.hostname.endsWith('.ign.es');
      if (!esCarto && !esIgn) {
        await route.fallback();
        return;
      }
      solicitudes.push(route.request());
      if ((esCarto && fallarCarto) || (esIgn && fallarPnoa)) {
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

    await page.goto('/app/callejero/alicante');
    const frame = await iframeAlicante(page);
    await frame.locator('#tab2Qz').click();
    await activarMudoExamen(frame);
    await frame.locator('#qzBtnStart').click();
    await expect(frame.locator('#qzpop')).toHaveClass(/show/, {
      timeout: 15_000,
    });

    // Primero CARTO cae → respaldo PNOA operativo con aviso.
    await expect(frame.locator('.tf-mapa-aviso:visible')).toBeVisible({
      timeout: 15_000,
    });
    await expect
      .poll(() => peticionesAlHost(solicitudes, 'www.ign.es').length, {
        timeout: 15_000,
      })
      .toBeGreaterThan(0);

    // Ahora el respaldo PNOA también falla: tres fallos reales → Reintentar.
    fallarPnoa = true;
    for (let i = 0; i < 5; i += 1) {
      await frame.locator('.leaflet-control-zoom-out').click();
      await page.waitForTimeout(250);
    }
    await expect(frame.locator('.tf-mapa-error:visible')).toBeVisible({
      timeout: 15_000,
    });
    await expect(frame.locator('.tf-mapa-aviso:visible')).toHaveCount(0);
    await expect(
      frame.locator('.tf-mapa-error:visible .tf-mapa-reintentar'),
    ).toBeVisible();

    // Reintentar restaura el primario CARTO (ya operativo) y oculta el error.
    const antes = peticionesAlHost(solicitudes, 'basemaps.cartocdn.com').length;
    fallarCarto = false;
    fallarPnoa = false;
    await frame.locator('.tf-mapa-error:visible .tf-mapa-reintentar').click();
    await expect(frame.locator('.tf-mapa-error:visible')).toHaveCount(0, {
      timeout: 15_000,
    });
    await expect
      .poll(
        () => peticionesAlHost(solicitudes, 'basemaps.cartocdn.com').length,
        { timeout: 15_000 },
      )
      .toBeGreaterThan(antes);
  });
});
