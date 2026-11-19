import { expect, test, type Page } from '@playwright/test';
import { join } from 'node:path';
import { contador, servidorEstudio, visor } from './estudio.fixture';

const practica = '/app/psicotecnicos';
const temario = '/app/documentacion/alumno';
const estado = (page: Page) => page.getByTestId('estudio-estado');
async function capturar(page: Page, nombre: string) {
  const carpeta = process.env['ESTUDIO_QA_CAPTURAS'];
  if (carpeta) await page.screenshot({ path: join(carpeta, nombre + '.png') });
}
const nav = (page: Page, value: string) =>
  visor(page).locator(`[data-nav="${value}"]:visible`).first();

async function abrirPsico(page: Page) {
  await page.goto(practica);
  await expect(visor(page).locator('main h1')).toBeVisible();
  await expect(estado(page)).toHaveAttribute('data-estado', /ready|saved/);
}

async function practicar(page: Page, cantidad: number) {
  const f = visor(page);
  await nav(page, 'practicar').click();
  await f.locator('[data-act="cfg"][data-k="n"][data-v="10"]').click();
  await f.locator('[data-act="start"]').click();
  for (let i = 0; i < cantidad; i++) {
    const opcion = f.locator('.opt').first();
    await opcion.focus();
    await opcion.press('a');
    if (i === cantidad - 1 && cantidad < 10) {
      const salir = f.locator('[data-act="exit"]');
      await salir.click();
      await salir.click();
    } else {
      await f.locator('#bnext').click();
    }
  }
  await expect(f.getByRole('heading', { name: 'Corrección' })).toBeVisible();
}

async function abrirLibrillo(
  page: Page,
  data: ReturnType<typeof servidorEstudio>,
) {
  await page.goto(`${temario}?tema=${data.TEMA}`);
  await page.getByRole('link', { name: 'Estudiar con librillo' }).click();
  const f = visor(page);
  await expect(f.locator('#hojaSel option')).toHaveCount(19);
  await expect(estado(page)).toHaveAttribute('data-estado', 'saved');
  return f;
}

async function abrirNotas(page: Page) {
  const f = visor(page);
  const tab = f.getByRole('button', { name: /Tarjetas y notas/ });
  if (await tab.isVisible()) await tab.click();
  const panel = f.locator('[data-act="acc"][data-k="n"]');
  if ((await panel.getAttribute('aria-expanded')) !== 'true')
    await panel.click();
  const teclado = f.locator('[data-act="nmode"][data-v="tecla"]');
  if ((await teclado.getAttribute('aria-pressed')) !== 'true')
    await teclado.click();
  await expect(f.locator('[data-act="tnadd"]')).toBeVisible();
  return f;
}

test('Psicotécnicos monta la fuente completa, propone Madrid y separa sesión y visor a 390 px', async ({
  browser,
}) => {
  const backend = servidorEstudio();
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    baseURL: test.info().project.use.baseURL,
  });
  try {
    const page = await backend.preparar(ctx);
    await abrirPsico(page);
    const frame = visor(page);
    await expect(
      frame.getByRole('heading', { name: 'Entrenamiento psicotécnico' }),
    ).toBeVisible();
    expect(
      await frame
        .locator('.hero.inicio')
        .evaluate((hero) => hero.getBoundingClientRect().left),
    ).toBeGreaterThan(0);
    await expect(
      frame.locator('.inicio-acciones [data-nav="practicar"]'),
    ).toBeInViewport();
    await expect(
      frame.locator('.inicio-acciones [data-nav="reto"]'),
    ).toBeInViewport();
    await expect(frame.locator('header img, nav.bottom')).toHaveCount(0);
    await expect(frame.locator('nav [aria-current="page"]')).toHaveText(
      'Inicio',
    );
    await capturar(page, 'psico-movil');
    await expect(frame.locator('#pfp')).toHaveText('MAD');
    const locks = await frame.locator('body').evaluate(() => {
      let parentBlocked = false;
      let storageBlocked = false;
      try {
        void parent.sessionStorage;
      } catch {
        parentBlocked = true;
      }
      try {
        void window.localStorage;
      } catch {
        storageBlocked = true;
      }
      return {
        origin: self.origin,
        parentBlocked,
        storageBlocked,
        overflow: document.documentElement.scrollWidth - innerWidth,
      };
    });
    expect(locks).toEqual({
      origin: 'null',
      parentBlocked: true,
      storageBlocked: true,
      overflow: 0,
    });
    await expect(page.getByTestId('estudio-volver')).toBeFocused();
    await page.getByTestId('estudio-volver').press('Enter');
    await expect(page).toHaveURL(/\/app\/profile$/);
  } finally {
    await ctx.close();
  }
});

test('Práctica offline por cuenta y fusión 10+5+5 aunque se pierda la respuesta', async ({
  browser,
}) => {
  const backend = servidorEstudio();
  const baseURL = test.info().project.use.baseURL;
  const a = await browser.newContext({ baseURL });
  const b = await browser.newContext({ baseURL });
  try {
    const primera = await backend.preparar(a);
    await abrirPsico(primera);
    backend.opciones.pause = true;
    await practicar(primera, 10);
    await expect(estado(primera)).toHaveAttribute('data-estado', 'saving');
    expect(contador(backend.cuenta(1).state)).toBe(0);
    backend.opciones.pause = false;
    await expect.poll(() => contador(backend.cuenta(1).state)).toBe(10);
    await expect(estado(primera)).toHaveAttribute('data-estado', 'saved');
    const segunda = await backend.preparar(b);
    await abrirPsico(segunda);
    backend.opciones.offline = true;
    await practicar(primera, 5);
    await practicar(segunda, 5);
    await expect(estado(primera)).toHaveAttribute('data-estado', 'offline');
    await expect(estado(segunda)).toHaveAttribute('data-estado', 'offline');
    await segunda.getByTestId('estudio-volver').click();
    await expect(segunda).toHaveURL(/profile/);
    await b.unrouteAll();
    const otraCuenta = await backend.preparar(b, 2);
    await otraCuenta.goto(practica);
    await expect(visor(otraCuenta).locator('main h1')).toBeVisible();
    await nav(otraCuenta, 'progreso').click();
    await expect(
      visor(otraCuenta)
        .getByRole('heading', { name: /progreso/i })
        .first(),
    ).toBeVisible();
    expect(contador(backend.cuenta(2).state)).toBe(0);
    await otraCuenta.close();
    await b.unrouteAll();
    backend.opciones.loseNextSave = true;
    backend.opciones.offline = false;
    await primera
      .getByRole('button', { name: 'Reintentar', exact: true })
      .click();
    await expect.poll(() => contador(backend.cuenta(1).state)).toBe(15);
    const vuelta = await backend.preparar(b);
    await vuelta.goto(practica);
    await expect
      .poll(() => contador(backend.cuenta(1).state), { timeout: 20000 })
      .toBe(20);
    await expect(estado(vuelta)).toHaveAttribute('data-estado', 'saved');
    const saves = backend.peticiones.filter(
      ({ endpoint, body }) => endpoint === '/psico/state' && body.opId,
    );
    expect(new Set(saves.map(({ body }) => body.opId)).size).toBeLessThan(
      saves.length,
    );
    expect(contador(backend.cuenta(2).state)).toBe(0);
  } finally {
    backend.opciones.pause = false;
    await a.close();
    await b.close();
  }
});

test('El reto oficial reanuda el intento real, confirma respuestas y corrige al terminar', async ({
  context,
}) => {
  const backend = servidorEstudio();
  const current = await backend.preparar(context);
  await abrirPsico(current);
  const frame = visor(current);
  await nav(current, 'reto').click();
  const begin = frame.getByRole('button', { name: 'Empezar el reto' });
  await begin.click();
  await expect(frame.locator('.qmeta')).toContainText('de 44');
  const selected = frame.locator('.opt').first();
  await selected.click();
  await expect.poll(() => backend.cuenta(1).examenes.cam?.answers[0]).toBe(0);
  const intento = backend.cuenta(1).examenes.cam?.attemptId;
  await current.reload();
  await expect(estado(current)).toHaveAttribute('data-estado', /ready|saved/);
  await nav(current, 'reto').click();
  await frame.getByRole('button', { name: 'Continuar el reto' }).click();
  await expect(frame.locator('.qmeta')).toContainText('Pregunta 2 de 44');
  await frame.getByRole('button', { name: 'Ver todas las preguntas' }).click();
  await frame.locator('#qgrid [data-act="finish"]').click();
  await frame.locator('[data-act="finishYes"]').click();
  await expect(frame.getByText('Reto semanal · nota oficial')).toBeVisible();
  expect(backend.cuenta(1).examenes.cam?.attemptId).toBe(intento);
  expect(backend.cuenta(1).examenes.cam?.status).toBe('done');
  await current.close();
});

test('R07 muestra las 19 hojas, guarda notas y restaura tema, página y aislamiento a 390 px', async ({
  browser,
}) => {
  const backend = servidorEstudio();
  const options = {
    viewport: { width: 390, height: 844 },
    baseURL: test.info().project.use.baseURL,
  };
  const a = await browser.newContext(options);
  const b = await browser.newContext(options);
  try {
    const page = await backend.preparar(a);
    const f = await abrirLibrillo(page, backend);
    await expect(
      page.getByRole('button', { name: 'Volver al tema', exact: true }),
    ).toBeVisible();
    await expect(f.locator('.bar .logo')).toBeHidden();
    await expect(f.locator('.bar #sync')).toBeHidden();
    await expect(
      f.getByRole('combobox', { name: 'Ir a la hoja' }),
    ).toBeVisible();
    await capturar(page, 'librillo-movil');
    await expect(f.locator('#hojaSel')).toHaveValue('0');
    const next = f.locator('#nextH');
    await next.focus();
    await next.press('ArrowRight');
    await expect(f.locator('#hojaSel')).toHaveValue('1');
    const notes = await abrirNotas(page);
    await notes.locator('[data-act="tnadd"]').click();
    await notes.locator('#ab-n textarea').fill('Nota privada de la hoja dos');
    await notes.locator('#ab-n textarea').blur();
    await expect
      .poll(
        () =>
          [...backend.cuenta(1).partes.keys()].filter((n) =>
            n.startsWith('notas'),
          ).length,
      )
      .toBe(1);
    const claveNota = [...backend.cuenta(1).partes.keys()].find((n) =>
      n.startsWith('notas'),
    )!;
    expect(claveNota).toMatch(/^notas\d{10,20}$/);
    await expect(estado(page)).toHaveAttribute('data-estado', 'saved');
    expect(
      await f
        .locator('body')
        .evaluate(() => document.documentElement.scrollWidth - innerWidth),
    ).toBe(0);
    await page
      .getByRole('button', { name: 'Volver al tema', exact: true })
      .press('Enter');
    await expect(page).toHaveURL(
      new RegExp(
        `documentacion/alumno\\?tema=${backend.TEMA}&doc=${backend.DOC}`,
      ),
    );
    await expect(
      page.getByRole('link', { name: 'Estudiar con librillo' }),
    ).toBeFocused();
    const otroDispositivo = await backend.preparar(b);
    const remoto = await abrirLibrillo(otroDispositivo, backend);
    await expect(remoto.locator('#hojaSel')).toHaveValue('1');
    await abrirNotas(otroDispositivo);
    await expect(remoto.locator('#ab-n textarea')).toHaveValue(
      'Nota privada de la hoja dos',
    );
    backend.opciones.dinamica = 'R08-QA';
    await otroDispositivo.reload();
    await expect(estado(otroDispositivo)).toHaveAttribute(
      'data-estado',
      'saved',
    );
    await expect(remoto.locator('#hojaSel')).toHaveValue('0');
    await remoto.locator('#nextH').click();
    await abrirNotas(otroDispositivo);
    await expect(remoto.locator('#ab-n textarea')).toHaveCount(0);
    expect(backend.cuenta(1).partes.get(claveNota)?.j).toContain(
      'Nota privada de la hoja dos',
    );
  } finally {
    await a.close();
    await b.close();
  }
});

test('Los flags cierran las entradas directas y la administración requiere el rol nativo', async ({
  browser,
}) => {
  const backend = servidorEstudio();
  const context = await browser.newContext({
    baseURL: test.info().project.use.baseURL,
  });
  try {
    const page = await backend.preparar(context);
    await page.goto('/app/psicotecnicos/admin');
    await expect(page).toHaveURL(/\/auth/);
    expect(
      backend.peticiones.some((p) => p.endpoint.startsWith('/psico/admin')),
    ).toBe(false);
    backend.opciones.modulos = false;
    await page.goto(practica);
    await expect(page).toHaveURL(/\/app\/profile$/);
    await expect(page.getByTestId('estudio-iframe')).toHaveCount(0);
    await page.goto(`${temario}/librillo/${backend.DOC}`);
    await expect(page).toHaveURL(/\/app\/profile$/);
    expect(backend.peticiones).toHaveLength(0);
  } finally {
    await context.close();
  }
});

test('Superadmin carga cuatro vistas y puede exportar o borrar con confirmación', async ({
  context,
}) => {
  const backend = servidorEstudio();
  const page = await backend.preparar(context, 99, 'SUPERADMIN');
  await page.goto('/app/psicotecnicos/admin');
  await expect(
    page.getByRole('heading', { name: 'Gestión de Psicotécnicos' }),
  ).toBeVisible();
  await expect(page.getByText(/1 en curso/)).toBeVisible();
  const csv = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Descargar CSV' }).click();
  expect((await csv).suggestedFilename()).toMatch(/\.csv$/);
  await page.getByRole('button', { name: 'Dificultad real' }).click();
  await expect(page.getByText(/respuestas analizadas/)).toBeVisible();
  await page.getByRole('button', { name: 'Preguntas reportadas' }).click();
  const ref = page.getByRole('link', { name: 'bq.3.171' });
  await expect(ref).toBeVisible();
  await ref.click();
  await expect(page.getByTestId('estudio-iframe')).toBeVisible();
  await expect(visor(page).locator('#app')).not.toBeEmpty();
  await page.getByTestId('estudio-volver').click();
  await page.getByRole('button', { name: 'Alumnos', exact: true }).click();
  const exportacion = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Exportar datos de Cuenta 1' })
    .click();
  expect((await exportacion).suggestedFilename()).toMatch(/\.json$/);
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'Borrar datos de Cuenta 1' }).click();
  expect(backend.peticiones.some((p) => p.endpoint.endsWith('/borrar'))).toBe(
    false,
  );
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Borrar datos de Cuenta 1' }).click();
  await expect(
    page.getByText('Datos de Psicotécnicos borrados.'),
  ).toBeVisible();
  expect(
    backend.peticiones.find((p) => p.endpoint.endsWith('/borrar'))?.body,
  ).toEqual({ confirmar: '1' });
});

test('El atajo lateral aparece solo en la variante staging y abre el mismo lector', async ({
  context,
}) => {
  const backend = servidorEstudio();
  const page = await backend.preparar(context);
  await page.goto(temario);
  await page.locator('.lateral-bar').hover();
  const antesDeCurso = page.locator('.menu-header').filter({
    hasText:
      /Documentos|Librillos|^(?:\s*Test\s*|\s*Flashcards\s*|\s*Psicotécnicos\s*)$/,
  });
  const link = page.getByRole('link', { name: 'Librillos', exact: true });
  if (!backend.staging) {
    await expect(antesDeCurso).toHaveText([
      'Documentos',
      'Test',
      'Flashcards',
      'Psicotécnicos',
    ]);
    expect(
      backend.peticiones.filter((p) => p.endpoint === '/documentos/tree'),
    ).toHaveLength(1);
    await expect(link).toHaveCount(0);
    await page.goto('/app/librillos');
    await expect(page.getByRole('heading', { name: 'Librillos' })).toHaveCount(
      0,
    );
    return;
  }
  await expect(link).toBeVisible();
  await expect(antesDeCurso).toHaveText([
    'Documentos',
    'Librillos',
    'Test',
    'Flashcards',
    'Psicotécnicos',
  ]);
  await link.press('Enter');
  await expect(
    page.getByRole('heading', { name: 'Librillos', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Estudiar con librillo' }),
  ).toHaveCount(1);
  await page.getByRole('link', { name: 'Estudiar con librillo' }).click();
  await expect(visor(page).locator('#hojaSel option')).toHaveCount(19);
  await page.getByRole('button', { name: 'Volver a Librillos' }).click();
  await expect(
    page.getByRole('link', { name: 'Estudiar con librillo' }),
  ).toBeFocused();

  backend.opciones.piloto = 2;
  await page.goto(temario);
  await expect
    .poll(
      () =>
        backend.peticiones.filter((p) => p.endpoint === '/documentos/tree')
          .length,
    )
    .toBeGreaterThan(4);
  await expect(page.getByRole('button', { name: 'Normativa' })).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Documentos', exact: true }),
  ).toBeVisible();
  await expect(link).toHaveCount(0);
});

test('Una suscripción heredada con baja programada mantiene Psicotécnicos hasta vencer', async ({
  context,
}) => {
  const backend = servidorEstudio();
  backend.opciones.tipoSuscripcion = 'NORMAL';
  const page = await backend.preparar(context);
  await page.goto('/app/profile');
  const acceso = page.getByRole('link', { name: 'Psicotécnicos', exact: true });
  await expect(acceso).toBeVisible();
  await acceso.press('Enter');
  await expect(
    visor(page).getByRole('heading', { name: 'Entrenamiento psicotécnico' }),
  ).toBeVisible();
  backend.opciones.suscripcionVigente = false;
  await page.reload();
  await expect(page).toHaveURL(/\/app\/profile$/);
  await expect(acceso).toHaveCount(0);
});

test('Los visores en escritorio conservan perfiles, tinta del Librillo y cuadernillo imprimible', async ({
  context,
}) => {
  const backend = servidorEstudio();
  const page = await backend.preparar(context);
  await abrirPsico(page);
  const psico = visor(page);
  await expect(
    psico.getByRole('heading', { name: 'Entrenamiento psicotécnico' }),
  ).toBeVisible();
  await expect(psico.locator('.hero.inicio')).toHaveCSS(
    'background-image',
    'none',
  );
  await expect(
    psico.getByRole('button', { name: /Comunidad de Madrid\. Cambiar/ }),
  ).toBeVisible();
  await capturar(page, 'psico-escritorio');
  await psico.locator('[data-nav="papel"]').click();
  await psico.getByRole('button', { name: 'Generar simulacro' }).click();
  await expect(psico.locator('.paper svg').first()).toBeVisible();
  await page.emulateMedia({ media: 'print' });
  await expect(psico.locator('header.top')).toBeHidden();
  await expect(psico.locator('.paper .pg').first()).toHaveCSS(
    'break-after',
    'page',
  );
  await page.emulateMedia({ media: 'screen' });
  const librillo = await abrirLibrillo(page, backend);
  await expect(librillo.locator('.bar .doc')).toBeHidden();
  await expect(librillo.locator('.bar #sync')).toBeHidden();
  await expect(librillo.locator('#paper h1')).toBeVisible();
  await expect(librillo.locator('#tools [data-act="ink"]')).toBeVisible();
  await capturar(page, 'librillo-escritorio');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(librillo.locator('.bar')).toHaveCSS(
    'background-color',
    'rgb(33, 31, 31)',
  );
  await expect(
    librillo
      .getByRole('button', { name: 'Hoja siguiente', exact: true })
      .first(),
  ).toBeVisible();
});
