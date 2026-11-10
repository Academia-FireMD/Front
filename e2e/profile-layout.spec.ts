import { expect, Page, test } from '@playwright/test';
import alumno from './fixtures/user-alumno.json';
import { loginAsRoleMock } from './helpers/auth.helper';

async function openProfile(
  page: Page,
  rol: 'ALUMNO' | 'ADMIN' = 'ALUMNO',
  wp = false,
) {
  const user = {
    ...alumno,
    nombre: 'Lucía',
    apellidos: 'Soler',
    email: 'lucia.soler.con-un-correo-largo@example.test',
    dni: '00000000T',
    rol,
    woocommerceCustomerId: wp ? 42 : null,
    suscripciones: [
      {
        id: 1,
        tipo: 'PREMIUM',
        oposicion: 'VALENCIA_AYUNTAMIENTO',
        status: 'ACTIVE',
        fechaInicio: '2026-10-01T12:00:00Z',
        monthlyPrice: 79.9,
        isGeneric: wp,
      },
      {
        id: 2,
        tipo: 'ADVANCED',
        oposicion: 'ALICANTE_CPBA',
        status: 'ACTIVE',
        fechaInicio: '2026-09-01T12:00:00Z',
      },
    ],
  };
  for (const path of ['user/me/planificaciones', 'user/tutores', 'cursos/mios'])
    await page.route('**/' + path, (r) => r.fulfill({ json: [] }));
  await page.route('**/planificaciones/configuracion', (r) =>
    r.fulfill({ json: { configuracionActiva: null } }),
  );
  await loginAsRoleMock(page, { rol, email: user.email, userFixture: user });
  await page.goto('/app/profile');
  await page.waitForLoadState('networkidle');
  await expect(
    page.getByRole('heading', { name: 'Lucía Soler', exact: true }),
  ).toBeVisible();
  return user;
}
for (const width of [1440, 768, 390])
  test(`Perfil conserva formulario, logos y opciones a ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 940 });
    await openProfile(page);
    const avatar = page.getByRole('button', { name: 'Cambiar foto de perfil' });
    await expect(avatar).toContainText('LS');
    await expect(avatar).toHaveCSS('width', '56px');
    const form = page.getByTestId('profile-main-card'),
      subs = page.getByTestId('profile-subscriptions-card');
    await expect(form.getByLabel('Nombre', { exact: true })).toHaveValue(
      'Lucía',
    );
    await expect(form.getByLabel('Email', { exact: true })).toBeDisabled();
    await expect(
      form.getByRole('button', { name: 'Guardar cambios' }),
    ).toBeVisible();
    const a = await form.boundingBox(),
      b = await subs.boundingBox();
    if (width >= 992) {
      expect(Math.abs(a!.y - b!.y)).toBeLessThan(1);
      expect(b!.x).toBeGreaterThan(a!.x + a!.width);
    } else expect(b!.y).toBeGreaterThan(a!.y + a!.height);
    await expect(subs.locator('.subscription-logo')).toHaveCount(2);
    for (const img of await subs.locator('.subscription-logo').all())
      await expect
        .poll(() => img.evaluate((e: HTMLImageElement) => e.naturalWidth))
        .toBeGreaterThan(0);
    await expect(subs.getByText('Desde', { exact: true })).toHaveCount(2);
    await expect(subs).toContainText('79.9€/mes');
    await expect(
      page.getByRole('button', { name: 'Vincular con WordPress', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', {
        name: 'Gestionar mi planificación',
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByRole('note')).toContainText('5 días');
    await page
      .getByRole('button', { name: 'Ocultar recordatorio de cancelación' })
      .click();
    await expect(page.getByRole('note')).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue(
          '--text-color-secondary',
        ),
      ),
    ).not.toContain('lighten(');
    await page.locator('app-profile').evaluate((e) => (e.scrollTop = 0));
    await page.screenshot({
      path: info.outputPath(`perfil-${width}.png`),
      fullPage: true,
    });
  });
test('administrador conserva formulario completo, tutor y selector de foto con teclado', async ({
  page,
}) => {
  await openProfile(page, 'ADMIN');
  await expect(page.getByTestId('profile-subscriptions-card')).toHaveCount(0);
  await expect(page.getByText('Este usuario es tutor?')).toBeVisible();
  const avatar = page.getByRole('button', { name: 'Cambiar foto de perfil' });
  await avatar.focus();
  await expect(avatar).toBeFocused();
  const choose = page.waitForEvent('filechooser');
  await page.keyboard.press('Enter');
  expect((await choose).isMultiple()).toBe(false);
});
test('el formulario guarda datos del propio usuario y permite reintentar un fallo', async ({
  page,
}) => {
  await openProfile(page);
  const writes: any[] = [];
  await page.route('**/user/update/1', (r) => {
    writes.push(r.request().postDataJSON());
    return r.fulfill(
      writes.length === 1
        ? { status: 503, json: { message: 'QA sin conexión' } }
        : { json: {} },
    );
  });
  await page.getByLabel('Nombre', { exact: true }).fill('Nombre actualizado');
  await page
    .getByRole('button', { name: 'Guardar cambios', exact: true })
    .click();
  await expect(page.locator('.profile-save-error')).toBeVisible();
  await expect(page.getByLabel('Nombre', { exact: true })).toHaveValue(
    'Nombre actualizado',
  );
  await page
    .getByRole('button', { name: 'Guardar cambios', exact: true })
    .click();
  await expect(page.locator('.profile-save-error')).toHaveCount(0);
  expect(writes).toHaveLength(2);
  expect(writes[1].nombre).toBe('Nombre actualizado');
  expect(writes[1]).not.toHaveProperty('rol');
  expect(writes[1]).not.toHaveProperty('esTutor');
});
test('WooCommerce conserva cambiar oposición, plan, tarjeta y baja en su menú', async ({
  page,
}) => {
  await openProfile(page, 'ALUMNO', true);
  await page.getByRole('button', { name: /Opciones de Premium/ }).click();
  for (const label of [
    'Cambiar oposición',
    'Cambiar plan',
    'Cambiar tarjeta de pago',
    'Dar de baja',
  ])
    await expect(
      page.getByRole('menuitem', { name: label, exact: true }),
    ).toBeVisible();
  await page
    .getByRole('menuitem', { name: 'Cambiar tarjeta de pago', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toContainText('tarjeta');
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('button', { name: 'Añadir más planes', exact: true }),
  ).toBeVisible();
});

test('el selector de calificación queda bloqueado durante el guardado y se recupera al terminar', async ({
  page,
}) => {
  await openProfile(page);
  let release!: () => void;
  const writes: any[] = [];
  await page.route('**/user/update/1', async (r) => {
    writes.push(r.request().postDataJSON());
    await new Promise<void>((resolve) => (release = resolve));
    await r.fulfill({ json: {} });
  });
  const picker = page.locator('app-metodo-calificacion-picker .p-dropdown');
  await page
    .getByRole('button', { name: 'Guardar cambios', exact: true })
    .click();
  await expect(picker).toHaveClass(/p-disabled/);
  await expect(page.getByLabel('Nombre', { exact: true })).toBeDisabled();
  expect(writes).toHaveLength(1);
  expect(writes[0].metodoCalificacion).toBe('A1_E1_3_B0');
  release();
  await expect(picker).not.toHaveClass(/p-disabled/);
  await expect(page.getByLabel('Nombre', { exact: true })).toBeEnabled();
});
