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
  'basemaps.cartocdn.com',
  'ign.es',
  'nominatim.openstreetmap.org',
  'router.project-osrm.org',
  'overpass-api.de',
];

function usuarioCon(
  oposiciones: Oposicion[],
  rol: Rol = 'ALUMNO',
): Record<string, unknown> {
  return {
    ...userAlumnoFixture,
    rol,
    oposiciones,
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
