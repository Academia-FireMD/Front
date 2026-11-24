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
  const contenido = 'BT /F1 18 Tf 45 760 Td (Documento de prueba R07) Tj ET';
  const objetos = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    '<< /Length ' +
      contenido.length +
      ' >>\nstream\n' +
      contenido +
      '\nendstream',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const posiciones = objetos.map((objeto, indice) => {
    const posicion = pdf.length;
    pdf += indice + 1 + ' 0 obj\n' + objeto + '\nendobj\n';
    return posicion;
  });
  const xref = pdf.length;
  pdf += 'xref\n0 6\n0000000000 65535 f \n';
  for (const posicion of posiciones) {
    pdf += String(posicion).padStart(10, '0') + ' 00000 n \n';
  }
  return Buffer.from(
    pdf +
      'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' +
      xref +
      '\n%%EOF\n',
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
  await page.route('**/documentos/' + backend.DOC + '/download', (route) =>
    route.fulfill({
      contentType: 'application/pdf',
      headers: {
        'X-Librillo-Revision': revision,
        'Access-Control-Expose-Headers': 'X-Librillo-Revision',
      },
      body: documentoPdf(),
    }),
  );
  await page.route(
    '**/documentos/' + backend.DOC + '/librillo/pdf?revision=*',
    (route) =>
      route.fulfill({
        json: {
          revision,
          paginas: 1,
          generacion: 0,
          referencias: [],
          partes: [],
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
        pendientes: { test: null, flashcards: null },
        progreso,
        progresoPagina: null,
        referencias: [],
      },
    }),
  );
  await page.route(
    '**/librillos/temas/' + tema.id + '/practica/test',
    async (route) => {
      expect(route.request().postDataJSON()).toMatchObject({
        modo: 'simulacro',
        segundosPorPregunta: 0,
        alcance: 'tema',
      });
      await route.fulfill({ json: { id: intentoId, origenLibrillo } });
    },
  );
  await page.route('**/tests/por-id/' + intentoId, (route) =>
    route.fulfill({
      json: {
        id: intentoId,
        status: finalizada ? 'FINALIZADO' : 'EMPEZADO',
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
    }),
  );
  await page.route('**/tests/registrar-respuesta', (route) => {
    contestada = true;
    return route.fulfill({ json: respuesta });
  });
  await page.route('**/tests/finalizar-test/' + intentoId, (route) => {
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
  return { page, tema, sinPdf };
}

async function irAlTema(page: Page, temaId: number) {
  await page.goto('/app/librillos?tema=' + temaId);
}

test('ofrece práctica junto al PDF y también en temas sin documento', async ({
  context,
}) => {
  test.skip(process.env['ESTUDIO_QA_VARIANTE'] !== 'staging');
  const { page, tema, sinPdf } = await abrir(context, {
    width: 1440,
    height: 950,
  });
  await irAlTema(page, tema.id);

  const panel = page.getByRole('region', { name: 'Práctica', exact: true });
  const lector = page.locator('app-previa-librillos-pdf');
  await expect(panel).toBeVisible();
  await expect(lector).toBeVisible();
  await expect(page.getByTestId('pagina-librillo')).toHaveText('Página 1 de 1');
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
  await expect(
    panel.getByRole('button', { name: 'Iniciar sesión de práctica' }),
  ).toBeEnabled();
  await expect(lector).toHaveCount(0);
});

test('permite alternar lectura, práctica y anotaciones en móvil y corregir al cerrar', async ({
  context,
}) => {
  test.skip(process.env['ESTUDIO_QA_VARIANTE'] !== 'staging');
  const { page, tema } = await abrir(context, { width: 390, height: 844 });
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

  await pestanas.getByRole('button', { name: 'Práctica', exact: true }).click();
  await expect(lector).toBeHidden();
  await expect(panel).toBeVisible();
  await panel.getByLabel('Modo', { exact: true }).selectOption('simulacro');
  await panel
    .getByRole('button', { name: 'Iniciar sesión de práctica' })
    .click();
  const opcion = panel.getByRole('button', { name: /Primera opción/ });
  await opcion.press('Enter');
  await expect(panel.getByTestId('solucion-container')).toHaveCount(0);
  await expect(panel.getByTestId('cronometro')).toHaveCount(0);
  await panel.getByRole('button', { name: 'Corregir simulacro' }).click();
  await expect(panel.getByText('Nota 10 / 10')).toBeVisible();
  await panel.getByRole('button', { name: 'Ver corrección' }).click();
  await expect(panel.getByTestId('solucion-texto')).toContainText(
    'Esta es la solución.',
  );
  await pestanas.getByRole('button', { name: 'Lectura', exact: true }).click();
  await expect(lector).toBeVisible();
  await expect(panel).toBeHidden();
});
