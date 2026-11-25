import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { documentoPdf } from './documento-pdf.fixture';
import { servidorEstudio } from './estudio.fixture';

const intentoId = 402;
const pregunta = {
  id: 18,
  identificador: 'QA-R07',
  descripcion: 'Pregunta de prueba sobre el temario',
  respuestas: ['Primera opción', 'Segunda opción'],
};

async function abrir(
  context: BrowserContext,
  pageSize: { width: number; height: number },
) {
  const backend = servidorEstudio();
  const page = await backend.preparar(context);
  await page.setViewportSize(pageSize);
  const tema = {
    id: backend.TEMA,
    numero: 4,
    descripcion: 'Estatutos de prueba',
  };
  const sinPdf = {
    id: backend.TEMA + 1,
    numero: 5,
    descripcion: 'Tema sin PDF',
  };
  const progreso = {
    preguntas: { total: 1, vistas: 0, acertadas: 0 },
    tarjetas: { total: 0, vistas: 0, dominadas: 0 },
  };
  const origenLibrillo = {
    temaId: tema.id,
    modo: 'simulacro',
    alcance: 'tema',
  };
  const respuesta = {
    id: 91,
    preguntaId: pregunta.id,
    indicePregunta: 0,
    respuestaDada: 0,
    estado: 'RESPONDIDA',
  };
  let contestada = false;
  let finalizada = false;
  let endsAt: string | undefined;
  let duration: number | undefined;
  const sesiones = {
    inicios: 0,
    cargas: 0,
    finalizaciones: 0,
    descargasPdf: 0,
  };
  await page.route('**/api/app-config/modulos', (route) =>
    route.fulfill({
      json: {
        DOCUMENTACION: true,
        TEST: true,
        FLASHCARDS: true,
        LIBRILLOS: true,
        LIBRILLO_PDF_INTERACTIVO: true,
      },
    }),
  );
  await page.route('**/tema/get-temas', (route) =>
    route.fulfill({ json: [tema, sinPdf] }),
  );
  const revision = 'a'.repeat(64);
  const referencia = { id: 63, pagina: 2, preguntaId: pregunta.id };
  await page.route('**/documentos/' + backend.DOC + '/download', (route) => {
    sesiones.descargasPdf++;
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
    '**/documentos/' + backend.DOC + '/librillo/pdf?revision=*',
    (route) =>
      route.fulfill({
        json: {
          revision,
          paginas: 2,
          generacion: 0,
          referencias: [
            {
              ...referencia,
              revision,
              tipo: 'PREGUNTA',
              estado: 'publicada',
              rectangulos: [{ x: 0.075, y: 0.09, ancho: 0.45, alto: 0.035 }],
            },
          ],
          partes: [
            {
              pagina: 1,
              version: 1,
              valor: {
                nota: 'Nota de la primera hoja',
                subrayados: [
                  {
                    id: 'marca-qa',
                    fragmento: 'Fragmento de estudio',
                    color: '#ffd646',
                    rectangulos: [
                      { x: 0.075, y: 0.09, ancho: 0.45, alto: 0.035 },
                    ],
                  },
                ],
                trazos: [],
                aparte: [],
              },
            },
          ],
        },
      }),
  );
  await page.route(/\/librillos\/temas\/\d+\/practica(?:\?|$)/, (route) =>
    route.fulfill({
      json: {
        test: 1,
        flashcards: 0,
        testPagina: 0,
        flashcardsPagina: 0,
        pendientes: { test: { id: intentoId }, flashcards: null },
        progreso,
        progresoPagina: null,
        referencias: new URL(route.request().url()).searchParams.has('doc')
          ? [referencia]
          : [],
      },
    }),
  );
  await page.route(
    '**/librillos/temas/' + tema.id + '/practica/test',
    async (route) => {
      const dto = route.request().postDataJSON();
      expect(dto).toMatchObject({
        modo: 'simulacro',
        alcance: 'tema',
      });
      if (sesiones.inicios++) {
        await route.fulfill({
          status: 409,
          json: {
            codigo: 'intento_pendiente',
            id: intentoId,
            origenLibrillo,
            temas: [tema.id],
            coincide: true,
            reemplazable: true,
          },
        });
        return;
      }
      const segundos = Number(dto.segundosPorPregunta);
      if (segundos > 0) {
        duration = segundos;
        const inicio = await page.evaluate(() => Date.now());
        endsAt = new Date(inicio + segundos * 1000).toISOString();
      }
      await route.fulfill({
        status: 201,
        json: { id: intentoId, origenLibrillo },
      });
    },
  );
  await page.route('**/tests/por-id/' + intentoId, (route) => {
    sesiones.cargas++;
    return route.fulfill({
      json: {
        id: intentoId,
        status: finalizada ? 'FINALIZADO' : 'EMPEZADO',
        duration,
        endsAt,
        respuestasCount: Number(contestada),
        preguntas: [
          {
            ...pregunta,
            tema,
            ...(finalizada
              ? { solucion: 'Esta es la solución.', respuestaCorrectaIndex: 0 }
              : {}),
          },
        ],
        respuestas: contestada ? [respuesta] : [],
      },
    });
  });
  await page.route('**/tests/registrar-respuesta', (route) => {
    contestada = true;
    return route.fulfill({ json: respuesta });
  });
  await page.route('**/tests/finalizar-test/' + intentoId, (route) => {
    sesiones.finalizaciones++;
    finalizada = true;
    return route.fulfill({ json: {} });
  });
  await page.route(
    '**/librillos/temas/' +
      tema.id +
      '/practica/test/' +
      intentoId +
      '/resultado',
    (route) =>
      route.fulfill({
        json: { total: 1, aciertos: 1, fallos: 0, blancas: 0, nota: 10 },
      }),
  );
  await page.route('**/practica/historial?tipo=*', (route) =>
    route.fulfill({
      json: {
        siguienteCursor: null,
        items: finalizada
          ? [
              {
                id: intentoId,
                fecha: '2026-11-25T08:00:00.000Z',
                mixto: true,
                total: 1,
                aciertos: 1,
                fallos: 0,
                blancas: 0,
              },
            ]
          : [],
      },
    }),
  );
  return {
    page,
    tema,
    sinPdf,
    sesiones,
    referencia,
    documentoBloqueado: backend.DOC + 2,
  };
}

async function irAlTema(page: Page, temaId: number) {
  await page.goto('/app/librillos?tema=' + temaId);
}

test('ofrece práctica junto al PDF y también en temas sin documento', async ({
  context,
}) => {
  test.skip(process.env['ESTUDIO_QA_VARIANTE'] !== 'staging');
  const { page, tema, sinPdf, sesiones, documentoBloqueado } = await abrir(
    context,
    {
      width: 1440,
      height: 950,
    },
  );
  await irAlTema(page, tema.id);

  const panel = page.getByRole('region', { name: 'Práctica', exact: true });
  const lector = page.locator('app-previa-librillos-pdf');
  await expect(panel).toBeVisible();
  await expect(lector).toBeVisible();
  await expect(page.getByTestId('pagina-librillo')).toHaveText('Página 1 de 2');
  const cabecera = page.getByRole('banner', { name: 'Temario', exact: true });
  await expect(
    cabecera.getByRole('heading', { name: 'Temario', exact: true }),
  ).toBeVisible();
  const selectorTema = cabecera.getByRole('combobox', {
    name: 'Tema',
    exact: true,
  });
  const vistaLibrillo = page.getByRole('tabpanel', { name: 'Librillo' });
  const selectorDocumento = vistaLibrillo.getByRole('combobox', {
    name: 'Documento',
    exact: true,
  });
  await expect(selectorTema).toBeVisible();
  await expect(selectorDocumento).toBeVisible();
  expect((await selectorDocumento.boundingBox())!.y).toBeLessThan(
    (await lector.boundingBox())!.y,
  );
  await expect(
    cabecera.getByRole('link', {
      name: 'Documentación',
      exact: true,
    }),
  ).toHaveCount(0);
  const ayudas = [
    ['Reducir zoom', 'Alejar el documento'],
    ['Ampliar zoom', 'Acercar el documento'],
    ['Girar página', 'Girar la página 90°'],
    ['Marcar un área', 'Seleccionar una zona del PDF para resaltarla'],
    ['Escribir en la hoja', 'Dibujar o escribir a mano sobre el PDF'],
  ];
  for (const [accion, texto] of ayudas) {
    await lector.getByRole('button', { name: accion, exact: true }).hover();
    await expect(page.getByRole('tooltip')).toHaveText(texto);
  }
  await page.mouse.move(0, 0);
  const girar = lector.getByRole('button', {
    name: 'Girar página',
    exact: true,
  });
  await girar.focus();
  await expect(page.getByRole('tooltip')).toHaveText('Girar la página 90°');
  await girar.blur();
  const lapiz = lector.getByRole('button', { name: 'Escribir en la hoja' });
  const fondoNormal = await lapiz.evaluate(
    (boton) => getComputedStyle(boton).backgroundColor,
  );
  await lapiz.click();
  await page.mouse.move(0, 0);
  await expect(lapiz).toHaveAttribute('aria-pressed', 'true');
  await expect(lapiz).toHaveCSS('box-shadow', 'none');
  await expect(lapiz).not.toHaveCSS('background-color', fondoNormal);
  const area = lector.getByRole('button', { name: 'Marcar un área' });
  await page.keyboard.press('Shift+Tab');
  await expect(area).toBeFocused();
  await expect(area).toHaveCSS('outline-style', 'solid');
  await area.press('Space');
  await expect(area).toHaveAttribute('aria-pressed', 'true');
  await expect(lapiz).toHaveAttribute('aria-pressed', 'false');
  await expect(area).not.toHaveCSS('box-shadow', /inset/);
  const rectLector = (await lector.boundingBox())!;
  const rectPanel = (await panel.boundingBox())!;
  expect(rectLector.x + rectLector.width).toBeLessThanOrEqual(rectPanel.x + 1);
  await expect(
    page.getByRole('link', { name: 'Abrir edición interactiva' }),
  ).toBeVisible();
  await selectorDocumento.press('Space');
  await page
    .getByRole('option', { name: 'Resumen bloqueado', exact: true })
    .click();
  await expect
    .poll(() => new URL(page.url()).searchParams.get('doc'))
    .toBe(String(documentoBloqueado));
  await expect(page.getByText(/Este documento está bloqueado/)).toBeVisible();
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await selectorDocumento.press('Space');
  await page
    .getByRole('option', { name: 'Original · Estatutos', exact: true })
    .click();
  await expect(lector).toBeVisible();

  await irAlTema(page, sinPdf.id);
  await expect(
    vistaLibrillo.getByText(
      'Este tema todavía no tiene documentos disponibles.',
    ),
  ).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Hacer test' })).toBeEnabled();
  const historial = panel.getByRole('button', {
    name: 'Ver historial del tema',
  });
  await historial.click();
  const dialogo = page.getByRole('dialog', { name: 'Historial del tema' });
  await expect(
    dialogo.getByText('Aún no hay sesiones finalizadas', { exact: false }),
  ).toBeVisible();
  const cambioFiltro = page.waitForRequest(
    (request) =>
      request.url().includes('/practica/historial') &&
      new URL(request.url()).searchParams.get('tipo') === 'flashcards',
  );
  await dialogo.getByLabel('Actividad').selectOption({ label: 'Flashcards' });
  await cambioFiltro;
  expect((await dialogo.boundingBox())?.width).toBeLessThanOrEqual(1100);
  await dialogo.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await expect(historial).toBeFocused();
  expect(sesiones.inicios).toBe(0);
  await expect(lector).toHaveCount(0);
});

test('en móvil cierra sin perder el intento ni el PDF y vuelve desde una referencia a la misma corrección', async ({
  context,
}) => {
  test.skip(process.env['ESTUDIO_QA_VARIANTE'] !== 'staging');
  const { page, tema, sesiones, referencia } = await abrir(context, {
    width: 390,
    height: 844,
  });
  await irAlTema(page, tema.id);

  const pestanas = page.getByRole('navigation', { name: 'Vista del Temario' });
  const panel = page.getByRole('region', { name: 'Práctica', exact: true });
  const lector = page.locator('app-previa-librillos-pdf');
  await page.evaluate(() => {
    const ayuda = document.createElement('button');
    ayuda.id = 'ai-widget-btn';
    ayuda.textContent = 'Asistente de Estudio';
    Object.assign(ayuda.style, {
      position: 'fixed',
      bottom: '0',
      right: '0',
      zIndex: '9999',
      display: 'block',
    });
    document.body.append(ayuda);
  });
  const ayuda = page.locator('#ai-widget-btn');
  await expect(ayuda).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator('#etiqueta-documento-librillo')
        .evaluate((etiqueta) => etiqueta.scrollWidth <= etiqueta.clientWidth),
    )
    .toBe(true);
  await expect(lector).toBeVisible();
  await expect(panel).toBeHidden();
  await pestanas
    .getByRole('button', { name: 'Anotaciones', exact: true })
    .click();
  await expect(
    pestanas.getByRole('button', { name: 'Anotaciones', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(
    pestanas.getByRole('button', { name: 'Anotaciones', exact: true }),
  ).toHaveCSS('border-bottom-width', '0px');
  const nota = lector.getByRole('textbox', {
    name: 'Tu nota para esta página',
  });
  await expect(nota).toHaveValue('Nota de la primera hoja');
  const marca = lector.getByRole('button', {
    name: 'Quitar subrayado Fragmento de estudio',
  });
  await expect(marca).toBeVisible();
  const secciones = page.getByRole('tablist', {
    name: 'Secciones del Temario',
  });
  const documentos = secciones.getByRole('tab', { name: 'Documentos' });
  const librillo = secciones.getByRole('tab', { name: 'Librillo' });
  await documentos.click();
  await expect(documentos).toHaveAttribute('aria-selected', 'true');
  await expect(
    page.getByRole('button', { name: /Original · Estatutos/ }),
  ).toBeVisible();
  await page.goBack();
  await expect(librillo).toHaveAttribute('aria-selected', 'true');
  await page.goForward();
  await expect(documentos).toHaveAttribute('aria-selected', 'true');
  await librillo.click();
  await expect(nota).toHaveValue('Nota de la primera hoja');
  await expect(marca).toHaveCount(1);
  expect(sesiones.descargasPdf).toBe(1);

  await pestanas.getByRole('button', { name: 'Práctica', exact: true }).click();
  await expect(lector).toBeHidden();
  await expect(panel).toBeVisible();
  await panel.getByLabel('Modo', { exact: true }).selectOption('simulacro');
  const empezar = panel.getByRole('button', { name: 'Hacer simulacro' });
  const urlAntes = page.url();
  await empezar.click();
  const dialogo = page.getByRole('dialog', { name: 'Simulacro', exact: true });
  const cerrar = dialogo.getByRole('button', { name: 'Cerrar', exact: true });
  await expect(cerrar).toBeFocused();
  await expect(ayuda).toBeHidden();
  await expect
    .poll(() => dialogo.boundingBox())
    .toEqual({ x: 0, y: 0, width: 390, height: 844 });
  await expect(dialogo.locator('.p-dialog-content')).toHaveCSS(
    'overflow-y',
    'auto',
  );
  const opcion = dialogo.getByRole('button', { name: /Primera opción/ });
  await opcion.press('Enter');
  await expect(opcion).toHaveAttribute('aria-pressed', 'true');
  await expect(dialogo.getByTestId('solucion-container')).toHaveCount(0);
  await expect(dialogo.getByTestId('cronometro')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(dialogo).toHaveCount(0);
  await expect(ayuda).toBeVisible();
  await expect(empezar).toBeFocused();
  await expect(page).toHaveURL(urlAntes);
  expect(sesiones.finalizaciones).toBe(0);

  await pestanas
    .getByRole('button', { name: 'Anotaciones', exact: true })
    .click();
  await expect(nota).toHaveValue('Nota de la primera hoja');
  await expect(page.getByTestId('pagina-librillo')).toHaveText('Página 1 de 2');
  await pestanas.getByRole('button', { name: 'Práctica', exact: true }).click();
  await empezar.click();
  await expect(opcion).toHaveAttribute('aria-pressed', 'true');
  expect(sesiones.inicios).toBe(2);
  await dialogo.getByRole('button', { name: 'Corregir simulacro' }).click();
  await expect(
    dialogo.getByTestId('indicador-resultado').locator('strong'),
  ).toHaveText('10');
  const tabResultado = dialogo.getByRole('tab', {
    name: 'Resultado',
    exact: true,
  });
  const tabHistorial = dialogo.getByRole('tab', {
    name: 'Historial del tema',
    exact: true,
  });
  await tabResultado.press('ArrowRight');
  await expect(tabHistorial).toHaveAttribute('aria-selected', 'true');
  await expect(dialogo.getByText('Varios temas')).toBeVisible();
  await expect(
    dialogo
      .getByRole('list', { name: 'Sesiones finalizadas' })
      .getByTestId('distribucion-practica'),
  ).toBeVisible();
  await tabHistorial.press('ArrowLeft');
  await expect(tabResultado).toHaveAttribute('aria-selected', 'true');
  await dialogo.getByRole('button', { name: 'Ver corrección' }).click();
  await expect(dialogo.getByTestId('solucion-texto')).toContainText(
    'Esta es la solución.',
  );
  const cargasAntesDelSalto = sesiones.cargas;
  await dialogo.getByRole('button', { name: /Ver en el texto/ }).click();
  const volver = page.getByRole('button', { name: 'Volver a la corrección' });
  await expect(volver).toBeFocused();
  await expect
    .poll(() => new URL(page.url()).searchParams.get('referencia'))
    .toBe(String(referencia.id));
  await expect(page.getByTestId('pagina-librillo')).toHaveText('Página 2 de 2');
  await expect(lector.locator('.referencia-activa')).toBeVisible();
  await expect(lector).toBeVisible();
  await expect(panel).toBeHidden();
  await volver.click();
  await expect(dialogo.getByTestId('solucion-texto')).toContainText(
    'Esta es la solución.',
  );
  await expect(
    dialogo.getByRole('button', { name: /Ver en el texto/ }),
  ).toBeFocused();
  expect(sesiones.cargas).toBe(cargasAntesDelSalto);
  await cerrar.click();
  await expect(dialogo).toHaveCount(0);
  await expect(page.getByTestId('pagina-librillo')).toHaveText('Página 2 de 2');
  await expect(volver).toHaveCount(0);
  expect(sesiones.descargasPdf).toBe(1);
});

test('el tiempo del simulacro vence mientras su ventana está cerrada', async ({
  context,
}) => {
  test.skip(process.env['ESTUDIO_QA_VARIANTE'] !== 'staging');
  const { page, tema, sesiones } = await abrir(context, {
    width: 1440,
    height: 950,
  });
  await page.clock.install();
  await irAlTema(page, tema.id);

  const panel = page.getByRole('region', { name: 'Práctica', exact: true });
  await panel.getByLabel('Modo', { exact: true }).selectOption('simulacro');
  await panel
    .getByLabel('Tiempo por pregunta', { exact: true })
    .selectOption({ label: '45 segundos' });
  const empezar = panel.getByRole('button', { name: 'Hacer simulacro' });
  const dialogo = page.getByRole('dialog', { name: 'Simulacro', exact: true });
  await empezar.click();
  await expect(dialogo.getByTestId('cronometro')).toBeVisible();
  await dialogo.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await expect(dialogo).toHaveCount(0);
  await page.clock.fastForward(60_000);
  expect(sesiones.finalizaciones).toBe(0);

  await empezar.click();
  await expect(
    dialogo.getByRole('tab', { name: 'Resultado', exact: true }),
  ).toBeVisible();
  expect(sesiones.inicios).toBe(2);
  expect(sesiones.finalizaciones).toBe(1);
});

test('mantiene el lector abierto si fallan el guardado remoto y la copia local', async ({
  context,
}) => {
  test.skip(process.env['ESTUDIO_QA_VARIANTE'] !== 'staging');
  const { page, tema } = await abrir(context, { width: 1440, height: 950 });
  await page.addInitScript(() => {
    const guardar = Storage.prototype.setItem;
    Storage.prototype.setItem = function (clave, valor) {
      if (clave.startsWith('librillo-pdf:') && clave.endsWith(':borradores')) {
        throw new DOMException(
          'Almacenamiento bloqueado en QA',
          'QuotaExceededError',
        );
      }
      guardar.call(this, clave, valor);
    };
  });
  let falloRemoto = true;
  let intentos = 0;
  await page.route('**/librillo/pdf/anotaciones', (route) => {
    intentos++;
    if (falloRemoto) return route.fulfill({ status: 503, json: {} });
    const { partes } = route.request().postDataJSON();
    return route.fulfill({
      json: {
        generacion: 0,
        partes: partes.map(
          ({ pagina, valor }: { pagina: number; valor: unknown }) => ({
            pagina,
            version: 2,
            valor,
          }),
        ),
      },
    });
  });
  await irAlTema(page, tema.id);
  await page.getByRole('button', { name: 'Anotaciones', exact: true }).click();
  const nota = page.getByRole('textbox', { name: 'Tu nota para esta página' });
  await expect(nota).toHaveValue('Nota de la primera hoja');
  await nota.fill('Cambios que deben seguir visibles');
  const perfil = page.locator('.lateral-bar .perfil');
  await perfil.click();
  await expect.poll(() => intentos).toBeGreaterThan(0);
  await expect(
    page.getByRole('button', { name: /Reintentar guardado/ }).first(),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/app\/librillos/);
  await expect(nota).toHaveValue('Cambios que deben seguir visibles');
  falloRemoto = false;
  await perfil.click();
  await expect(page).toHaveURL(/\/app\/profile$/);
});
