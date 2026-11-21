import { expect, test, type Page } from '@playwright/test';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { contador, servidorEstudio, visor } from './estudio.fixture';

const practica = '/app/psicotecnicos';
const estado = (page: Page) => page.getByTestId('estudio-workspace');
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

async function salirPorMenu(page: Page) {
  const menuMovil = page.locator('.bar button');
  if (await menuMovil.isVisible()) await menuMovil.click();
  await page.locator('.lateral-bar .perfil').click();
  await expect(page).toHaveURL(/\/app\/profile$/);
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

test('Psicotécnicos prioriza navegación, formato y aptitudes a 390 px con sesión aislada', async ({
  browser,
}) => {
  const backend = servidorEstudio();
  backend.opciones.asistente = true;
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    baseURL: test.info().project.use.baseURL,
  });
  try {
    const page = await backend.preparar(ctx);
    await abrirPsico(page);
    await expect(page.locator('.bar button')).toBeVisible();
    await expect(
      page.locator('.layout-content').getByTestId('estudio-workspace'),
    ).toHaveCSS('position', 'static');
    await expect(page.getByTestId('estudio-volver')).toHaveCount(0);
    await expect(page.getByTestId('estudio-estado')).toHaveCount(0);
    const frame = visor(page);
    await expect(
      frame.getByRole('heading', { name: 'Entrenamiento psicotécnico' }),
    ).toBeVisible();
    expect(
      await frame
        .locator('.inicio-resumen')
        .evaluate((hero) => hero.getBoundingClientRect().left),
    ).toBeGreaterThan(0);
    const navegacion = frame.locator('nav .p-tabmenu-nav > li:visible');
    await expect(navegacion).toHaveCount(4);
    for (const nombre of ['Inicio', 'Practicar', 'Reto']) {
      await expect(
        frame.getByRole('button', { name: nombre, exact: true }),
      ).toBeInViewport();
    }
    const filas = await navegacion.evaluateAll(
      (items) =>
        new Set(items.map((el) => el.getBoundingClientRect().top)).size,
    );
    expect(filas).toBe(1);
    await expect(frame.locator('nav.bottom')).toHaveCount(0);
    await expect(frame.locator('#pfp')).toBeHidden();
    const formato = frame.locator('#formato-movil');
    await expect(formato.locator('img')).toHaveAttribute(
      'src',
      /^data:image\/png;base64,/,
    );
    await expect(formato).toContainText('Comunidad de Madrid');
    await expect(formato).toHaveAttribute('aria-expanded', 'false');
    await expect(frame.locator('#psico-formatos')).toBeHidden();
    await expect(frame.locator('.opoT img')).toHaveCount(2);
    await expect(frame.locator('.btn.red').first()).toHaveClass(/p-button/);
    await expect(frame.locator('.inicio .kpis .psico-movil')).toHaveText([
      'Racha',
      'Hoy',
      'Para repasar',
    ]);
    await expect(
      frame.locator('.cats').first().locator('.cat').last(),
    ).toBeInViewport({ ratio: 1 });
    const lanzador = page.locator('app-ai-assistant-widget .ai-pw-bubble');
    await expect(lanzador).toBeVisible();
    const area = (await page.getByTestId('estudio-iframe').boundingBox())!;
    expect(area.y + area.height).toBeLessThan(
      (await lanzador.boundingBox())!.y,
    );
    const colores = await page.evaluate(() =>
      ['--primary-color', '--secondary-color'].map((name) =>
        getComputedStyle(document.documentElement)
          .getPropertyValue(name)
          .trim(),
      ),
    );
    const coloresFrame = await frame
      .locator('html')
      .evaluate((el) =>
        ['--primary-color', '--secondary-color'].map((name) =>
          getComputedStyle(el).getPropertyValue(name).trim(),
        ),
      );
    expect(coloresFrame).toEqual(colores);
    expect(await frame.locator('style').last().textContent()).toContain(
      '.p-button',
    );
    await expect(frame.locator('nav [aria-current="page"]')).toHaveText(
      'Inicio',
    );
    await capturar(page, 'psico-movil');
    const mas = frame.locator('#psico-mas summary');
    const enlaces = frame.locator('#psico-mas [data-nav]');
    await mas.press('Enter');
    await expect(enlaces).toHaveText(['Fallos', 'Trucos', 'Progreso']);
    await expect(enlaces.last()).toBeInViewport();
    await capturar(page, 'psico-mas');
    await enlaces.first().press('Escape');
    await expect(mas).toBeFocused();
    await expect(enlaces.first()).toBeHidden();
    for (const [seccion, titulo] of [
      ['fallos', 'Mis fallos'],
      ['trucos', /^Trucos y método/],
      ['progreso', 'Mi progreso'],
    ] as const) {
      const enlace = frame.locator(`#psico-mas [data-nav="${seccion}"]`);
      await mas.click();
      await enlace.click();
      await expect(frame.getByRole('heading', { name: titulo })).toBeVisible();
      await expect(mas).toBeFocused();
      await mas.click();
      await expect(enlace).toHaveAttribute('aria-current', 'page');
      await nav(page, 'inicio').click();
    }
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
    const escudoCv = await frame
      .locator('.opoT[data-p="cv"] img')
      .getAttribute('src');
    const escudoMadrid = await frame
      .locator('.opoT[data-p="cam"] img')
      .getAttribute('src');
    expect(escudoCv).not.toBe(escudoMadrid);
    expect(escudoCv).toBe(
      `data:image/png;base64,${readFileSync('public/comunidades/VALENCIA.png').toString('base64')}`,
    );
    expect(escudoMadrid).toBe(
      `data:image/png;base64,${readFileSync('public/oposiciones/madrid.png').toString('base64')}`,
    );
    await formato.click();
    await expect(frame.locator('.opoT:visible')).toHaveCount(2);
    await frame.locator('.opoT[data-p="cv"]').click();
    await expect(frame.locator('.opoT[data-p="cv"]')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(formato.locator('img')).toHaveAttribute('src', escudoCv!);
    await expect(formato).toHaveAttribute('aria-expanded', 'false');
    await expect(formato).toBeFocused();
    await expect(estado(page)).toHaveAttribute('data-estado', 'saved');
    await page.reload();
    await expect(frame.locator('.opoT[data-p="cv"]')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await nav(page, 'practicar').click();
    await frame.getByRole('button', { name: 'Cambiar', exact: true }).click();
    await expect(formato).toHaveAttribute('aria-expanded', 'true');
    await expect(formato).toBeFocused();
    await formato.press('Escape');
    await expect(frame.locator('#psico-formatos')).toBeHidden();
    await salirPorMenu(page);
  } finally {
    await ctx.close();
  }
});

test('Una pregunta larga a 360 px mantiene el reloj visible y permite corregir y avanzar', async ({
  browser,
}) => {
  const backend = servidorEstudio();
  backend.opciones.asistente = true;
  const ctx = await browser.newContext({
    viewport: { width: 360, height: 740 },
    baseURL: test.info().project.use.baseURL,
  });
  try {
    const page = await backend.preparar(ctx);
    await abrirPsico(page);
    const frame = visor(page);
    await frame.locator('#formato-movil').click();
    await frame.locator('.opoT[data-p="cv"]').click();
    await nav(page, 'practicar').click();
    await frame.locator('[data-k="cat"][data-v="general"]').click();
    await frame.locator('[data-k="sub"][data-v="tx"]').click();
    await frame.locator('[data-k="mode"][data-v="train"]').click();
    await frame.locator('[data-k="time"][data-v="global"]').click();
    await frame.locator('[data-act="start"]').click();

    const texto = frame.locator('.qtext .txt');
    await expect(texto).toBeVisible();
    expect((await texto.innerText()).length).toBeGreaterThan(400);
    expect(
      await texto.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(await texto.evaluate(() => innerWidth));
    const reloj = frame.locator('#clock');
    const tiempo = await reloj.textContent();
    await expect(reloj).toHaveText(/^\d+:\d{2}$/);
    await capturar(page, 'psico-pregunta-larga-360');

    const respuesta = frame.locator('.opts .opt').last();
    await respuesta.scrollIntoViewIfNeeded();
    expect(await respuesta.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    await expect(reloj).toBeInViewport({ ratio: 1 });
    await expect(reloj).not.toHaveText(tiempo!);
    await respuesta.click();
    await expect(frame.locator('#fb .fb')).toBeVisible();
    const siguiente = frame.getByRole('button', {
      name: 'Siguiente',
      exact: true,
    });
    await expect(siguiente).toBeInViewport({ ratio: 1 });
    const boton = (await siguiente.boundingBox())!;
    const lanzador = (await page
      .locator('app-ai-assistant-widget .ai-pw-bubble')
      .boundingBox())!;
    expect(boton.height).toBeGreaterThanOrEqual(44);
    expect(boton.y + boton.height).toBeLessThan(lanzador.y);
    await capturar(page, 'psico-siguiente-360');
    await siguiente.click();
    await expect(frame.locator('.qmeta')).toContainText('Pregunta 2');
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
    await salirPorMenu(segunda);
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
    expect(backend.peticiones).toHaveLength(0);
  } finally {
    await context.close();
  }
});

test('Un superadmin tampoco accede si falta el flag', async ({ context }) => {
  const backend = servidorEstudio();
  backend.opciones.modulos = undefined;
  const page = await backend.preparar(context, 99, 'SUPERADMIN');
  for (const path of [practica, `${practica}/admin`]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/app\/profile$/);
  }
  await expect(
    page.getByRole('link', { name: 'Psicotécnicos', exact: true }),
  ).toHaveCount(0);
  expect(backend.peticiones).toHaveLength(0);
});

test('Superadmin carga cuatro vistas y puede exportar o borrar con confirmación', async ({
  context,
}) => {
  const backend = servidorEstudio();
  backend.opciones.suscripcionVigente = false;
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
  await page.getByRole('button', { name: 'Volver a gestión' }).click();
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

test('Psicotécnicos en escritorio conserva el selector de perfil y el cuadernillo imprimible', async ({
  context,
}) => {
  const backend = servidorEstudio();
  const page = await backend.preparar(context);
  await abrirPsico(page);
  await expect(page.locator('.lateral-bar')).toBeVisible();
  await expect(page.locator('body')).not.toHaveClass(/aula-inmersiva-activa/);
  await expect(page.getByTestId('estudio-workspace')).toHaveCSS(
    'position',
    'static',
  );
  const psico = visor(page);
  await expect(
    psico.getByRole('heading', { name: 'Entrenamiento psicotécnico' }),
  ).toBeVisible();
  await expect(psico.locator('.hero.inicio')).toHaveCSS(
    'background-image',
    'none',
  );
  await expect(psico.locator('.p-card .inicio-acciones')).toBeVisible();
  await expect(psico.locator('.p-tabmenuitem.p-highlight button')).toHaveText(
    'Inicio',
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
});
