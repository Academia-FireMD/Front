import { expect, test, type Page, type Route } from '@playwright/test';
import { loginAsAlumnoMock } from './helpers/auth.helper';

const DATOS_COMPLETOS = {
  nombre: 'Ana',
  apellidos: 'García',
  empresa: '',
  direccion: 'Calle Uno 1',
  direccion2: '',
  poblacion: 'Valencia',
  provincia: 'Valencia',
  codigoPostal: '46001',
  pais: 'ES',
  nif: '12345678Z',
};

function estadoFiscal(
  cambios: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    datos: { ...DATOS_COMPLETOS },
    faltantes: [],
    invalidos: [],
    conflictos: [],
    completo: true,
    version: 'v1',
    ...cambios,
  };
}

const fiscalIncompleto = estadoFiscal({
  datos: { ...DATOS_COMPLETOS, direccion: '' },
  faltantes: ['direccion'],
  completo: false,
});

async function json(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

test.describe('Compra COF con ficha fiscal común', () => {
  let fiscalActual: Record<string, unknown>;
  let lecturasFiscales: number;
  let escriturasFiscales: Array<Record<string, unknown>>;
  let compras: Array<Record<string, unknown>>;
  let forzarPrecondicionEnPrimeraCompra: boolean;
  let solicitudesApiSinMock: string[];
  let externosBloqueados: string[];

  test.beforeEach(async ({ page, baseURL }) => {
    if (!baseURL) {
      throw new Error('La prueba requiere una baseURL local configurada.');
    }
    const appOrigin = new URL(baseURL).origin;
    fiscalActual = estadoFiscal();
    lecturasFiscales = 0;
    escriturasFiscales = [];
    compras = [];
    forzarPrecondicionEnPrimeraCompra = false;
    solicitudesApiSinMock = [];
    externosBloqueados = [];

    // Se registra primero: los mocks específicos añadidos después tienen
    // prioridad, y toda salida no mockeada se aborta antes de la red real.
    await page.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.origin === appOrigin) {
        await route.continue();
        return;
      }

      if (['localhost', '127.0.0.1'].includes(url.hostname)) {
        solicitudesApiSinMock.push(
          `${route.request().method()} ${url.origin}${url.pathname}`,
        );
      } else {
        externosBloqueados.push(`${route.request().method()} ${url.origin}`);
      }
      await route.abort('blockedbyclient');
    });

    await loginAsAlumnoMock(page);

    await page.route('**/examenes/simulacros/tienda', (route) =>
      json(route, [
        {
          id: 50,
          titulo: 'Simulacro fiscal de prueba',
          descripcion: 'Flujo local interceptado',
          relevancia: ['VALENCIA_AYUNTAMIENTO'],
          precio: 9.9,
          woocommerceProductId: '1432',
          woocommerceSku: 'VALENCIA-SIMULACRO',
          estado: 'COMPRABLE',
        },
      ]),
    );
    await page.route('**/cursos/mios', (route) => json(route, []));
    await page.route('**/planificaciones/configuracion', (route) =>
      json(route, null),
    );
    await page.route('**/user/tutores', (route) => json(route, []));

    await page.route('**/compras/datos-fiscales', async (route) => {
      if (route.request().method() === 'GET') {
        lecturasFiscales += 1;
        await json(route, fiscalActual);
        return;
      }
      if (route.request().method() === 'PUT') {
        const body = route.request().postDataJSON() as Record<string, unknown>;
        escriturasFiscales.push(body);
        const datos = body['datos'] as Record<string, string>;
        fiscalActual = estadoFiscal({
          datos: { ...DATOS_COMPLETOS, ...datos },
          completo: true,
          version: 'v2',
        });
        await json(route, fiscalActual);
        return;
      }
      await json(route, { message: 'Método no esperado' }, 405);
    });

    await page.route('**/examenes/comprar-simulacro-cof/50', async (route) => {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      compras.push(body);
      if (forzarPrecondicionEnPrimeraCompra && compras.length === 1) {
        fiscalActual = structuredClone(fiscalIncompleto);
        await json(
          route,
          {
            success: false,
            requiereDatosFiscales: true,
            codigo: 'DATOS_FISCALES_INCOMPLETOS',
            mensaje: 'Completa la dirección',
          },
          400,
        );
        return;
      }
      await json(route, {
        success: true,
        consumibleId: 900,
        mensaje: 'Compra de prueba confirmada',
      });
    });
  });

  async function abrirTienda(page: Page): Promise<void> {
    await page.goto('/app/simulacros-tienda');
    await expect(
      page.getByRole('heading', { name: 'Tienda de simulacros' }),
    ).toBeVisible();
    await page.getByTestId('comprar-btn').click();
    await expect(page.getByTestId('tienda-confirmar-btn')).toBeVisible();
  }

  async function comprobarAislamiento(): Promise<void> {
    expect(solicitudesApiSinMock).toEqual([]);
    // El guard global aborta cualquier origen externo; en estos flujos tampoco
    // debería haber intentos hacia terceros.
    expect(externosBloqueados).toEqual([]);
  }

  test('ficha completa: sin formulario adicional y un único cobro', async ({
    page,
  }) => {
    await abrirTienda(page);
    await expect(page.getByTestId('tienda-confirm-precio')).toContainText(
      '9,90 €',
    );
    await page.getByTestId('tienda-confirmar-btn').click();

    await expect(page.getByTestId('badge-comprado')).toBeVisible();
    expect(lecturasFiscales).toBe(1);
    expect(escriturasFiscales).toHaveLength(0);
    expect(compras).toHaveLength(1);
    expect(compras[0]['idempotencyKey']).toMatch(/^simulacro_v2_/);
    expect(compras[0]['importeConfirmado']).toBe(9.9);
    await comprobarAislamiento();
  });

  test('datos pendientes: guarda solo el hueco y requiere otro clic para pagar', async ({
    page,
  }) => {
    fiscalActual = structuredClone(fiscalIncompleto);
    await abrirTienda(page);
    await page.getByTestId('tienda-confirmar-btn').click();

    await expect(page.getByText('Completa tus datos fiscales')).toBeVisible();
    await expect(page.locator('#fiscal-direccion')).toBeVisible();
    await expect(page.locator('#fiscal-nif')).toHaveCount(0);
    expect(compras).toHaveLength(0);

    await page.locator('#fiscal-direccion').fill('Avenida Dos 42');
    await page.getByRole('button', { name: 'Guardar datos' }).click();
    await expect(page.getByText('Completa tus datos fiscales')).toHaveCount(0);

    expect(escriturasFiscales).toEqual([
      {
        datos: { direccion: 'Avenida Dos 42' },
        version: 'v1',
      },
    ]);
    expect(compras).toHaveLength(0);

    await page.getByTestId('tienda-confirmar-btn').click();
    await expect(page.getByTestId('badge-comprado')).toBeVisible();
    expect(lecturasFiscales).toBe(2);
    expect(compras).toHaveLength(1);
    await comprobarAislamiento();
  });

  test('cancelar la ficha no compra y deja habilitado el botón original', async ({
    page,
  }) => {
    fiscalActual = structuredClone(fiscalIncompleto);
    await abrirTienda(page);
    await page.getByTestId('tienda-confirmar-btn').click();
    await expect(page.getByText('Completa tus datos fiscales')).toBeVisible();

    await page.getByRole('button', { name: 'Cancelar' }).last().click();
    await expect(page.getByText('Completa tus datos fiscales')).toHaveCount(0);
    await expect(page.getByTestId('tienda-confirmar-btn')).toBeEnabled();
    expect(compras).toHaveLength(0);

    await page.getByTestId('tienda-confirmar-btn').click();
    await expect(page.getByText('Completa tus datos fiscales')).toBeVisible();
    expect(compras).toHaveLength(0);
    await comprobarAislamiento();
  });

  test('precondición HTTP 400 vuelve al gate y conserva la clave del intento', async ({
    page,
  }) => {
    forzarPrecondicionEnPrimeraCompra = true;
    await abrirTienda(page);
    await page.getByTestId('tienda-confirmar-btn').click();

    await expect(page.getByText('Completa tus datos fiscales')).toBeVisible();
    expect(compras).toHaveLength(1);
    expect(compras[0]['idempotencyKey']).toMatch(/^simulacro_v2_/);
    await expect(page.getByTestId('tienda-checkout-dialog')).toBeHidden();

    await page.locator('#fiscal-direccion').fill('Avenida Dos 42');
    await page.getByRole('button', { name: 'Guardar datos' }).click();
    await expect(page.getByText('Completa tus datos fiscales')).toHaveCount(0);
    expect(compras).toHaveLength(1);

    await page.getByTestId('tienda-confirmar-btn').click();
    await expect(page.getByTestId('badge-comprado')).toBeVisible();
    expect(compras).toHaveLength(2);
    expect(compras[1]['idempotencyKey']).toBe(compras[0]['idempotencyKey']);
    await comprobarAislamiento();
  });
});
