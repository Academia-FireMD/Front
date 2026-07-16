import { expect, test, type Page } from '@playwright/test';
import { loginAsAlumnoMock } from './helpers/auth.helper';
import {
  setupTestGenerarInterceptors,
  setupTestPracticaInterceptors,
} from './helpers/interceptors.helper';

/**
 * E2E del "modo batalla / desafío (duelo)" añadido a la vista de realizar test.
 *
 * Todo mock-based (mismo patrón que el resto del repo: loginAsAlumnoMock +
 * page.route para stubear /duelos/*). El flujo multi-usuario REAL (2 backends,
 * 2 alumnos, crear→unir→finalizar→ranking) NO se monta aquí: es flaky y exige
 * un backend seedeado determinista. Queda como test.skip documentado al final.
 *
 * Data-testids reales usados (verificados en realizar-test.component.html):
 *   - test-desafio-switch / test-examen-switch / test-repaso-switch
 *   - opciones-test-container (contenedor de switches+botón, gated mode=='default')
 *   - popup-desafio-dialog / -explicacion / -tiempo-resolver / -duracion-sala
 *   - popup-desafio-cancelar / popup-desafio-entendido
 *   - unirse-desafio-link / popup-unirse-dialog / codigo-desafio-input
 *   - unirme-desafio-btn / unirse-desafio-message
 *   - generar-test-btn / temas-select
 * El ranking (resultado-simulacro.component.html) NO tiene data-testids →
 * se selecciona por CSS estructural (.leaderboard-container, .usuario-nombre,
 * .tu-badge).
 */

/**
 * Selecciona el primer tema del `app-tema-select` (overlay custom con grupos
 * colapsados). Copiado de realizar-tests.spec.ts para no acoplar los ficheros.
 */
async function seleccionarPrimerTema(page: Page): Promise<void> {
  await page.locator('[data-testid="temas-select"]').click();
  const panel = page.locator('.p-overlaypanel');
  await panel.waitFor({ state: 'visible', timeout: 8_000 });
  await panel.locator('span.font-bold.pointer').first().click(); // expandir grupo
  await panel.locator('.pl-3 span.pointer').first().click(); // primer tema
  await page.keyboard.press('Escape');
}

/**
 * Override del contador de fallos a un valor > 0 para que el switch de repaso
 * (gated por `!!(getFallosCount$ | async)`) SÍ aparezca en modo normal y así
 * poder verificar que el modo desafío lo oculta. Registrar ANTES de goto: el
 * componente pide el contador en el field initializer al cargar.
 */
async function stubFallosCount(page: Page, count = 5): Promise<void> {
  await page.route('**/tests/obtener-fallos-count', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(count),
    }),
  );
}

test.describe('Duelo / Modo desafío — toggles y popups', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAlumnoMock(page);
    await setupTestGenerarInterceptors(page);
    await setupTestPracticaInterceptors(page);
    await stubFallosCount(page, 5); // registrado después → precede al 0 del helper
    await page.goto('/app/test/alumno/realizar-test');
    await expect(
      page.locator('[data-testid="realizar-test-container"]'),
    ).toBeVisible({ timeout: 15_000 });
    // Con fallos>0, el switch de repaso está presente en modo normal.
    await expect(page.locator('[data-testid="test-repaso-switch"]')).toBeVisible();
  });

  test('activar "Test desafío" oculta examen+repaso y abre el popup; cancelar los restaura', async ({
    page,
  }) => {
    // Estado inicial: examen y repaso visibles, desafío off.
    await expect(page.locator('[data-testid="test-examen-switch"]')).toBeVisible();
    await expect(page.locator('[data-testid="test-repaso-switch"]')).toBeVisible();

    // Activar desafío → examen y repaso DESAPARECEN del DOM (*ngIf, no disabled).
    await page.locator('[data-testid="test-desafio-switch"]').click();

    // El data-testid del p-dialog está en el host (que PrimeNG deja "hidden"):
    // el contenido visible se comprueba con un elemento interno del dialog.
    await expect(
      page.locator('[data-testid="popup-desafio-entendido"]'),
    ).toBeVisible();
    await expect(page.locator('[data-testid="test-examen-switch"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="test-repaso-switch"]')).toHaveCount(0);

    // Cancelar el popup → desafío vuelve a off y examen/repaso reaparecen.
    await page.locator('[data-testid="popup-desafio-cancelar"]').click();

    await expect(
      page.locator('[data-testid="popup-desafio-entendido"]'),
    ).toHaveCount(0);
    await expect(page.locator('[data-testid="test-examen-switch"]')).toBeVisible();
    await expect(page.locator('[data-testid="test-repaso-switch"]')).toBeVisible();
    // El switch de desafío queda desmarcado. La clase p-inputswitch-checked
    // vive en el div INTERNO del componente, no en el host con el data-testid.
    await expect(
      page.locator('[data-testid="test-desafio-switch"] .p-inputswitch-checked'),
    ).toHaveCount(0);
  });

  test('popup "Modo desafío": muestra explicación + 2 inputs; "Entendido" lo deja activo', async ({
    page,
  }) => {
    await page.locator('[data-testid="test-desafio-switch"]').click();

    await expect(
      page.locator('[data-testid="popup-desafio-explicacion"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="popup-desafio-tiempo-resolver"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="popup-desafio-duracion-sala"]'),
    ).toBeVisible();

    // "Entendido" mantiene el modo desafío activo y cierra el dialog.
    await page.locator('[data-testid="popup-desafio-entendido"]').click();

    await expect(
      page.locator('[data-testid="popup-desafio-explicacion"]'),
    ).toHaveCount(0);
    await expect(
      page.locator('[data-testid="test-desafio-switch"] .p-inputswitch-checked'),
    ).toHaveCount(1);
    // Sigue en modo desafío → examen permanece oculto.
    await expect(page.locator('[data-testid="test-examen-switch"]')).toHaveCount(0);
  });

  test('popup "Modo desafío": "Cancelar" apaga el switch', async ({ page }) => {
    await page.locator('[data-testid="test-desafio-switch"]').click();
    await expect(
      page.locator('[data-testid="popup-desafio-explicacion"]'),
    ).toBeVisible();

    await page.locator('[data-testid="popup-desafio-cancelar"]').click();

    await expect(
      page.locator('[data-testid="popup-desafio-explicacion"]'),
    ).toHaveCount(0);
    await expect(
      page.locator('[data-testid="test-desafio-switch"] .p-inputswitch-checked'),
    ).toHaveCount(0);
  });
});

test.describe('Duelo / Modo desafío — crear desafío', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAlumnoMock(page);
    await setupTestGenerarInterceptors(page);
    await setupTestPracticaInterceptors(page);
    await page.goto('/app/test/alumno/realizar-test');
    await expect(
      page.locator('[data-testid="realizar-test-container"]'),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('crear desafío llama POST /duelos/crear con el body esperado y muestra el código', async ({
    page,
  }) => {
    let crearBody: any = null;
    await page.route('**/duelos/crear', (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      crearBody = route.request().postDataJSON();
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ codigo: 'BATALLA-TEST01', testId: 123 }),
      });
    });

    // Activar desafío → popup. El tiempo por test es obligatorio en desafío
    // (validador tiempoLimiteEnMinutos), y se rellena EN el popup, no inline.
    await page.locator('[data-testid="test-desafio-switch"]').click();
    await expect(
      page.locator('[data-testid="popup-desafio-tiempo-resolver"]'),
    ).toBeVisible();
    await page
      .locator('[data-testid="popup-desafio-tiempo-resolver"] input')
      .fill('30');
    await page.locator('[data-testid="popup-desafio-entendido"]').click();
    await expect(
      page.locator('[data-testid="popup-desafio-entendido"]'),
    ).toHaveCount(0);

    // Elegir tema → botón "Generar test" habilitado.
    await seleccionarPrimerTema(page);
    await expect(page.locator('[data-testid="generar-test-btn"]')).not.toBeDisabled();

    await page.locator('[data-testid="generar-test-btn"]').click();

    // Diálogo de confirmación (mensaje de desafío) → aceptar.
    await expect(page.locator('.p-confirm-dialog').first()).toBeVisible({ timeout: 5_000 });
    await page.locator('.p-confirm-dialog-accept').click();

    // Se llamó al endpoint con temas + numeroPreguntas.
    await expect.poll(() => crearBody, { timeout: 8_000 }).not.toBeNull();
    expect(Array.isArray(crearBody.temas)).toBe(true);
    expect(crearBody.temas.length).toBeGreaterThan(0);
    expect(typeof crearBody.numeroPreguntas).toBe('number');
    expect(crearBody.tiempoPorTestMin).toBe(30);

    // El código aparece en el toast de éxito.
    const toast = page.locator('[class*="ngx-toastr"]').filter({ hasText: 'BATALLA-TEST01' });
    await expect(toast.first()).toBeVisible({ timeout: 5_000 });
  });
});

test.describe('Duelo / Modo desafío — unirse por código', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAlumnoMock(page);
    await setupTestGenerarInterceptors(page);
    await setupTestPracticaInterceptors(page);
    await page.goto('/app/test/alumno/realizar-test');
    await expect(
      page.locator('[data-testid="realizar-test-container"]'),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('unirse OK: llama POST /duelos/unirse/:codigo y navega al test', async ({
    page,
  }) => {
    let unirseUrl = '';
    await page.route('**/duelos/unirse/**', (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      unirseUrl = route.request().url();
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ testId: 456 }),
      });
    });

    await page.locator('[data-testid="unirse-desafio-link"]').click();
    await expect(page.locator('[data-testid="codigo-desafio-input"]')).toBeVisible();

    await page.locator('[data-testid="codigo-desafio-input"]').fill('BATALLA-JOIN1');
    await page.locator('[data-testid="unirme-desafio-btn"]').click();

    await expect(page).toHaveURL(/realizar-test\/456/, { timeout: 10_000 });
    expect(unirseUrl).toContain('/duelos/unirse/BATALLA-JOIN1');
  });

  test('unirse con código inválido (404): muestra el mensaje inline, NO toast, NO navega', async ({
    page,
  }) => {
    await page.route('**/duelos/unirse/**', (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      return route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Código de desafío no válido' }),
      });
    });

    await page.locator('[data-testid="unirse-desafio-link"]').click();
    await expect(page.locator('[data-testid="codigo-desafio-input"]')).toBeVisible();

    await page.locator('[data-testid="codigo-desafio-input"]').fill('NOPE-000');
    await page.locator('[data-testid="unirme-desafio-btn"]').click();

    // Mensaje inline (p-message) dentro del popup, con el texto del backend.
    const msg = page.locator('[data-testid="unirse-desafio-message"]');
    await expect(msg).toBeVisible({ timeout: 5_000 });
    await expect(msg).toContainText('no válido');

    // El popup sigue abierto y NO se ha navegado.
    await expect(page.locator('[data-testid="codigo-desafio-input"]')).toBeVisible();
    await expect(page).toHaveURL(/realizar-test$/);
    // No debe haber toast de error (el error se muestra inline).
    await expect(page.locator('.toast-error')).toHaveCount(0);
  });
});

test.describe('Duelo / Modo desafío — deep-link ?codigo', () => {
  test('deep-link abre el popup de unirse con el código autorrellenado', async ({
    page,
  }) => {
    await loginAsAlumnoMock(page);
    await setupTestGenerarInterceptors(page);
    await setupTestPracticaInterceptors(page);

    await page.goto('/app/test/alumno/realizar-test?codigo=BATALLA-XYZ');
    await expect(
      page.locator('[data-testid="realizar-test-container"]'),
    ).toBeVisible({ timeout: 15_000 });

    await expect(page.locator('[data-testid="codigo-desafio-input"]')).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.locator('[data-testid="codigo-desafio-input"]')).toHaveValue(
      'BATALLA-XYZ',
    );
  });
});

/**
 * No-regresión admin (mode=injected) — DOCUMENTADO como fixme.
 *
 * El único embed de <app-realizar-test [mode]="'injected'"> vive DENTRO del
 * p-dialog "Añadir preguntas al examen" (addPreguntasDialogVisible) del
 * examenes-dashboard-admin-detailview, en el step 0 de un p-steps. No hay
 * ninguna ruta que monte el componente en modo injected de forma directa:
 * habría que loguearse como admin, cargar un examen (o el flujo "new"), abrir
 * ese diálogo y llegar al step 0 — con mocks pesados y frágiles de toda la
 * vista admin (examen, oposiciones, productos WooCommerce, resultados...).
 *
 * La garantía real es de plantilla y está verificada en el fuente
 * (realizar-test.component.html): TODO el bloque de desafío —switch
 * `test-desafio-switch`, contenedor `opciones-test-container`, enlace
 * `unirse-desafio-link` y los tres p-dialog— está gateado con
 * `*ngIf="mode == 'default'"`, por lo que en injected desaparece del DOM.
 *
 * Se deja como fixme (no fallando) hasta que exista un montaje simple del
 * componente en modo injected contra el que testearlo sin flakiness.
 */
test.fixme(
  'no-regresión admin: en mode=injected NO aparecen los controles de desafío (embed tras diálogo admin — ver comentario)',
  async () => {
    // Intencionadamente vacío: gating verificado por fuente (mode=='default').
  },
);

test.describe('Duelo / Ranking', () => {
  test('pinta la clasificación con los participantes y resalta "Tú"', async ({
    page,
  }) => {
    await loginAsAlumnoMock(page);
    await setupTestGenerarInterceptors(page);

    // Ranking con la misma forma que getSimulacroResultados$ (2 participantes).
    const rankingResponse = {
      examen: { titulo: 'Desafío de Anatomía' },
      resultados: [
        {
          usuario: {
            id: 1,
            nombre: 'Alumno',
            apellidos: 'Uno',
            esTuResultado: true,
          },
          estadisticas: { nota: 8.5, correctas: 17, incorrectas: 3, totalPreguntas: 20 },
          posicion: 1,
          testId: 456,
          fechaRealizacion: new Date().toISOString(),
        },
        {
          usuario: {
            id: 2,
            nombre: 'Rival',
            apellidos: 'Dos',
            esTuResultado: false,
          },
          estadisticas: { nota: 6.0, correctas: 12, incorrectas: 8, totalPreguntas: 20 },
          posicion: 2,
          testId: 789,
          fechaRealizacion: new Date().toISOString(),
        },
      ],
      miPosicion: 1,
      totalParticipantes: 2,
      ultimoIntento: null,
    };

    await page.route('**/duelos/BATALLA-TEST01/ranking', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(rankingResponse),
      }),
    );

    await page.goto('/app/test/alumno/duelo/ranking/BATALLA-TEST01');

    const leaderboard = page.locator('.leaderboard-container');
    await expect(leaderboard).toBeVisible({ timeout: 15_000 });

    // Los 2 participantes están en la tabla de clasificación.
    const nombres = leaderboard.locator('.usuario-nombre');
    await expect(nombres).toHaveCount(2);
    await expect(nombres.filter({ hasText: 'Alumno' })).toBeVisible();
    await expect(nombres.filter({ hasText: 'Rival' })).toBeVisible();

    // El resultado propio se resalta con el badge "Tú".
    const tuBadge = leaderboard.locator('.tu-badge');
    await expect(tuBadge).toHaveCount(1);
    await expect(tuBadge).toContainText('Tú');
  });
});

/**
 * PLACEHOLDER documentado — flujo multi-usuario REAL (2 backends reales).
 *
 * Escenario (verificado MANUALMENTE vía smoke test de API durante la
 * implementación, no automatizado aquí por ser flaky y requerir seed):
 *   1. browser.newContext() x2 → 2 alumnos de la MISMA oposición hacen login real.
 *   2. Alumno A crea un desafío (POST /duelos/crear) → obtiene código real.
 *   3. Alumno B se une con ese código (POST /duelos/unirse/:codigo) → mismo test.
 *   4. Ambos finalizan su test (POST /tests/finalizar-test/:id).
 *   5. Ambos abren /duelo/ranking/:codigo → GET /duelos/:codigo/ranking devuelve
 *      2 participantes ordenados por nota; cada uno ve su fila resaltada ("Tú").
 *
 * Se deja SKIP (no fallando) hasta que exista un entorno con BD seedeada
 * determinista contra el que este flujo sea reproducible sin flakiness.
 */
test.skip('multi-usuario real: crear→unir→finalizar→ranking (requiere backend seedeado)', async () => {
  // Intencionadamente vacío: ver comentario arriba. Verificado a mano vía API.
});
