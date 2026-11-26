import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { documentoPdf } from './documento-pdf.fixture';
import { servidorEstudio } from './estudio.fixture';

const rutaAdmin = '/app/documentacion';
const rutaTemario = '/app/librillos';
const revision = 'a'.repeat(64);
const tituloTema = 'Normativa';
const descripcionTema = 'Tema documental de QA';
type EstadoReferencia = 'borrador' | 'publicada';

function tema(id: number) {
  return {
    id,
    numero: 4,
    descripcion: descripcionTema,
    modulo: { id: 16, nombre: tituloTema, esPublico: true },
  };
}

function documento(id: number, temaId: number, nombre: string) {
  return {
    id,
    temaId,
    identificador: nombre,
    descripcion: 'Material documental de QA',
    fileName: 'material.pdf',
    esPublico: true,
    isPublicado: true,
    isLocked: true,
    isDownloadable: true,
    requireWatermark: false,
    isNew: false,
    createdAt: '2026-04-12T10:00:00Z',
  };
}

function tituloPdf(indice: number) {
  return 'PDF de QA ' + String(indice + 1).padStart(2, '0');
}

async function prepararAdmin(context: BrowserContext) {
  const backend = servidorEstudio();
  const page = await backend.preparar(context, 1, 'ADMIN');
  const catalogo = Array.from({ length: 23 }, (_, indice) =>
    documento(100 + indice, backend.TEMA, tituloPdf(indice)),
  );
  const idDoc = 110;
  catalogo[10].isPublicado = false;
  const acciones = {
    pdf: 0,
    descargasDeFila: 0,
    vistasPrevias: 0,
    personales: 0,
  };
  const fallos = { guardar: false };
  const consultas: Array<{ skip: number; searchTerm: string; where?: object }> =
    [];
  const guardados: EstadoReferencia[] = [];
  const referencias = new Map<number, Record<string, unknown>>();
  let siguienteReferenciaId = 197;
  let subida: { isLocked: boolean; requireWatermark: boolean } | undefined;

  await page.route('**/api/app-config/modulos', (route) =>
    route.fulfill({
      json: {
        DOCUMENTACION: true,
        LIBRILLOS: true,
        LIBRILLO_PDF_INTERACTIVO: true,
      },
    }),
  );
  await page.route('**/tema/get-temas', (route) =>
    route.fulfill({ json: [tema(backend.TEMA)] }),
  );
  await page.route('**/documentos/publicos', async (route) => {
    const consulta = route.request().postDataJSON();
    consultas.push(consulta);
    const { take, skip, searchTerm, where } = consulta;
    const datos = catalogo.filter(
      (doc) =>
        (!where?.id || where.id === doc.id) &&
        (!where?.isLocked || doc.isLocked) &&
        (!where?.requireWatermark || doc.requireWatermark) &&
        doc.identificador.toLowerCase().includes(searchTerm.toLowerCase()),
    );
    await route.fulfill({
      json: {
        data: datos.slice(skip, skip + take),
        pagination: { count: datos.length, take, skip, searchTerm },
      },
    });
  });
  await page.route('**/documentos/download/*', (route) => {
    acciones.descargasDeFila++;
    return route.fulfill({
      contentType: 'application/pdf',
      body: documentoPdf(),
    });
  });
  await page.route('**/documentos/' + idDoc + '/download', (route) => {
    acciones.pdf++;
    return route.fulfill({
      contentType: 'application/pdf',
      headers: {
        'X-Librillo-Revision': revision,
        'Access-Control-Expose-Headers': 'X-Librillo-Revision',
      },
      body: documentoPdf(),
    });
  });
  await page.route(
    '**/documentos/' + idDoc + '/librillo/pdf/editor**',
    (route) => {
      const peticion = route.request();
      const url = new URL(peticion.url());
      if (peticion.method() === 'POST') {
        const ref = peticion.postDataJSON();
        expect(ref.revision).toBe(revision);
        if (fallos.guardar) {
          return route.fulfill({
            status: 503,
            json: { message: 'Guardado no disponible en QA' },
          });
        }
        guardados.push(ref.estado);
        const id = ref.id ?? siguienteReferenciaId++;
        const guardada = { ...ref, id };
        referencias.set(id, guardada);
        return route.fulfill({ json: guardada });
      }
      expect(url.searchParams.get('revision')).toBe(revision);
      const alumno = url.searchParams.get('vista') === 'alumno';
      if (alumno) acciones.vistasPrevias++;
      const filas = [...referencias.values()];
      return route.fulfill({
        json: {
          revision,
          paginas: 2,
          referencias: alumno
            ? filas.filter(
                (ref) =>
                  ref['estado'] === 'publicada' && ref['tipo'] !== 'SUGERIDO',
              )
            : filas,
        },
      });
    },
  );
  await page.route(
    '**/documentos/' + idDoc + '/librillo/pdf?revision=*',
    (route) => {
      acciones.personales++;
      return route.fulfill({ status: 404, json: {} });
    },
  );
  await page.route(
    /\/librillo\/pdf\/(anotaciones|importar|reiniciar)(?:\?|$)/,
    (route) => {
      acciones.personales++;
      return route.fulfill({ status: 400, json: {} });
    },
  );
  await page.route('**/documentos/upload', (route) => {
    const multipart = route.request().postData() ?? '';
    const campo = (nombre: string, valor: string) =>
      multipart.includes('name="' + nombre + '"\r\n\r\n' + valor + '\r\n');
    expect(campo('temaId', String(backend.TEMA))).toBe(true);
    expect(multipart).toContain('filename="qa-temario.pdf"');
    subida = {
      isLocked: campo('isLocked', 'true'),
      requireWatermark: campo('requireWatermark', 'true'),
    };
    const creado = {
      ...documento(999, backend.TEMA, 'PDF subido de QA'),
      ...subida,
      isPublicado: false,
    };
    catalogo.unshift(creado);
    return route.fulfill({ status: 201, json: creado });
  });
  await page.route('**/documentos/update', (route) => {
    const cambios = route.request().postDataJSON();
    const doc = catalogo.find(({ id }) => id === cambios.id);
    if (!doc) return route.fulfill({ status: 404, json: {} });
    Object.assign(doc, cambios);
    return route.fulfill({ json: doc });
  });
  return {
    page,
    idDoc,
    temaId: backend.TEMA,
    acciones,
    consultas,
    guardados,
    fallos,
    subida: () => subida,
  };
}

async function marcarFragmento(page: Page) {
  const fragmento = page
    .locator('.texto-pdf')
    .getByText('Documento de prueba R07, hoja 2');
  const vincular = page.getByRole('button', { name: 'Vincular fragmento' });
  // PDF.js puede volver a montar la capa de texto al ajustar el ancho del editor.
  await expect(async () => {
    await fragmento.evaluate((el) => {
      el.scrollIntoView({ block: 'nearest' });
      const range = document.createRange();
      range.selectNodeContents(el);
      const seleccion = window.getSelection();
      seleccion?.removeAllRanges();
      seleccion?.addRange(range);
      document.dispatchEvent(new Event('selectionchange'));
    });
    await expect(vincular).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 10000 });
  await vincular.click();
}

test.describe('Documentación y Temario integrados', () => {
  test.beforeEach(() =>
    test.skip(process.env['ESTUDIO_QA_VARIANTE'] !== 'staging'),
  );

  test('admin vuelve a la página filtrada y previsualiza solo las referencias publicadas', async ({
    context,
  }) => {
    const { page, idDoc, temaId, acciones, consultas, guardados } =
      await prepararAdmin(context);
    const filtros = new URLSearchParams({
      searchTerm: 'PDF de QA',
      skip: '10',
      take: '10',
      temaId: String(temaId),
      isLocked: 'true',
      requireWatermark: 'false',
      createdAt: '1775001600000,1777593600000',
    });
    await page.goto(rutaAdmin + '?' + filtros);

    const librillo = page.getByRole('link', {
      name: new RegExp(tituloPdf(10)),
    });
    await expect(librillo).toBeVisible();
    await expect
      .poll(() => consultas.at(-1))
      .toMatchObject({
        skip: 10,
        searchTerm: 'PDF de QA',
        where: { isLocked: true, temaId: { in: [temaId] } },
      });
    expect(consultas.at(-1)?.where).not.toHaveProperty(
      'requireWatermark',
      true,
    );
    await librillo.press('Enter');
    await expect(page).toHaveURL(
      new RegExp(rutaAdmin + '/librillo/editor/' + idDoc),
    );
    expect(acciones.descargasDeFila).toBe(0);
    await expect(page.getByTestId('pagina-librillo')).toHaveText(
      'Página 1 de 2',
    );
    await page.getByRole('button', { name: 'Página siguiente' }).click();
    await expect(page.getByTestId('pagina-librillo')).toHaveText(
      'Página 2 de 2',
    );

    await marcarFragmento(page);
    const formulario = page.getByRole('complementary', {
      name: 'Referencias del PDF',
    });
    await formulario.getByLabel('Tipo', { exact: true }).selectOption('HUECO');
    await formulario.getByRole('button', { name: 'Guardar borrador' }).click();
    await expect(formulario.getByText('Borrador guardado.')).toBeVisible();
    const previa = page.getByRole('button', {
      name: /Vista previa del Librillo|Ver en el Librillo/i,
    });
    await previa.click();
    await expect(
      page.getByText('Vista previa privada · Sin publicar'),
    ).toBeVisible();
    await expect.poll(() => acciones.vistasPrevias).toBe(1);
    await expect(
      page.getByRole('button', { name: 'Huecos', exact: true }),
    ).toHaveCount(0);
    await expect(page.getByTestId('pagina-librillo')).toHaveText(
      'Página 2 de 2',
    );
    const volver = page.getByRole('button', { name: 'Volver a edición' });
    await expect(volver).toHaveAttribute('aria-pressed', 'true');
    await volver.click();
    await expect(previa).toHaveAttribute('aria-pressed', 'false');

    await formulario.getByRole('button', { name: /Hueco.*Página 2/s }).click();
    await formulario
      .getByRole('button', { name: /Publicar/, exact: false })
      .click();
    await expect(formulario.getByText('Referencia publicada.')).toBeVisible();
    await previa.click();
    await page.getByRole('button', { name: 'Huecos', exact: true }).click();
    await expect(
      page.getByRole('button', { name: /Mostrar dato|Mostrar hueco/i }),
    ).toBeVisible();
    expect(guardados).toEqual(['borrador', 'publicada']);
    expect(acciones).toEqual({
      pdf: 1,
      descargasDeFila: 0,
      vistasPrevias: 2,
      personales: 0,
    });

    await page
      .getByRole('link', { name: /Documentación/ })
      .last()
      .click();
    await expect(librillo).toBeVisible();
    await expect(page.getByPlaceholder('Buscar documentos')).toHaveValue(
      'PDF de QA',
    );
    const vuelta = new URL(page.url()).searchParams;
    expect(vuelta.get('skip')).toBe('10');
    expect(vuelta.get('temaId')).toBe(String(temaId));
    expect(vuelta.get('pagina')).toBeNull();
    expect(vuelta.get('referencia')).toBeNull();
  });

  test('los cambios de una referencia sobreviven a volver y a un guardado fallido', async ({
    context,
  }) => {
    const { page, fallos, guardados } = await prepararAdmin(context);
    await page.goto(rutaAdmin + '?skip=10&take=10');
    const librillo = page.getByRole('link', {
      name: new RegExp(tituloPdf(10)),
    });
    await librillo.click();
    await page.getByRole('button', { name: 'Página siguiente' }).click();
    await expect(page.getByTestId('pagina-librillo')).toHaveText(
      'Página 2 de 2',
    );
    await marcarFragmento(page);

    const texto = page.getByLabel('Texto de la referencia');
    const cambios = page.getByRole('dialog', { name: 'Cambios sin guardar' });
    await texto.fill('Un borrador que aún no se ha guardado');
    await page.evaluate(() => window.history.back());
    await expect(cambios).toBeVisible();
    await cambios.getByRole('button', { name: 'Seguir editando' }).click();
    await expect(texto).toHaveValue('Un borrador que aún no se ha guardado');
    await expect(texto).toBeFocused();

    await page.locator('.p-menuitem-link[href="/app/documentacion"]').click();
    await expect(cambios).toBeVisible();
    await cambios.getByRole('button', { name: 'Seguir editando' }).click();
    await expect(texto).toBeFocused();

    const salir = page
      .locator('app-librillo-editor')
      .getByRole('link', { name: 'Documentación' });
    await salir.click();
    await expect(cambios).toBeVisible();
    fallos.guardar = true;
    await cambios.getByRole('button', { name: 'Guardar borrador' }).click();
    await expect(page.getByRole('alert')).toContainText(
      'Guardado no disponible en QA',
    );
    await expect(texto).toHaveValue('Un borrador que aún no se ha guardado');
    await expect(page.getByTestId('pagina-librillo')).toHaveText(
      'Página 2 de 2',
    );
    expect(guardados).toEqual([]);

    fallos.guardar = false;
    await salir.click();
    await cambios.getByRole('button', { name: 'Guardar borrador' }).click();
    await expect(librillo).toBeVisible();
    expect(guardados).toEqual(['borrador']);
    expect(new URL(page.url()).searchParams.get('skip')).toBe('10');
  });

  test('sube y edita un PDF con Premium y marca de agua desde los formularios existentes', async ({
    context,
  }) => {
    const { page, subida } = await prepararAdmin(context);
    await page.goto(rutaAdmin);
    await page.getByRole('button', { name: /Subir Documento$/i }).click();
    const alta = page.getByRole('dialog', { name: 'Subir nuevo documento' });
    const [selector] = await Promise.all([
      page.waitForEvent('filechooser'),
      alta.getByText('Seleccionar archivo', { exact: true }).click(),
    ]);
    await selector.setFiles({
      name: 'qa-temario.pdf',
      mimeType: 'application/pdf',
      buffer: documentoPdf(),
    });
    await alta
      .getByLabel('Descripción', { exact: true })
      .fill('Alta con protección');
    await alta.getByText(/Selecciona (los temas|un tema)/).click();
    await page.getByText(tituloTema, { exact: true }).last().click();
    await page.getByText(new RegExp(descripcionTema)).last().click();
    await alta.getByLabel('Descripción', { exact: true }).click();
    const premium = 'Requiere suscripción PREMIUM o ADVANCED';
    const marca = 'Marca de agua';
    await alta.getByText(premium, { exact: true }).click();
    await alta.getByText(marca, { exact: true }).click();
    await alta.getByRole('button', { name: /Subir Documento$/i }).click();
    await expect(alta).toBeHidden();
    expect(subida()).toEqual({ isLocked: true, requireWatermark: true });

    const fila = page.locator('app-generic-list .item-container').filter({
      has: page.getByText('PDF subido de QA', { exact: true }),
    });
    await expect(fila.getByText('PREMIUM', { exact: true })).toBeVisible();
    await expect(
      fila.getByText('Marca de agua', { exact: true }),
    ).toBeVisible();
    await fila.locator('.p-button-warning').click();
    const edicion = page.getByRole('dialog', { name: 'Editar documento' });
    await expect(
      edicion.getByRole('checkbox', { name: premium }),
    ).toBeChecked();
    await expect(edicion.getByRole('checkbox', { name: marca })).toBeChecked();
    await edicion.getByText(premium, { exact: true }).click();
    await edicion.getByText(marca, { exact: true }).click();
    await edicion.getByRole('button', { name: /Guardar/i }).click();
    await expect(edicion).toBeHidden();
    await expect(fila.getByText('PREMIUM', { exact: true })).toHaveCount(0);
    await expect(fila.getByText('Marca de agua', { exact: true })).toHaveCount(
      0,
    );
  });

  test('Publicaciones conserva su selector y añade solo el documento seleccionado', async ({
    context,
  }) => {
    const { page } = await prepararAdmin(context);
    const release = {
      id: 'release-qa',
      name: 'Publicación de QA',
      startAt: '2026-04-01',
      endAt: '2099-04-30',
      items: [],
    };
    await page.route(/\/releases\/?(?:\?.*)?$/, (route) =>
      route.fulfill({ json: [release] }),
    );
    await page.route('**/releases/release-qa', (route) =>
      route.fulfill({ json: release }),
    );
    await page.route('**/releases/release-qa/items', (route) =>
      route.fulfill({ json: release }),
    );
    await page.route('**/user/all', (route) =>
      route.fulfill({
        json: {
          data: [],
          pagination: { count: 0, take: 1000, skip: 0, searchTerm: '' },
        },
      }),
    );
    await page.goto(rutaAdmin + '/publicaciones');
    await page.getByRole('button', { name: /Gestionar Items/ }).click();
    await page.getByRole('button', { name: /Añadir Documentos/ }).click();
    const selector = page.getByRole('dialog', {
      name: 'Seleccionar Documentos',
    });
    const fila = selector.locator('.item-container').filter({
      has: page.getByText(tituloPdf(0), { exact: true }),
    });
    await expect(fila).toBeVisible();
    await expect(selector.getByRole('link', { name: /Librillo/ })).toHaveCount(
      0,
    );
    await fila.getByRole('checkbox').press('Space');
    await expect(fila.getByRole('checkbox')).toBeChecked();
    const peticion = page.waitForRequest(
      (req) =>
        req.method() === 'POST' &&
        req.url().endsWith('/releases/release-qa/items'),
    );
    await selector
      .getByRole('button', { name: /Añadir Seleccionados/ })
      .click();
    expect((await peticion).postDataJSON()).toEqual({
      items: [{ itemType: 'DOCUMENTO', documentoId: 100 }],
    });
    await expect(selector).toBeHidden();
  });

  test('mantiene el árbol al fallar el catálogo y bloquea un PDF fuera del árbol', async ({
    context,
  }) => {
    const backend = servidorEstudio();
    const page = await backend.preparar(context);
    await page.setViewportSize({ width: 390, height: 844 });
    const permitido = documento(backend.DOC, backend.TEMA, 'PDF permitido');
    const bloqueado = {
      ...documento(backend.DOC + 2, backend.TEMA, 'Resumen bloqueado'),
      isDownloadable: false,
    };
    let peticionesPdf = 0;
    await page.route('**/tema/get-temas', (route) =>
      route.fulfill({ status: 503, json: { message: 'Error de QA' } }),
    );
    await page.route('**/documentos/tree', (route) =>
      route.fulfill({
        json: [
          {
            id: 16,
            nombre: tituloTema,
            temas: [
              { ...tema(backend.TEMA), documentos: [permitido, bloqueado] },
            ],
          },
        ],
      }),
    );
    await page.route(/\/documentos\/\d+\/download$/, (route) => {
      peticionesPdf++;
      return route.abort();
    });

    await page.goto(
      rutaTemario + '?tema=' + backend.TEMA + '&vista=documentos',
    );
    await expect(
      page.getByRole('button', { name: /PDF permitido/ }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Resumen bloqueado/ }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Reintentar/ }),
    ).toBeVisible();
    expect(
      await page.locator('html').evaluate((el) => el.scrollWidth),
    ).toBeLessThanOrEqual(391);
    expect(peticionesPdf).toBe(0);

    await page.goto(
      rutaTemario + '?tema=' + backend.TEMA + '&doc=' + (backend.DOC + 299),
    );
    await expect(
      page
        .getByRole('tabpanel', { name: 'Librillo' })
        .getByText(/Este documento no está disponible/i),
    ).toBeVisible();
    expect(peticionesPdf).toBe(0);
  });
});
