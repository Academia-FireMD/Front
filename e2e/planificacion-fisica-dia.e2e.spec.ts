/**
 * E2E focalizado de la vista diaria: el bloque elegido viaja siempre entre
 * calendario y detalle, sin depender de API/BD reales.
 */
import { expect, test, type Page, type Request } from '@playwright/test';
import { loginAsAlumnoMock } from './helpers/auth.helper';

const BLOQUE_B = 2;
const FECHA = '2026-07-17';

interface Estado {
  miPlanQueries: string[];
  diaQueries: string[];
  progresoRequests: Array<{ bloqueId: string | null; body: unknown }>;
  progreso: boolean;
}

const isXhr = (request: Request) => {
  const type = request.resourceType();
  return type === 'xhr' || type === 'fetch';
};

function planB(hecho: boolean) {
  return {
    bloque: {
      id: BLOQUE_B,
      identificador: 'BLOQUE-B-MADRID',
      comentarioGeneral: 'Plan específico B',
      fechaInicioSemana1: '2026-07-13',
      numSemanas: 1,
      relevancia: ['MADRID'],
      estado: 'PUBLICADO',
    },
    hoy: FECHA,
    semanas: [
      {
        id: 20,
        indice: 0,
        numeroAno: 29,
        fechaInicio: '2026-07-13',
        intensidad: 75,
        comentarioSemana: 'Carga del bloque B',
        esActual: true,
        esAnterior: false,
        soloLectura: false,
        progreso: { hechas: hecho ? 1 : 0, total: 1 },
        dias: [
          {
            fecha: FECHA,
            diaSemana: 5,
            chips: [
              {
                disciplinaId: 12,
                nombre: 'Cuerda B',
                grupo: 'CUERDA',
                color: '#9fe2d0',
                realizado: hecho,
              },
            ],
          },
        ],
      },
    ],
  };
}

function planA() {
  return {
    ...planB(false),
    bloque: {
      ...planB(false).bloque,
      id: 1,
      identificador: 'BLOQUE-A-VALENCIA',
      fechaInicioSemana1: '2026-07-06',
    },
    semanas: [
      {
        ...planB(false).semanas[0],
        id: 10,
        numeroAno: 28,
        fechaInicio: '2026-07-06',
        dias: [
          {
            ...planB(false).semanas[0].dias[0],
            chips: [
              {
                ...planB(false).semanas[0].dias[0].chips[0],
                nombre: 'Carrera A',
              },
            ],
          },
        ],
      },
    ],
  };
}

function detalleB(hecho: boolean) {
  return {
    fecha: FECHA,
    comentarioSemana: 'Carga del bloque B',
    comentarioGeneral: 'Plan específico B',
    intensidad: 75,
    numeroSemana: 29,
    identificadorBloque: 'BLOQUE-B-MADRID',
    tipoPlan: 'PREMIUM',
    soloLectura: false,
    esHoy: true,
    disciplinas: [
      {
        asignacionId: 1201,
        disciplinaId: 12,
        nombre: 'Cuerda B',
        grupo: 'CUERDA',
        color: '#9fe2d0',
        contenido: 'B: 3 subidas controladas',
        comentario: 'Descansa entre subidas.',
        realizado: hecho,
      },
      {
        asignacionId: 1202,
        disciplinaId: 99,
        nombre: 'Descanso B',
        grupo: 'DESCANSO',
        color: '#d9e2f3',
        contenido: 'Recuperación activa.',
        comentario: null,
        realizado: false,
      },
    ],
  };
}

async function mockPlanificacion(page: Page, estado: Estado): Promise<void> {
  await page.route('**/planificacion-fisica/mis-bloques', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 1,
          identificador: 'BLOQUE-A-VALENCIA',
          relevancia: ['VALENCIA_AYUNTAMIENTO'],
          esActivo: true,
        },
        {
          id: BLOQUE_B,
          identificador: 'BLOQUE-B-MADRID',
          relevancia: ['MADRID'],
          esActivo: false,
        },
      ]),
    }),
  );
  await page.route('**/planificacion-fisica/mi-plan**', (route) => {
    if (!isXhr(route.request())) return route.continue();
    const bloqueId = new URL(route.request().url()).searchParams.get(
      'bloqueId',
    );
    estado.miPlanQueries.push(bloqueId ?? '');
    if (bloqueId && bloqueId !== '1' && bloqueId !== String(BLOQUE_B)) {
      throw new Error(`mi-plan recibió bloqueId inesperado: ${bloqueId}`);
    }
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(
        bloqueId === String(BLOQUE_B) ? planB(estado.progreso) : planA(),
      ),
    });
  });
  await page.route('**/planificacion-fisica/dia/**', (route) => {
    if (!isXhr(route.request())) return route.continue();
    const bloqueId = new URL(route.request().url()).searchParams.get(
      'bloqueId',
    );
    estado.diaQueries.push(bloqueId ?? '');
    if (bloqueId !== String(BLOQUE_B)) {
      throw new Error(`día debe pedir el bloque B, recibió: ${bloqueId}`);
    }
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(detalleB(estado.progreso)),
    });
  });
  await page.route('**/planificacion-fisica/progreso/1201**', (route) => {
    if (route.request().method() !== 'PUT') return route.continue();
    const bloqueId = new URL(route.request().url()).searchParams.get(
      'bloqueId',
    );
    const body = route.request().postDataJSON();
    estado.progresoRequests.push({ bloqueId, body });
    if (bloqueId !== String(BLOQUE_B)) {
      throw new Error(`PUT debe consultar bloqueId ${BLOQUE_B}`);
    }
    if (Object.keys(body).length !== 1 || typeof body.realizado !== 'boolean') {
      throw new Error('PUT debe conservar el DTO { realizado }');
    }
    estado.progreso = Boolean(body.realizado);
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        realizado: estado.progreso,
        realizadoEn: '2026-07-17T10:00:00.000Z',
      }),
    });
  });
}

test('bloque B se conserva de calendario a día, progreso y vuelta', async ({
  page,
}) => {
  const estado: Estado = {
    miPlanQueries: [],
    diaQueries: [],
    progresoRequests: [],
    progreso: false,
  };
  await mockPlanificacion(page, estado);
  await loginAsAlumnoMock(page);

  await page.goto('/app/planificacion-fisica');
  await expect(page.getByTestId('pf-switcher-bloques')).toContainText(
    'BLOQUE-A-VALENCIA',
  );
  await expect(page.getByTestId(`pf-dia-${FECHA}`)).toBeVisible();
  await page.getByTestId('pf-switcher-bloques').click();
  await page.getByRole('option', { name: 'BLOQUE-B-MADRID' }).click();
  await expect(page).toHaveURL(
    new RegExp(`planificacion-fisica\\?bloqueId=${BLOQUE_B}`),
  );
  await expect(page.getByTestId('pf-switcher-bloques')).toContainText(
    'BLOQUE-B-MADRID',
  );
  await expect(page.getByTestId(`pf-dia-${FECHA}`)).toBeVisible();
  expect(estado.miPlanQueries).toEqual(['', String(BLOQUE_B)]);

  await page.goBack();
  await expect(page).toHaveURL(new RegExp('planificacion-fisica\\?bloqueId=1'));
  await expect(page.getByTestId('pf-switcher-bloques')).toContainText(
    'BLOQUE-A-VALENCIA',
  );
  expect(estado.miPlanQueries).toEqual(['', String(BLOQUE_B), '1']);

  await page.goForward();
  await expect(page).toHaveURL(
    new RegExp(`planificacion-fisica\\?bloqueId=${BLOQUE_B}`),
  );
  await expect(page.getByTestId('pf-switcher-bloques')).toContainText(
    'BLOQUE-B-MADRID',
  );
  expect(estado.miPlanQueries).toEqual([
    '',
    String(BLOQUE_B),
    '1',
    String(BLOQUE_B),
  ]);

  // Aislamos el detalle del tráfico de calendario: debe cargar una sola vez
  // su GET dia y su mi-plan best-effort, ambos del bloque seleccionado.
  estado.miPlanQueries.length = 0;
  estado.diaQueries.length = 0;

  await page.getByTestId(`pf-dia-${FECHA}`).click();
  await expect(page).toHaveURL(
    new RegExp(`dia/${FECHA}\\?bloqueId=${BLOQUE_B}`),
  );
  await expect(page.getByTestId('pf-dia-badge-plan')).toHaveText(
    'Plan Premium',
  );
  await expect(page.getByTestId('pf-dia-resumen')).toHaveText(
    'Viernes 17 jul · Semana 29',
  );
  await expect(page.getByTestId('pf-dia-subtitulo')).toHaveText(
    'Semana 29 · Intensidad alta (75%)',
  );
  await expect(page.getByTestId('pf-dia-disciplina-1201')).toContainText(
    'B: 3 subidas controladas',
  );
  expect(estado.diaQueries).toEqual([String(BLOQUE_B)]);
  expect(estado.miPlanQueries).toEqual([String(BLOQUE_B)]);
  const fondosDisciplinas = await page
    .locator('.p-card.pf-dia__disciplina')
    .evaluateAll((elements) =>
      elements.map((element) => getComputedStyle(element).backgroundColor),
    );
  expect(fondosDisciplinas).toHaveLength(2);
  expect(fondosDisciplinas[0]).not.toBe(fondosDisciplinas[1]);
  for (const fondo of fondosDisciplinas) {
    expect(fondo).not.toBe('rgba(0, 0, 0, 0)');
    expect(fondo).not.toBe('rgb(255, 255, 255)');
  }

  await page.getByTestId('pf-dia-boton-marcar-1201').click();
  await expect(page.getByTestId('pf-dia-boton-hecho-1201')).toBeVisible();
  await expect(page.getByTestId('pf-dia-progreso')).toContainText('1/1');
  expect(estado.progresoRequests).toEqual([
    { bloqueId: String(BLOQUE_B), body: { realizado: true } },
  ]);

  await page.getByTestId('pf-dia-volver').click();
  await expect(page).toHaveURL(
    new RegExp(`planificacion-fisica\\?bloqueId=${BLOQUE_B}`),
  );
  await expect(page.getByTestId('pf-switcher-bloques')).toContainText(
    'BLOQUE-B-MADRID',
  );
  await expect(page.getByTestId(`pf-progreso-dia-${FECHA}`)).toContainText(
    '1 de 1',
  );
});

test('en móvil el CTA de progreso sigue visible y no desborda', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const estado: Estado = {
    miPlanQueries: [],
    diaQueries: [],
    progresoRequests: [],
    progreso: false,
  };
  await mockPlanificacion(page, estado);
  await loginAsAlumnoMock(page);

  await page.goto(
    `/app/planificacion-fisica/dia/${FECHA}?bloqueId=${BLOQUE_B}`,
  );
  const cta = page.getByTestId('pf-dia-boton-marcar-1201');
  await expect(cta).toBeVisible();
  const box = await cta.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThan(200);
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  expect(
    await page
      .getByTestId('pf-dia-detalle')
      .evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true);
});
