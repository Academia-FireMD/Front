import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { servidorEstudio } from './estudio.fixture';

const intentoId = 402;
const pregunta = {
  id: 18,
  identificador: 'QA-R07',
  descripcion: 'Pregunta de prueba sobre el temario',
  respuestas: ['Primera opción', 'Segunda opción'],
};

function documentoPdf() {
  const contenidos = [1, 2].map(
    (pagina) =>
      `BT /F1 18 Tf 45 760 Td (Documento de prueba R07, hoja ${pagina}) Tj ET`,
  );
  const objetos = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>',
    ...[5, 6].map(
      (contenido) =>
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents ${contenido} 0 R /Resources << /Font << /F1 7 0 R >> >> >>`,
    ),
    ...contenidos.map(
      (contenido) =>
        `<< /Length ${contenido.length} >>\nstream\n${contenido}\nendstream`,
    ),
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const posiciones = objetos.map((objeto, indice) => {
    const posicion = pdf.length;
    pdf += indice + 1 + ' 0 obj\n' + objeto + '\nendobj\n';
    return posicion;
  });
  const xref = pdf.length;
  const total = objetos.length + 1;
  pdf += `xref\n0 ${total}\n0000000000 65535 f \n`;
  for (const posicion of posiciones) {
    pdf += String(posicion).padStart(10, '0') + ' 00000 n \n';
  }
  return Buffer.from(
    pdf +
      `trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`,
  );
}

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
                subrayados: [],
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
  return { page, tema, sinPdf, sesiones, referencia };
}

async function irAlTema(page: Page, temaId: number) {
  await page.goto('/app/librillos?tema=' + temaId);
}

test('ofrece práctica junto al PDF y también en temas sin documento', async ({
  context,
}) => {
  test.skip(process.env['ESTUDIO_QA_VARIANTE'] !== 'staging');
  const { page, tema, sinPdf, sesiones } = await abrir(context, {
    width: 1440,
    height: 950,
  });
  await irAlTema(page, tema.id);

  const panel = page.getByRole('region', { name: 'Práctica', exact: true });
  const lector = page.locator('app-previa-librillos-pdf');
  await expect(panel).toBeVisible();
  await expect(lector).toBeVisible();
  await expect(page.getByTestId('pagina-librillo')).toHaveText('Página 1 de 2');
  const rectLector = (await lector.boundingBox())!;
  const rectPanel = (await panel.boundingBox())!;
  expect(rectLector.x + rectLector.width).toBeLessThanOrEqual(rectPanel.x + 1);
  await expect(
    page.getByRole('link', { name: 'Abrir Librillo interactivo' }),
  ).toBeVisible();

  await irAlTema(page, sinPdf.id);
  await expect(
    page.getByText('Este tema todavía no tiene documentos disponibles.'),
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

  const pestanas = page.getByRole('navigation', { name: 'Vista del Librillo' });
  const panel = page.getByRole('region', { name: 'Práctica', exact: true });
  const lector = page.locator('app-previa-librillos-pdf');
  await expect(lector).toBeVisible();
  await expect(panel).toBeHidden();
  await pestanas
    .getByRole('button', { name: 'Anotaciones', exact: true })
    .click();
  await expect(
    pestanas.getByRole('button', { name: 'Anotaciones', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  const nota = lector.getByRole('textbox', {
    name: 'Tu nota para esta página',
  });
  await expect(nota).toHaveValue('Nota de la primera hoja');

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
  await expect(dialogo.getByText('Nota 10 / 10')).toBeVisible();
  await dialogo.getByRole('button', { name: 'Historial del tema' }).click();
  await expect(dialogo.getByText('Varios temas')).toBeVisible();
  await dialogo.getByRole('button', { name: 'Resultado', exact: true }).click();
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
    dialogo.getByRole('button', { name: 'Resultado', exact: true }),
  ).toBeVisible();
  expect(sesiones.inicios).toBe(2);
  expect(sesiones.finalizaciones).toBe(1);
});
