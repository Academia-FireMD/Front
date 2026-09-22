/**
 * QA autenticado real de la autoasignación en staging.
 *
 * Las credenciales y la carpeta de evidencias se reciben por entorno. El test
 * no crea ni persiste secretos y no arranca un servidor local.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

const requiredEnvironment = [
  'E2E_STAGING_BASE_URL',
  'E2E_STAGING_EMAIL',
  'E2E_STAGING_PASSWORD',
  'E2E_STAGING_SCREENSHOT_DIR',
] as const;

const missingEnvironment = requiredEnvironment.filter(
  (name) => !process.env[name],
);

test.skip(
  missingEnvironment.length > 0,
  `Requiere variables de staging: ${missingEnvironment.join(', ')}`,
);

function evidencePath(name: string): string {
  const directory = process.env['E2E_STAGING_SCREENSHOT_DIR']!;
  mkdirSync(directory, { recursive: true });
  return join(directory, name);
}

async function capture(page: Page, name: string): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await page.screenshot({ path: evidencePath(name), fullPage: false });
}

async function selectDropdownOption(
  page: Page,
  inputId: string,
  optionName: RegExp,
): Promise<void> {
  const input = page.locator(`#${inputId}`);
  await input.click();
  await page.getByRole('option', { name: optionName }).click();
}

test('alumno QA completa el asistente real y conserva una UI responsive', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const email = process.env['E2E_STAGING_EMAIL']!;
  const password = process.env['E2E_STAGING_PASSWORD']!;

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/auth/login');
  await expect(page.getByRole('button', { name: 'Acceder' })).toBeVisible();
  await capture(page, '01-login-desktop.png');

  await page.locator('input[formControlName="email"]').fill(email);
  await page.locator('app-password-input input').fill(password);
  await page.getByRole('button', { name: 'Acceder' }).click();
  await page.waitForURL(/\/app\//, { timeout: 20_000 });

  await page.goto('/app/planificacion/configuracion-alumno');
  const wizard = page.locator('app-planificacion-configuracion-wizard');
  await expect(wizard).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('STAGING')).toBeVisible();

  const oposicion = page.locator('#wizardPreferenciasOposicion');
  await expect(oposicion).toHaveAttribute(
    'aria-label',
    /Solo se muestran las oposiciones incluidas en tus suscripciones activas/,
  );
  await capture(page, '02-preferencias-desktop.png');

  await selectDropdownOption(
    page,
    'wizardPreferenciasOposicion',
    /Ayuntamiento de Valencia/,
  );
  await selectDropdownOption(page, 'wizardPreferenciasFranja', /6-8 horas/i);
  await expect(page.getByRole('button', { name: 'Continuar' })).toBeEnabled();
  await page.getByRole('button', { name: 'Continuar' }).click();

  await expect(
    page.getByRole('heading', { name: 'Nivel de estudio' }),
  ).toBeVisible();
  await capture(page, '03-nivel-desktop.png');

  const testNivel = page.getByRole('button', {
    name: /Hacer test de nivel|Repetir test de nivel/,
  });
  await testNivel.click();
  const cuestionario = page.getByTestId('cuestionario-nivel');
  await expect(cuestionario).toBeVisible();
  await expect(
    cuestionario.locator('input[type="radio"]').first(),
  ).toBeAttached({
    timeout: 20_000,
  });
  await capture(page, '04-test-nivel-desktop.png');

  const radioNames = await cuestionario
    .locator('input[type="radio"]')
    .evaluateAll((inputs) => [
      ...new Set(inputs.map((input) => (input as HTMLInputElement).name)),
    ]);
  expect(radioNames.length).toBeGreaterThan(0);
  const radioButtons = cuestionario.locator('.p-radiobutton-box');
  const optionCount = (await radioButtons.count()) / radioNames.length;
  expect(Number.isInteger(optionCount)).toBe(true);
  for (let question = 0; question < radioNames.length; question++) {
    await radioButtons.nth(question * optionCount).click();
  }
  await page.getByRole('button', { name: 'Obtener recomendación' }).click();
  await expect(page.getByText(/Te recomendamos el nivel/)).toBeVisible({
    timeout: 20_000,
  });
  await capture(page, '05-recomendacion-desktop.png');
  await page.getByRole('button', { name: 'Aceptar recomendación' }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();

  await expect(
    page.getByRole('heading', { name: 'Confirma tu planificación' }),
  ).toBeVisible();
  await capture(page, '06-confirmacion-desktop.png');
  const configuracionGuardada = page.waitForResponse(
    (response) =>
      response.request().method() === 'PUT' &&
      new URL(response.url()).pathname.endsWith(
        '/planificaciones/configuracion',
      ),
    { timeout: 30_000 },
  );
  await page.getByRole('button', { name: 'Confirmar planificación' }).click();
  expect((await configuracionGuardada).ok()).toBe(true);
  await page.waitForURL(
    (url) => !url.pathname.endsWith('/planificacion/configuracion-alumno'),
    { timeout: 30_000 },
  );
  await expect(page.locator('body')).not.toContainText('Error interno');
  await capture(page, '07-resultado-desktop.png');

  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto(
    '/app/planificacion/configuracion-alumno?gestionar=preferencias',
  );
  await expect(wizard).toBeVisible({ timeout: 20_000 });
  await capture(page, '08-preferencias-mobile.png');

  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(
    page.getByRole('heading', { name: 'Nivel de estudio' }),
  ).toBeVisible();
  await capture(page, '09-nivel-mobile.png');

  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(
    page.getByRole('heading', { name: 'Confirma tu planificación' }),
  ).toBeVisible();
  const dimensions = await wizard.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(
    dimensions.clientWidth + 1,
  );
  await capture(page, '10-confirmacion-mobile.png');
});
