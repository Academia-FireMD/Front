import { expect, test } from '@playwright/test';
import { loginAsRoleMock } from './helpers/auth.helper';

for (const viewport of [
  { name: 'escritorio', width: 1440, height: 900 },
  { name: 'movil', width: 390, height: 844 },
]) {
  test(`la ficha personal no duplica preferencias y las conserva al guardar en ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    const usuario: Record<string, unknown> = {
      id: 1,
      email: 'alumno@test.com',
      nombre: 'Test',
      apellidos: 'Alumno',
      rol: 'ALUMNO',
      validated: true,
      onboardingCompletado: false,
      dni: '',
      tipoOposicion: ['MADRID'],
      nivelOposicion: 'AVANZADO',
      tipoDePlanificacionDuracionDeseada: 'FRANJA_CUATRO_A_SEIS_HORAS',
      suscripciones: [{ id: 1, tipo: 'PREMIUM', status: 'ACTIVE' }],
      oposiciones: [],
    };
    let payloadGuardado: Record<string, unknown> | undefined;
    let ultimoPerfil: Record<string, unknown> | undefined;
    const json = (body: unknown) => ({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });

    await loginAsRoleMock(page, {
      rol: 'ALUMNO',
      email: 'alumno@test.com',
      userFixture: usuario,
    });
    await page.route('**/user/profile', (route) => {
      ultimoPerfil = { ...usuario };
      return route.fulfill(json(usuario));
    });
    await page.route('**/user/update-onboarding', async (route) => {
      payloadGuardado = route.request().postDataJSON() as Record<
        string,
        unknown
      >;
      Object.assign(usuario, payloadGuardado);
      return route.fulfill(json(usuario));
    });

    await page.goto('/app/profile');
    const ficha = page.getByRole('dialog', {
      name: 'Completar ficha personal',
    });
    await expect(ficha).toBeVisible();
    await expect(ficha.locator('app-planificacion-preferencias')).toHaveCount(
      0,
    );
    await expect(ficha.getByLabel('Oposición')).toHaveCount(0);
    await expect(ficha.getByLabel('Nivel')).toHaveCount(0);
    await expect(
      ficha.getByLabel('Horas disponibles para el estudio'),
    ).toHaveCount(0);

    await ficha.locator('input[formControlName="dni"]').fill('87654321Z');
    await ficha
      .getByRole('button', {
        name: /Guardar información|Actualizar información/,
      })
      .click();
    await expect(ficha).not.toBeVisible();

    expect(payloadGuardado).toMatchObject({ dni: '87654321Z' });
    expect(payloadGuardado).not.toHaveProperty('tipoOposicion');
    expect(payloadGuardado).not.toHaveProperty('nivelOposicion');
    expect(payloadGuardado).not.toHaveProperty(
      'tipoDePlanificacionDuracionDeseada',
    );
    expect(usuario).toMatchObject({
      tipoOposicion: ['MADRID'],
      nivelOposicion: 'AVANZADO',
      tipoDePlanificacionDuracionDeseada: 'FRANJA_CUATRO_A_SEIS_HORAS',
      dni: '87654321Z',
    });

    await page.reload();
    await expect(
      page.getByRole('heading', { name: /Mi Perfil/ }),
    ).toBeVisible();
    expect(ultimoPerfil).toMatchObject({
      tipoOposicion: ['MADRID'],
      nivelOposicion: 'AVANZADO',
      tipoDePlanificacionDuracionDeseada: 'FRANJA_CUATRO_A_SEIS_HORAS',
      dni: '87654321Z',
    });
  });
}
