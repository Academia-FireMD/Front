import { expect, test } from '@playwright/test';
import { servidorEstudio } from './estudio.fixture';
import { documentoPdf } from './documento-pdf.fixture';

for (const width of [360, 390]) {
  test(`catálogo y apertura del documento correcto a ${width}px`, async ({
    context,
  }) => {
    const backend = servidorEstudio();
    const page = await backend.preparar(context);
    await page.setViewportSize({ width, height: 800 });
    const tema = {
      id: backend.TEMA,
      numero: 4,
      descripcion: 'Estatutos de prueba',
      modulo: { id: 16, nombre: 'Normativa' },
    };
    const documentos = ['Puentes', 'Saler'].map((descripcion, i) => ({
      id: backend.DOC + i,
      identificador: 'Tema 4',
      descripcion,
      fileName: `documento-${i}.pdf`,
      isDownloadable: true,
      isNew: true,
    }));
    await page.route('**/tema/get-temas', (route) =>
      route.fulfill({ json: [tema] }),
    );
    await page.route('**/documentos/tree', (route) =>
      route.fulfill({
        json: [
          { id: 16, nombre: 'Normativa', temas: [{ ...tema, documentos }] },
        ],
      }),
    );
    await page.route('**/documentos/*/ack', (route) =>
      route.fulfill({ json: {} }),
    );
    await page.route('**/documentos/*/download', (route) =>
      route.fulfill({ contentType: 'application/pdf', body: documentoPdf() }),
    );
    await page.goto(`/app/librillos?tema=${backend.TEMA}&vista=documentos`);
    await expect(page.locator('h1')).toContainText('Estatutos de prueba');
    await expect(page.getByRole('button', { name: 'Puentes' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Saler' })).toBeVisible();
    await page.getByRole('button', { name: 'Ver temas' }).click();
    const buscar = page.getByPlaceholder('Buscar por tema o módulo');
    await expect(buscar).toBeVisible();
    await expect(buscar).toBeFocused();
    await buscar.press('Escape');
    await expect(page.getByRole('button', { name: 'Ver temas' })).toBeFocused();
    const ack = page.waitForRequest((req) =>
      req.url().endsWith(`/documentos/${backend.DOC + 1}/ack`),
    );
    await page.getByRole('button', { name: 'Saler' }).click();
    await ack;
    await expect(page).toHaveURL(new RegExp(`doc=${backend.DOC + 1}`));
    await expect(
      page.getByRole('combobox', { name: 'Documento' }),
    ).toContainText('Saler');
  });
}

test('subida móvil conserva nombre y área táctil en la lista y el diálogo', async ({
  context,
}) => {
  const backend = servidorEstudio();
  const page = await backend.preparar(context, 1, 'ADMIN');
  await page.setViewportSize({ width: 360, height: 800 });
  await page.route('**/documentos/publicos', (route) =>
    route.fulfill({
      json: {
        data: [],
        pagination: { count: 0, skip: 0, take: 10, searchTerm: '' },
      },
    }),
  );
  await page.route('**/tema/get-temas', (route) =>
    route.fulfill({
      json: [
        {
          id: backend.TEMA,
          numero: 4,
          descripcion: 'Estatutos',
          modulo: { nombre: 'Normativa' },
        },
      ],
    }),
  );
  await page.goto('/app/documentacion');
  // La fuente de iconos de staging aporta contenido generado al botón de subida.
  await page.addStyleTag({
    content: '.pi-upload::before { content: "\\e934"; }',
  });
  const entrada = page.getByRole('button', { name: 'Subir documento' });
  await expect(entrada).toBeVisible();
  await expect(entrada).toHaveAccessibleName('Subir documento');
  const caja = await entrada.boundingBox();
  expect(caja!.width).toBeGreaterThanOrEqual(44);
  expect(caja!.height).toBeGreaterThanOrEqual(44);
  await entrada.click();
  const dialogo = page.getByRole('dialog', { name: 'Subir nuevo documento' });
  const accion = dialogo.getByRole('button', { name: 'Subir documento' });
  await expect(accion).toBeVisible();
  await expect(accion).toHaveAccessibleName('Subir documento');
  await expect
    .poll(async () => (await accion.boundingBox())?.height ?? 0)
    .toBeGreaterThanOrEqual(44);
  const final = await accion.boundingBox();
  expect(final!.width).toBeGreaterThanOrEqual(44);
  expect(final!.height).toBeGreaterThanOrEqual(44);
  expect(final!.x + final!.width).toBeLessThanOrEqual(360);
});
