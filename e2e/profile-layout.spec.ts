import { expect, Page, test } from '@playwright/test';
import alumno from './fixtures/user-alumno.json';
import { loginAsRoleMock } from './helpers/auth.helper';

async function openProfile(page: Page, rol: 'ALUMNO' | 'ADMIN' = 'ALUMNO') {
  const user = {
    ...alumno,
    nombre: 'Lucía',
    apellidos: 'Soler',
    email: 'lucia.soler.con-un-correo-largo@example.test',
    dni: '00000000T',
    rol,
    suscripciones: [
      {
        id: 1,
        tipo: 'PREMIUM',
        oposicion: 'VALENCIA_AYUNTAMIENTO',
        status: 'ACTIVE',
      },
      { id: 2, tipo: 'ADVANCED', oposicion: 'ALICANTE_CPBA', status: 'ACTIVE' },
    ],
  };
  await page.route('**/user/me/planificaciones', (r) =>
    r.fulfill({ json: [] }),
  );
  await page.route('**/user/tutores', (r) => r.fulfill({ json: [] }));
  await page.route('**/cursos/mios', (r) => r.fulfill({ json: [] }));
  await page.route('**/planificaciones/configuracion', (r) =>
    r.fulfill({ json: { configuracionActiva: null } }),
  );
  await loginAsRoleMock(page, { rol, email: user.email, userFixture: user });
  await page.goto('/app/profile');
  await expect(
    page.getByRole('heading', { name: 'Lucía Soler', exact: true }),
  ).toBeVisible();
}

for (const width of [1440, 768, 390]) {
  test(`Perfil conserva jerarquía, controles y cuadrícula a ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 940 });
    await openProfile(page);
    const avatar = page.getByRole('button', { name: 'Cambiar foto de perfil' });
    await expect(avatar).toContainText('LS');
    await expect(avatar).toHaveCSS('width', '56px');
    await expect(avatar).toHaveCSS('height', '56px');
    const data = page.getByTestId('alumno-datos');
    const plans = page.getByTestId('alumno-suscripciones');
    const dataBox = await data.boundingBox();
    const plansBox = await plans.boundingBox();
    if (width > 800) {
      expect(Math.abs(dataBox!.y - plansBox!.y)).toBeLessThan(1);
      expect(plansBox!.x).toBeGreaterThan(dataBox!.x + dataBox!.width);
    } else {
      expect(plansBox!.y).toBeGreaterThan(dataBox!.y + dataBox!.height);
    }
    const colors = await page.evaluate(() => ({
      background: getComputedStyle(document.querySelector('app-profile')!)
        .backgroundColor,
      surface: getComputedStyle(document.querySelector('.alumno-card')!)
        .backgroundColor,
      label: getComputedStyle(document.querySelector('.alumno-info-fields dt')!)
        .color,
      value: getComputedStyle(document.querySelector('.alumno-info-fields dd')!)
        .color,
      secondary: getComputedStyle(document.documentElement).getPropertyValue(
        '--text-color-secondary',
      ),
    }));
    expect(colors.background).not.toBe(colors.surface);
    expect(colors.label).not.toBe(colors.value);
    expect(colors.secondary).not.toContain('lighten(');
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (width === 390) {
      await expect
        .poll(
          async () => (await page.locator('.alumno-eyebrow').boundingBox())!.y,
        )
        .toBeGreaterThanOrEqual(45);
    }
    const note = page.getByRole('note');
    await expect(note).toContainText('5 días');
    expect(await plans.getByRole('note').count()).toBe(0);
    await page
      .getByRole('button', { name: 'Ocultar recordatorio de cancelación' })
      .click();
    await expect(note).toHaveCount(0);
    await page
      .getByRole('heading', { name: 'Lucía Soler', exact: true })
      .scrollIntoViewIfNeeded();
    await page.screenshot({
      path: info.outputPath(`perfil-${width}.png`),
      fullPage: true,
    });
  });
}

test('Perfil de administrador usa el ancho disponible y el avatar funciona con teclado', async ({
  page,
}) => {
  await openProfile(page, 'ADMIN');
  const gridBox = await page.locator('.alumno-page-grid').boundingBox();
  const cardBox = await page.getByTestId('alumno-datos').boundingBox();
  expect(Math.abs(gridBox!.width - cardBox!.width)).toBeLessThan(1);
  await expect(page.getByTestId('alumno-suscripciones')).toHaveCount(0);
  const avatar = page.getByRole('button', { name: 'Cambiar foto de perfil' });
  await avatar.focus();
  const chooserPromise = page.waitForEvent('filechooser');
  await page.keyboard.press('Enter');
  const chooser = await chooserPromise;
  expect(chooser.isMultiple()).toBe(false);
});
