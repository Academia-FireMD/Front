/**
 * E2E — Curso nativo de Hidráulica (bloque INTERACTIVO) — 2026-10-28.
 *
 * Cubre el flujo alumno real con el artifact final aprobado servido por el
 * endpoint protegido mockeado:
 *  - iframe Blob, sin bearer ni localStorage anónimo dentro del frame;
 *  - práctica real numérica y test, guardado serial y restauración en otra
 *    cuenta/navegador (dos contextos) desde el backend mockeado;
 *  - offline: pending y reintento al volver online;
 *  - simulacro real con una pregunta numérica + una test vía código de Clase;
 *  - Clase: copiar código y renderizar nombres/códigos hostiles sin XSS.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { expect, test, type Page } from '@playwright/test';
import { loginAsRoleMock } from './helpers/auth.helper';
import userAlumnoFixture from './fixtures/user-alumno.json';

// Fixture privado y determinista (gzip -n): el test no depende del report
// local ni del repo Server. `HIDRAULICA_ASSET` queda solo como override local.
const FIXTURE_PATH = join(__dirname, 'fixtures', 'hidraulica-r06.html.gz');
const FIXTURE_SHA256 =
  '03f2e8a9285e4d76ece4c68e2c170256d50d29aed1d15c2e36d13eaa8f48f7e8';
const fixtureHtml = gunzipSync(readFileSync(FIXTURE_PATH)).toString('utf8');
const fixtureSha256 = createHash('sha256').update(fixtureHtml).digest('hex');
const html = process.env['HIDRAULICA_ASSET']
  ? readFileSync(process.env['HIDRAULICA_ASSET'], 'utf8')
  : fixtureHtml;
const htmlSha256 = createHash('sha256').update(html).digest('hex');

const CURSO_SLUG = 'hidraulica-bomberos';
const LECCION_ID = 2002;
const BLOQUE_ID = 501;
const BASE =
  process.env['E2E_BASE_URL'] ||
  `http://localhost:${process.env['E2E_PORT'] || '4201'}`;

const curso = {
  id: 900,
  titulo: 'Hidráulica para Bomberos',
  slug: CURSO_SLUG,
  descripcion: 'Curso de prueba',
  estado: 'PUBLICADO',
  esGratuito: false,
  esClaseGrabada: false,
  relevancia: [],
  wooProductId: null,
  precio: null,
  secciones: [
    {
      id: 1,
      cursoId: 900,
      titulo: 'Aplicación práctica',
      orden: 0,
      lecciones: [
        {
          id: LECCION_ID,
          seccionId: 1,
          titulo: 'Aplicación práctica de Hidráulica',
          orden: 0,
          tipo: 'TEXTO',
          bloques: [
            {
              id: BLOQUE_ID,
              leccionId: LECCION_ID,
              orden: 0,
              tipo: 'INTERACTIVO',
              aplicacionCodigo: 'HIDRAULICA',
            },
          ],
        },
      ],
    },
  ],
};

interface EstadoGuardado {
  estado: Record<string, unknown> | null;
  revision: number;
}

interface ServidorMock {
  guardado: EstadoGuardado;
  putCalls: { estado: Record<string, unknown> }[];
  progressCalls: number;
  applicationGets: number;
  stateGets: number;
  offline: boolean;
  delayGetMs: number;
}

function crearServidor(): ServidorMock {
  return {
    guardado: { estado: null, revision: 0 },
    putCalls: [],
    progressCalls: 0,
    applicationGets: 0,
    stateGets: 0,
    offline: false,
    delayGetMs: 0,
  };
}

async function mockAlumno(
  page: Page,
  servidor: ServidorMock,
  bloques?: unknown[],
): Promise<void> {
  const isXhr = (req: import('@playwright/test').Request) => {
    const tipo = req.resourceType();
    return tipo === 'xhr' || tipo === 'fetch';
  };
  const cursoMock = {
    ...curso,
    secciones: [
      {
        ...curso.secciones[0],
        lecciones: [
          {
            ...curso.secciones[0].lecciones[0],
            bloques: bloques ?? curso.secciones[0].lecciones[0].bloques,
          },
        ],
      },
    ],
  };

  await page.route('**/cursos/mios', (route) => {
    if (!isXhr(route.request())) return route.continue();
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 1,
          cursoId: cursoMock.id,
          usuarioId: 1,
          curso: cursoMock,
          progreso: [],
        },
      ]),
    });
  });

  await page.route(`**/cursos/${CURSO_SLUG}`, (route) => {
    if (!isXhr(route.request())) return route.continue();
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ curso: cursoMock, tieneAcceso: true, progreso: [] }),
    });
  });

  await page.route(new RegExp(`/lecciones/${LECCION_ID}(\\?.*)?$`), (route) => {
    if (!isXhr(route.request())) return route.continue();
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          leccion: cursoMock.secciones[0].lecciones[0],
          playbackUrls: {},
        }),
      });
    }
    if (route.request().method() === 'POST') {
      servidor.progressCalls += 1;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    }
    return route.continue();
  });

  await page.route(
    new RegExp(`/lecciones/${LECCION_ID}/progreso/interactivo(\\?.*)?$`),
    async (route) => {
      if (!isXhr(route.request())) return route.continue();
      const metodo = route.request().method();
      if (metodo === 'GET') {
        servidor.stateGets += 1;
        if (servidor.delayGetMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, servidor.delayGetMs));
        }
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(servidor.guardado),
        });
      }
      if (metodo === 'PUT') {
        if (servidor.offline) {
          return route.abort('internetdisconnected');
        }
        const body = route.request().postDataJSON() as {
          estado: Record<string, unknown>;
        };
        servidor.putCalls.push(body);
        servidor.guardado = {
          estado: body.estado,
          revision: servidor.guardado.revision + 1,
        };
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(servidor.guardado),
        });
      }
      return route.continue();
    },
  );

  await page.route(`**/cursos/bloques/${BLOQUE_ID}/aplicacion`, (route) => {
    servidor.applicationGets += 1;
    return route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      headers: {
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
      body: html,
    });
  });
}

async function abrirLeccion(
  page: Page,
  servidor: ServidorMock,
  bloques?: unknown[],
): Promise<ReturnType<Page['frameLocator']>> {
  await mockAlumno(page, servidor, bloques);
  await page.goto(`/app/cursos/${CURSO_SLUG}/leccion/${LECCION_ID}`);
  const frame = page.frameLocator('[data-testid="hidraulica-iframe"]');
  await expect(frame.locator('#view-inicio h1')).toBeVisible({ timeout: 20_000 });
  return frame;
}

async function esperarGuardado(page: Page): Promise<void> {
  await expect(page.getByTestId('hidraulica-sync-estado')).toContainText(
    'guardado',
    { timeout: 10_000 },
  );
}

async function practicar(page: Page, frame: ReturnType<Page['frameLocator']>, bloque: string): Promise<void> {
  await frame.getByRole('button', { name: 'Practicar', exact: true }).click();
  await frame.locator('.chips .chip', { hasText: 'Todos' }).first().click();
  await frame
    .getByRole('button', { name: new RegExp('^' + bloque + '\\s') })
    .click();
  await frame.getByRole('button', { name: 'Empezar', exact: true }).click();
}

test.describe('Hidráulica · aula nativa', () => {
  test.beforeEach(async ({ context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
      origin: BASE,
    });
  });

  test('práctica numérica y test reales, guardado y restauración en otro contexto', async ({
    page,
    browser,
  }) => {
    const servidor = crearServidor();
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(String(error)));

    await loginAsRoleMock(page, { rol: 'ALUMNO', userFixture: userAlumnoFixture });
    const frame = await abrirLeccion(page, servidor);
    await expect(page.getByTestId('hidraulica-sync-estado')).toBeVisible();

    // El iframe no usa la clave anónima del standalone.
    const frameInterno = page.frames().find((f) => f.url().startsWith('blob:'));
    expect(frameInterno).toBeTruthy();
    const claves = await frameInterno!.evaluate(() => Object.keys(localStorage));
    expect(claves).not.toContain('tf_hidraulica_v1');

    // Práctica numérica: bloque 10 solo tiene problemas numéricos.
    await practicar(page, frame, 'B10');
    await frame.locator('.card input[id^="num-"]').first().fill('1');
    await frame.getByRole('button', { name: 'Comprobar', exact: true }).click();
    await expect
      .poll(() => servidor.putCalls.length, { timeout: 10_000 })
      .toBeGreaterThan(0);
    await esperarGuardado(page);

    // Práctica test: bloque 1 solo tiene problemas tipo test.
    await frame.getByRole('button', { name: 'Inicio', exact: true }).click();
    await practicar(page, frame, 'B1');
    await frame.locator('.card .opts .opt').first().click();
    await expect
      .poll(() => servidor.putCalls.length, { timeout: 10_000 })
      .toBeGreaterThan(1);
    await esperarGuardado(page);

    // La interacción no crea progreso escalar ni completa la lección sola.
    expect(servidor.progressCalls).toBe(0);
    expect(servidor.guardado.estado).not.toBeNull();

    // Segundo contexto/navegador: carga lo acumulado desde el backend.
    const context2 = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      permissions: ['clipboard-read', 'clipboard-write'],
    });
    const page2 = await context2.newPage();
    const errores2: string[] = [];
    page2.on('pageerror', (error) => errores2.push(String(error)));
    await loginAsRoleMock(page2, {
      rol: 'ALUMNO',
      userFixture: userAlumnoFixture,
    });
    const frame2 = await abrirLeccion(page2, servidor);
    await expect(frame2.locator('#view-inicio .tile .v').first()).toHaveText(
      '2 / 92',
      { timeout: 10_000 },
    );
    await expect(frame2.locator('#view-inicio h1')).toContainText(
      'Tu entrenamiento',
    );

    expect(pageErrors).toEqual([]);
    expect(errores2).toEqual([]);
    await context2.close();
  });

  test('lección INTERACTIVO+TEXTO+INTERACTIVO: un solo iframe y un solo contexto', async ({
    page,
  }) => {
    expect(fixtureSha256).toBe(FIXTURE_SHA256);
    expect(htmlSha256).toBe(FIXTURE_SHA256);
    const servidor = crearServidor();
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(String(error)));
    await loginAsRoleMock(page, {
      rol: 'ALUMNO',
      userFixture: userAlumnoFixture,
    });
    const frame = await abrirLeccion(page, servidor, [
      {
        id: 501,
        leccionId: LECCION_ID,
        orden: 0,
        tipo: 'INTERACTIVO',
        aplicacionCodigo: 'HIDRAULICA',
      },
      {
        id: 502,
        leccionId: LECCION_ID,
        orden: 1,
        tipo: 'TEXTO',
        contenidoMarkdown: 'Texto intermedio entre aplicaciones',
      },
      {
        id: 503,
        leccionId: LECCION_ID,
        orden: 2,
        tipo: 'INTERACTIVO',
        aplicacionCodigo: 'HIDRAULICA',
      },
    ]);

    await expect(page.locator('[data-testid="hidraulica-iframe"]')).toHaveCount(
      1,
    );
    await expect(page.locator('app-bloque-render')).toHaveCount(2);
    await expect(
      page.locator('app-bloque-render').nth(1),
    ).toContainText('Texto intermedio entre aplicaciones');
    expect(servidor.applicationGets).toBe(1);
    expect(servidor.stateGets).toBe(1);

    // Textos de cuenta en modo integrado (no "solo en este navegador").
    await expect(frame.locator('#foot')).toContainText(
      'el progreso se sincroniza con tu cuenta',
    );
    await frame.getByRole('button', { name: 'Fórmulas', exact: true }).click();
    await expect(frame.locator('#view-formulas .lead')).toContainText(
      'Tu progreso se sincroniza con tu cuenta',
    );
    await expect(frame.locator('#view-formulas .lead')).not.toContainText(
      'se guarda en este navegador',
    );
    await frame.getByRole('button', { name: 'Clase', exact: true }).click();
    await expect(frame.locator('#view-clase .lead')).toContainText(
      'Además de guardarse en tu cuenta',
    );
    await expect(frame.locator('#view-clase .lead')).not.toContainText(
      'Sin servidor ni cuentas',
    );
    await frame.getByRole('button', { name: 'Inicio', exact: true }).click();

    await practicar(page, frame, 'B10');
    await frame.locator('.card input[id^="num-"]').first().fill('1');
    await frame.getByRole('button', { name: 'Comprobar', exact: true }).click();
    await expect
      .poll(() => servidor.putCalls.length, { timeout: 10_000 })
      .toBeGreaterThan(0);
    await esperarGuardado(page);
    expect(servidor.applicationGets).toBe(1);
    expect(servidor.stateGets).toBe(1);
    expect(pageErrors).toEqual([]);
  });

  test('offline: snapshot pending y reintento serial al recuperar conexión', async ({
    page,
    context,
  }) => {
    const servidor = crearServidor();
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(String(error)));
    await loginAsRoleMock(page, { rol: 'ALUMNO', userFixture: userAlumnoFixture });
    const frame = await abrirLeccion(page, servidor);

    servidor.offline = true;
    await context.setOffline(true);
    await practicar(page, frame, 'B10');
    await frame.locator('.card input[id^="num-"]').first().fill('1');
    await frame.getByRole('button', { name: 'Comprobar', exact: true }).click();
    await expect(page.getByTestId('hidraulica-sync-estado')).toContainText(
      /Sin conexión|No se pudo guardar/,
      { timeout: 10_000 },
    );
    expect(servidor.putCalls).toHaveLength(0);

    servidor.offline = false;
    await context.setOffline(false);
    await expect
      .poll(() => servidor.putCalls.length, { timeout: 15_000 })
      .toBe(1);
    await esperarGuardado(page);
    expect(pageErrors).toEqual([]);
  });

  test('simulacro real con pregunta numérica y test mediante código de Clase', async ({
    page,
  }) => {
    const servidor = crearServidor();
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(String(error)));
    await loginAsRoleMock(page, { rol: 'ALUMNO', userFixture: userAlumnoFixture });
    const frame = await abrirLeccion(page, servidor);

    // Código TFS-J con dos preguntas conocidas: TF-01 (numérica) y CAT-15 (test).
    const sesion = {
      v: 1,
      q: ['TF-01', 'CAT-15'],
      tpq: 90,
      pen: false,
      t: Date.now(),
    };
    const code =
      'TFS-J' +
      Buffer.from(JSON.stringify(sesion), 'utf8')
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

    await frame.getByRole('button', { name: 'Clase', exact: true }).click();
    await frame
      .locator('textarea[aria-label="Código de sesión"]')
      .fill(code);
    await frame
      .getByRole('button', { name: 'Empezar la sesión', exact: true })
      .click();

    // Pregunta 1: numérica.
    await frame.locator('.card input[id^="num-"]').first().fill('1');
    await frame.getByRole('button', { name: 'Guardar', exact: true }).click();
    await frame.getByRole('button', { name: 'Siguiente', exact: true }).click();
    // Pregunta 2: test.
    await frame.locator('.card .opts .opt').first().click();
    await frame.getByRole('button', { name: 'Entregar', exact: true }).first().click();

    await expect(frame.getByText('NOTA DEL SIMULACRO')).toBeVisible({
      timeout: 10_000,
    });
    await expect
      .poll(() => servidor.putCalls.length, { timeout: 10_000 })
      .toBeGreaterThan(0);
    await esperarGuardado(page);
    const estadoFinal = servidor.putCalls.at(-1)!.estado as {
      sims?: unknown[];
    };
    expect(Array.isArray(estadoFinal.sims)).toBe(true);
    expect(estadoFinal.sims!.length).toBeGreaterThan(0);
    expect(pageErrors).toEqual([]);
  });

  test('Clase: copia el código al portapapeles y pinta nombres/códigos hostiles sin XSS', async ({
    page,
  }) => {
    const servidor = crearServidor();
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(String(error)));
    await loginAsRoleMock(page, { rol: 'ALUMNO', userFixture: userAlumnoFixture });
    const frame = await abrirLeccion(page, servidor);
    const frameInterno = page.frames().find((f) => f.url().startsWith('blob:'))!;

    await frame.getByRole('button', { name: 'Clase', exact: true }).click();
    await frame
      .locator('#alumno')
      .fill('<img src=x onerror="window.__xss=1">');
    await frame.getByRole('button', { name: 'Generar código', exact: true }).click();
    const codigoLocator = frame.locator(
      'textarea[aria-label="Código de progreso"]',
    );
    await expect(codigoLocator).not.toHaveValue('', { timeout: 5_000 });
    const code = await codigoLocator.inputValue();
    expect(code.startsWith('TFP-')).toBe(true);
    await frame.getByRole('button', { name: 'Copiar', exact: true }).click();
    await expect
      .poll(() => frameInterno.evaluate(() => navigator.clipboard.readText()), {
        timeout: 5_000,
      })
      .toBe(code);

    await frame.getByRole('button', { name: 'Soy profesor', exact: true }).click();
    await frame
      .locator('textarea[aria-label="Códigos de progreso"]')
      .fill(code);
    await frame.getByRole('button', { name: 'Leer códigos', exact: true }).click();
    await expect(frame.locator('.t tbody tr').first()).toBeVisible({
      timeout: 5_000,
    });
    expect(await frameInterno.evaluate(() => (window as any).__xss)).toBeUndefined();
    expect(await frame.locator('.t img').count()).toBe(0);

    // Código TFS con q no-array: error controlado, sin crash.
    await frame
      .locator('textarea[aria-label="Códigos de progreso"]')
      .fill('TFS-J' + Buffer.from('{"v":1,"q":"<b>x</b>"}').toString('base64url'));
    await frame.getByRole('button', { name: 'Leer códigos', exact: true }).click();
    await expect(frame.locator('#view-clase')).toBeVisible();
    expect(pageErrors).toEqual([]);
  });

  test('bloquea el inicio hasta recibir el estado del servidor', async ({
    page,
  }) => {
    const servidor = crearServidor();
    servidor.delayGetMs = 1500;
    await loginAsRoleMock(page, {
      rol: 'ALUMNO',
      userFixture: userAlumnoFixture,
    });
    const frame = await abrirLeccion(page, servidor).catch(async () => {
      // abrirLeccion espera la init; aquí queremos interactuar antes.
      return page.frameLocator('[data-testid="hidraulica-iframe"]');
    });
    await expect(
      page.locator('[data-testid="hidraulica-sync-estado"]'),
    ).toContainText(/Cargando/);
    await frame.getByRole('button', { name: 'Practicar', exact: true }).click();
    await frame
      .getByRole('button', { name: /^B10\s/ })
      .click();
    await frame.getByRole('button', { name: 'Empezar', exact: true }).click();
    await expect(frame.getByText(/Espera a que se cargue tu progreso/)).toBeVisible();
    await expect(frame.locator('.card')).toHaveCount(0);
    await expect(
      page.locator('[data-testid="hidraulica-sync-estado"]'),
    ).toContainText(/progreso (cargado|guardado)/i, { timeout: 10_000 });
    await frame.getByRole('button', { name: 'Empezar', exact: true }).click();
    await expect(frame.locator('.card')).toHaveCount(1);
  });

  test('aula móvil: el iframe ocupa el ancho y guarda progreso', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const servidor = crearServidor();
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(String(error)));
    await loginAsRoleMock(page, {
      rol: 'ALUMNO',
      userFixture: userAlumnoFixture,
    });
    const frame = await abrirLeccion(page, servidor);
    const caja = await page
      .locator('[data-testid="hidraulica-iframe"]')
      .boundingBox();
    expect(caja).not.toBeNull();
    expect(caja!.width).toBeLessThanOrEqual(390);
    expect(caja!.height).toBeGreaterThan(400);

    await practicar(page, frame, 'B10');
    await frame.locator('.card input[id^="num-"]').first().fill('1');
    await frame.getByRole('button', { name: 'Comprobar', exact: true }).click();
    await expect
      .poll(() => servidor.putCalls.length, { timeout: 10_000 })
      .toBeGreaterThan(0);
    await esperarGuardado(page);
    expect(pageErrors).toEqual([]);
  });
});
