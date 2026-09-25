import { expect, test } from '@playwright/test';
import userAlumnoFixture from './fixtures/user-alumno.json';
import { loginAsRoleMock } from './helpers/auth.helper';

for (const oposiciones of [['MADRID'], ['MADRID', 'ALICANTE_CPBA']]) {
  test(`ficha separa ${oposiciones.length} suscripción(es) de la planificación confirmada`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    const user = {
      ...userAlumnoFixture,
      tipoOposicion: ['VALENCIA_AYUNTAMIENTO'],
      suscripciones: oposiciones.map((oposicion, index) => ({
        ...userAlumnoFixture.suscripciones[0],
        id: index + 1,
        oposicion,
        status: 'ACTIVE',
      })),
    };
    await page.route('**/planificaciones/configuracion', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          configuracionActiva: {
            variante: {
              oposicion: 'MADRID',
              nivel: 'INICIACION',
              franja: 'FRANJA_SEIS_A_OCHO_HORAS',
            },
          },
          oposicionesPermitidas: [...oposiciones, 'GENERAL'],
        }),
      }),
    );
    await loginAsRoleMock(page, {
      rol: 'ALUMNO',
      userFixture: user,
      modulos: { PLANIFICACION_AUTOASIGNACION: true },
    });
    await page.goto('/app/profile');
    await expect(page.getByText('Oposiciones contratadas:')).toBeVisible();
    const resumen = page.locator('.planification-section');
    await expect(resumen).toContainText('Comunidad de Madrid');
    await expect(resumen).toContainText('Iniciación');
    await expect(resumen).toContainText('6-8 horas');
    if (oposiciones.length === 2) {
      await expect(resumen).toContainText('Consorcio de Alicante');
    }
    await expect(resumen).not.toContainText('Ayuntamiento de Valencia');
    await expect(resumen.getByRole('button', { name: 'Gestionar mi planificación' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  });
}
