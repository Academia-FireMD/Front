import { expect, test } from '@playwright/test';
import userAdminFixture from './fixtures/user-admin.json';
import { loginAsAdminMock } from './helpers/auth.helper';

const invoice = {
  id: 5,
  contasimpleId: 'CS-ORIGINAL-5',
  numero: 'F-2026-0088',
  serie: 'F',
  tipo: 'NORMAL',
  estado: 'EMITIDA',
  usuarioId: 7,
  woocommerceOrderId: '123',
  clienteNombre: 'Isabel Marcos',
  clienteEmail: 'isabel@example.test',
  clienteNif: '12345678Z',
  clienteProvincia: 'Madrid',
  concepto: 'Suscripción Premium',
  baseImponible: 66.03,
  tipoIva: 21,
  cuotaIva: 13.87,
  total: 79.9,
  dryRun: false,
  requiereRevisionFiscal: false,
  createdAt: '2026-08-20T10:00:00.000Z',
  updatedAt: '2026-08-20T10:00:00.000Z',
};

test('admin previsualiza y confirma una devolución parcial idempotente', async ({
  page,
}) => {
  let postedBody: unknown = null;
  const failedResponses: string[] = [];
  page.on('response', (response) => {
    if (
      response.status() >= 400 &&
      !response.url().endsWith('/ai-assistant/token')
    ) {
      failedResponses.push(`${response.status()} ${response.url()}`);
    }
  });
  page.on('requestfailed', (request) => {
    if (request.failure()?.errorText === 'net::ERR_ABORTED') return;
    failedResponses.push(
      `FAILED ${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`,
    );
  });
  await page.route('**/user/obtain-avaliable-subscriptions', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '[]',
    }),
  );
  await page.route('**/labels', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '[]',
    }),
  );
  await page.route('**/user/all', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [],
        pagination: { skip: 0, take: 10, count: 0 },
      }),
    }),
  );
  await page.route('**/admin/facturas**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (
      request.method() === 'GET' &&
      url.pathname.endsWith('/admin/facturas')
    ) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          facturas: [invoice],
          total: 1,
          pagina: 1,
          porPagina: 10,
          totalPaginas: 1,
        }),
      });
      return;
    }
    if (
      request.method() === 'POST' &&
      url.pathname.endsWith('/admin/facturas/5/devoluciones')
    ) {
      postedBody = request.postDataJSON();
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 10,
          estado: 'COMPLETED',
          importeTotal: 20.98,
          baseImponible: 17.34,
          cuotaIva: 3.64,
          tipoIva: 21,
          wooRefundId: '900',
          rectificativaId: 6,
          rectificativaNumero: 'R-2026-0012',
          contasimpleId: 'CS-R-12',
          ultimoError: null,
        }),
      });
      return;
    }
    await route.continue();
  });

  await loginAsAdminMock(page, userAdminFixture);
  await page.goto('/app/facturacion');
  await expect(page.getByText('Isabel Marcos')).toBeVisible();
  await page.locator('button:has(.pi-arrow-circle-left)').first().click();

  const dialog = page.getByRole('dialog');
  const expectedUi = process.env['EXPECTED_REFUND_UI'] ?? 'new';
  if (expectedUi === 'old') {
    await expect(dialog.getByText('Devolver factura')).toBeVisible();
  } else {
    await expect(
      dialog.getByText('Devolver y rectificar factura'),
    ).toBeVisible();
    const amount = dialog.locator('p-inputnumber input');
    await amount.fill('20,98');
    await amount.blur();
    await dialog.locator('textarea').fill('IVA duplicado');
    await expect(dialog.getByText(/Base a rectificar:/)).toBeVisible();
    await expect(dialog.getByText(/17,34/)).toBeVisible();
    await expect(dialog.getByText(/3,64/)).toBeVisible();
  }

  const screenshotPath = process.env['REFUND_SCREENSHOT_PATH'];
  if (screenshotPath) {
    expect(failedResponses).toEqual([]);
    await expect(page.locator('.toast-error')).toHaveCount(0);
    await dialog.screenshot({ path: screenshotPath });
  }

  if (expectedUi !== 'old') {
    await dialog.getByRole('button', { name: 'Devolver y rectificar' }).click();
    await expect(dialog).toBeHidden();
    await expect(
      page.getByText(
        'Reembolso 900 y rectificativa R-2026-0012 completados',
      ),
    ).toBeVisible();
    await expect(page.locator('.toast-error')).toHaveCount(0);
    expect(failedResponses).toEqual([]);
    expect(postedBody).toEqual(
      expect.objectContaining({
        importeTotal: 20.98,
        motivo: 'IVA duplicado',
        idempotencyKey: expect.any(String),
      }),
    );
  }
});
