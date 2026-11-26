import { expect, test, type BrowserContext } from '@playwright/test';
import { documentoPdf } from './documento-pdf.fixture';
import { servidorEstudio } from './estudio.fixture';

const biblioteca = '/app/librillos?vista=documentos';
const temaNormativa = 811;
const temaRescate = 912;
const primerDocumento = 1000;
const ultimoDocumento = 1023;
const documentoRescate = 2001;
const documentoBloqueado = 2002;

function documento(id: number, temaId: number, identificador: string) {
  return {
    id,
    temaId,
    identificador,
    descripcion: 'Material para el alumno',
    fileName: `documento-${id}.pdf`,
    isLocked: false,
    isDownloadable: true,
    isNew: false,
  };
}

async function prepararBiblioteca(context: BrowserContext) {
  const backend = servidorEstudio();
  const page = await backend.preparar(context);
  const normativa = { id: 16, nombre: 'Normativa' };
  const intervencion = { id: 25, nombre: 'Intervención' };
  const temas = [
    {
      id: temaNormativa,
      numero: 4,
      descripcion: 'Legislación forestal',
      modulo: normativa,
    },
    {
      id: temaRescate,
      numero: 9,
      descripcion: 'Rescate',
      modulo: intervencion,
    },
  ];
  const documentosNormativa = Array.from({ length: 24 }, (_, indice) =>
    documento(
      primerDocumento + indice,
      temaNormativa,
      `Técnica forestal ${String(indice + 1).padStart(2, '0')}`,
    ),
  );
  const documentosRescate = [
    documento(documentoRescate, temaRescate, 'Técnica de rescate'),
    {
      ...documento(documentoBloqueado, temaRescate, 'Guía reservada'),
      isLocked: true,
      isDownloadable: false,
    },
    documento(2003, temaRescate, 'Plan de intervención'),
  ];
  const descargas: number[] = [];
  const permitidos = new Set([
    ...documentosNormativa.map(({ id }) => id),
    documentoRescate,
    2003,
  ]);

  await page.route('**/tema/get-temas', (route) =>
    route.fulfill({ json: temas }),
  );
  await page.route('**/documentos/tree', (route) =>
    route.fulfill({
      json: [
        {
          ...normativa,
          temas: [{ ...temas[0], documentos: documentosNormativa }],
        },
        {
          ...intervencion,
          temas: [{ ...temas[1], documentos: documentosRescate }],
        },
      ],
    }),
  );
  await page.route('**/documentos/*/ack', (route) =>
    route.fulfill({ json: {} }),
  );
  await page.route(/\/documentos\/\d+\/download(?:\?.*)?$/, (route) => {
    const id = Number(new URL(route.request().url()).pathname.split('/')[2]);
    descargas.push(id);
    if (!permitidos.has(id)) return route.fulfill({ status: 403, json: {} });
    return route.fulfill({
      contentType: 'application/pdf',
      body: documentoPdf(),
    });
  });

  return { page, descargas };
}

test.skip(
  process.env['ESTUDIO_QA_VARIANTE'] !== 'staging',
  'La ruta de la biblioteca solo está habilitada en staging.',
);

for (const width of [390, 1440]) {
  test(`la biblioteca filtra y vuelve al documento con foco y posición a ${width}px`, async ({
    context,
  }) => {
    const { page, descargas } = await prepararBiblioteca(context);
    await page.setViewportSize({ width, height: 844 });
    await page.goto(width === 390 ? '/app/documentacion/alumno' : biblioteca);
    await expect(page).toHaveURL(/\/app\/librillos\?vista=documentos$/);

    await expect(
      page.getByRole('heading', { name: 'Mis documentos' }),
    ).toBeVisible();
    expect(new URL(page.url()).searchParams.has('tema')).toBe(false);
    const primero = page.getByRole('button', {
      name: 'Técnica forestal 01',
      exact: true,
    });
    const rescate = page.getByRole('button', {
      name: 'Técnica de rescate',
      exact: true,
    });
    const normativa = page.getByRole('button', {
      name: 'Normativa',
      exact: true,
    });
    const intervencion = page.getByRole('button', {
      name: 'Intervención',
      exact: true,
    });
    const forestal = page.getByRole('button', {
      name: '4 · Legislación forestal',
      exact: true,
    });
    const temaDeRescate = page.getByRole('button', {
      name: '9 · Rescate',
      exact: true,
    });
    await expect(normativa).toHaveAttribute('aria-expanded', 'false');
    await expect(intervencion).toHaveAttribute('aria-expanded', 'false');
    await expect(primero).toHaveCount(0);
    await expect(rescate).toHaveCount(0);
    await normativa.press('Enter');
    await expect(normativa).toHaveAttribute('aria-expanded', 'true');
    await expect(forestal).toHaveAttribute('aria-expanded', 'false');
    const caja = await forestal.boundingBox();
    expect(caja!.height).toBeGreaterThanOrEqual(44);
    await forestal.press('Space');
    await expect(primero).toBeVisible();
    await expect(primero).toHaveAccessibleDescription(
      /Normativa \/ 4 · Legislación forestal/,
    );
    await intervencion.click();
    await temaDeRescate.click();
    await expect(rescate).toBeVisible();
    await expect(rescate).toHaveAccessibleDescription(
      /Intervención \/ 9 · Rescate/,
    );
    const bloqueado = page
      .locator('.documento-item')
      .filter({ hasText: 'Guía reservada' });
    await expect(
      bloqueado.getByRole('button', { name: 'Descargar' }),
    ).toBeDisabled();
    await expect(
      bloqueado.getByRole('button', { name: 'Guía reservada' }),
    ).toHaveCount(0);
    expect(descargas).toEqual([]);
    await intervencion.click();
    await expect(temaDeRescate).toHaveCount(0);

    const buscar = page.getByRole('searchbox', { name: 'Buscar documentos' });
    const filtroTema = page.getByRole('combobox', {
      name: 'Tema',
      exact: true,
    });
    await buscar.fill('tecnica');
    await expect(intervencion).toHaveAttribute('aria-expanded', 'true');
    await expect(temaDeRescate).toHaveAttribute('aria-expanded', 'true');
    await expect(primero).toBeVisible();
    await expect(rescate).toBeVisible();
    await expect(page.getByText('Guía reservada')).toHaveCount(0);
    const etiquetaTema = 'Normativa / 4 · Legislación forestal';
    if (width === 390) {
      await page.getByRole('button', { name: 'Filtros', exact: true }).click();
    }
    await filtroTema.selectOption({ label: etiquetaTema });
    await expect(rescate).toHaveCount(0);
    const ultimo = page.getByRole('button', {
      name: 'Técnica forestal 24',
      exact: true,
    });
    await ultimo.scrollIntoViewIfNeeded();
    const resultados = page.locator('#biblioteca-resultados');
    const scrollAntes = await resultados.evaluate(
      (elemento) => elemento.scrollTop,
    );
    expect(scrollAntes).toBeGreaterThan(100);
    await ultimo.focus();
    await ultimo.press('Enter');
    await expect(page.getByTestId('pagina-librillo')).toHaveText(
      'Página 1 de 2',
    );
    await expect
      .poll(() => new URL(page.url()).searchParams.get('doc'))
      .toBe(String(ultimoDocumento));
    expect(descargas).toContain(ultimoDocumento);
    await page.getByRole('button', { name: 'Volver a Mis documentos' }).click();
    await expect(
      page.getByRole('heading', { name: 'Mis documentos' }),
    ).toBeVisible();
    await expect(buscar).toHaveValue('tecnica');
    await expect(ultimo).toBeFocused();
    await expect
      .poll(async () =>
        Math.abs(
          (await resultados.evaluate((elemento) => elemento.scrollTop)) -
            scrollAntes,
        ),
      )
      .toBeLessThanOrEqual(8);
    await expect(rescate).toHaveCount(0);
    if (width === 390 && !(await filtroTema.isVisible())) {
      await page.getByRole('button', { name: /^Filtros/ }).click();
    }
    await expect(filtroTema.locator('option:checked')).toHaveText(etiquetaTema);

    await ultimo.press('Enter');
    await expect(page.getByTestId('pagina-librillo')).toBeVisible();
    await page.goBack();
    await expect(ultimo).toBeFocused();
    await expect(buscar).toHaveValue('tecnica');
    await expect(filtroTema.locator('option:checked')).toHaveText(etiquetaTema);

    await buscar.fill('sin coincidencias 123');
    await expect(
      page.getByText('No hay documentos que coincidan con los filtros.'),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Limpiar filtros' }).click();
    await expect(buscar).toBeFocused();
    await expect(buscar).toHaveValue('');
    await expect(filtroTema.locator('option:checked')).toHaveText(
      'Todos los temas',
    );
    await expect(primero).toBeVisible();
    await expect(intervencion).toHaveAttribute('aria-expanded', 'false');
    await expect(rescate).toHaveCount(0);
    await intervencion.press('Enter');
    await expect(temaDeRescate).toHaveAttribute('aria-expanded', 'true');
    await expect(rescate).toBeVisible();
    expect(
      await page
        .locator('html')
        .evaluate((el) => el.scrollWidth - el.clientWidth),
    ).toBe(0);
  });

  test(`los enlaces directos respetan el árbol y el bloqueo a ${width}px`, async ({
    context,
  }) => {
    const { page, descargas } = await prepararBiblioteca(context);
    await page.setViewportSize({ width, height: 844 });
    await page.goto(`/app/librillos?doc=${documentoRescate}&vista=librillo`);
    await expect(page.getByTestId('pagina-librillo')).toHaveText(
      'Página 1 de 2',
    );
    await expect(
      page.getByRole('region', { name: 'PDF de Técnica de rescate' }),
    ).toBeVisible();
    expect(descargas).toContain(documentoRescate);

    await page.goto(
      `/app/librillos?tema=${temaRescate}&doc=${documentoBloqueado}&vista=librillo`,
    );
    await expect(
      page.getByText(/Este documento está bloqueado/i),
    ).toBeVisible();
    expect(descargas).not.toContain(documentoBloqueado);

    await page.goto(
      `/app/librillos?tema=${temaNormativa}&doc=${documentoRescate}&vista=librillo`,
    );
    await expect(
      page
        .getByRole('tabpanel', { name: 'Estudio' })
        .getByRole('alert')
        .filter({
          hasText: /Este documento no está disponible en el tema seleccionado/i,
        }),
    ).toBeVisible();
    expect(descargas.filter((id) => id === documentoRescate)).toHaveLength(1);

    await page.goto('/app/librillos?doc=99999&vista=librillo');
    await expect(
      page
        .getByRole('alert')
        .filter({ hasText: /Este tema o documento no está disponible/i }),
    ).toBeVisible();
    expect(descargas).not.toContain(99999);
  });
}
