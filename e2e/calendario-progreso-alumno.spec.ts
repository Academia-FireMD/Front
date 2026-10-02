import { expect, test } from '@playwright/test';
import { loginAsRoleMock } from './helpers/auth.helper';

const PLAN_ID = 9876;
const hoy = new Date();
hoy.setHours(10, 0, 0, 0);
const fecha = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
const tituloLargo =
  'ENTRENAMIENTO físico de resistencia y fuerza con un título deliberadamente muy largo para comprobar la casilla';

for (const viewport of [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'movil', width: 375, height: 667 },
]) {
  test(`alumno marca entrenamiento sin abrir física, ve Markdown y casilla accesible en ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    let guardados = 0;
    await page.route(
      `**/planificaciones/planificaciones-mensuales/${PLAN_ID}`,
      (route) =>
        route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            id: PLAN_ID,
            identificador: 'QA-CALENDARIO',
            descripcion: 'Prueba de calendario',
            mes: hoy.getMonth() + 1,
            ano: hoy.getFullYear(),
            relevancia: [],
            esPorDefecto: false,
            tipoDePlanificacion: 'FRANJA_CUATRO_A_SEIS_HORAS',
            subBloques: [
              {
                id: 98761,
                planificacionId: PLAN_ID,
                nombre: tituloLargo,
                horaInicio: hoy.toISOString(),
                duracion: 60,
                color: '#f59e0b',
                comentarios: '**Indicaciones importantes** de estudio',
                realizado: false,
                esEntrenamientoFisico: true,
              },
            ],
          }),
        }),
    );
    await page.route(
      `**/planificaciones/eventos-personalizados/${PLAN_ID}`,
      (route) => route.fulfill({ contentType: 'application/json', body: '[]' }),
    );
    await page.route('**/planificacion-fisica/resumen-dias**', (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify([
          {
            fecha,
            bloqueId: 77,
            disciplinas: [
              {
                nombre: 'Carrera',
                grupo: 'CARRERA',
                color: '#123456',
                realizado: false,
              },
            ],
          },
        ]),
      }),
    );
    await page.route(
      '**/planificaciones/actualizar-progreso-subbloque',
      (route) => {
        expect(route.request().postDataJSON()).toMatchObject({
          subBloqueId: 98761,
          planificacionId: PLAN_ID,
          realizado: true,
        });
        guardados++;
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: '{}',
        });
      },
    );
    await loginAsRoleMock(page, {
      rol: 'ALUMNO',
      userFixture: {
        id: 1,
        email: 'alumno@test.com',
        nombre: 'Test',
        apellidos: 'Alumno',
        rol: 'ALUMNO',
        validated: true,
        onboardingCompletado: true,
        suscripciones: [{ id: 1, tipo: 'PREMIUM', status: 'ACTIVE' }],
        oposiciones: [],
      },
      modulos: { PLANIFICACION_FISICA: true },
    });

    await page.goto(
      `/app/planificacion/planificacion-mensual-alumno/${PLAN_ID}`,
    );
    if (await page.locator('mwl-calendar-month-view').count())
      await page
        .getByRole('button', { name: 'Cambiar entre vista semanal y mensual' })
        .click();
    await expect(page.locator('app-vista-semanal')).toBeVisible();
    const tarjeta = page
      .locator('.wrapper')
      .filter({ hasText: tituloLargo })
      .first();
    const casilla = tarjeta.getByTestId('completion-toggle');
    await expect(casilla).toBeVisible();
    await expect(casilla).toHaveAttribute('aria-checked', 'false');
    await expect(tarjeta.locator('.event-comments strong')).toContainText(
      'Indicaciones importantes',
    );
    await casilla.scrollIntoViewIfNeeded();
    const box = await casilla.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
    await page.screenshot({
      path: `test-results/calendario-${viewport.name}-antes.png`,
      fullPage: true,
    });
    if (viewport.name === 'desktop') {
      await casilla.focus();
      await expect(casilla).toBeFocused();
      await page.keyboard.press('Space');
    } else {
      await casilla.click();
    }
    await expect(casilla).toHaveAttribute('aria-checked', 'true');
    await expect.poll(() => guardados).toBe(1);
    await expect(page).toHaveURL(
      new RegExp(`planificacion-mensual-alumno/${PLAN_ID}$`),
    );
    await page.screenshot({
      path: `test-results/calendario-${viewport.name}-marcado.png`,
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });
}
