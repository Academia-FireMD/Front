import { expect, Page, test } from '@playwright/test';
import alumno from './fixtures/user-alumno.json';
import { loginAsRoleMock } from './helpers/auth.helper';

async function openProfile(
  page: Page,
  rol: 'ALUMNO' | 'ADMIN' | 'SUPERADMIN' = 'ALUMNO',
  wp = false,
  oposicion = 'VALENCIA_AYUNTAMIENTO',
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
        oposicion,
        status: 'ACTIVE',
        fechaInicio: '2026-10-01T12:00:00Z',
        monthlyPrice: 79.9,
        isGeneric: wp,
        fuenteGestion: wp ? 'WOOCOMMERCE' : 'EXTERNA',
      },
      {
        id: 2,
        tipo: 'ADVANCED',
        oposicion: 'ALICANTE_CPBA',
        status: 'ACTIVE',
        fechaInicio: '2026-09-01T12:00:00Z',
        fuenteGestion: 'EXTERNA',
      },
    ],
  };
  for (const path of ['user/tutores', 'cursos/mios'])
    await page.route('**/' + path, (r) => r.fulfill({ json: [] }));
  await page.route('**/user/me/planificaciones', (r) =>
    r.fulfill({
      json: [
        {
          planificacion: {
            id: 55,
            identificador: 'Plan de estudio Madrid',
            descripcion: 'Plan del mes',
            relevancia: ['MADRID'],
          },
        },
      ],
    }),
  );
  await page.route('**/planificaciones/configuracion', (r) =>
    r.fulfill({ json: { configuracionActiva: null } }),
  );
  await loginAsRoleMock(page, { rol, email: user.email, userFixture: user });
  await page.route('**/api/app-config', (r) =>
    r.fulfill({
      json: {
        appName: 'TecnikaFire',
        logoUrl: null,
        primaryColor: '#bb292a',
        secondaryColor: '#2c2c2c',
        updatedAt: new Date().toISOString(),
      },
    }),
  );
  await page.goto('/app/profile');
  await page.waitForLoadState('networkidle');
  await expect(
    page.getByRole('heading', { name: 'Lucía Soler', exact: true }),
  ).toBeVisible();
  return user;
}
for (const width of [1440, 768, 390])
  test(`Perfil conserva tarjetas, logos y opciones a ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 940 });
    await openProfile(page);
    const avatar = page.getByRole('button', { name: 'Cambiar foto de perfil' });
    await expect(avatar).toContainText('LS');
    await expect(avatar).toHaveCSS('width', '56px');
    const form = page.getByTestId('profile-main-card'),
      subs = page.getByTestId('profile-subscriptions-card');
    await expect(form).toContainText('Lucía Soler');
    await expect(
      form.getByRole('button', { name: 'Editar', exact: true }),
    ).toBeVisible();
    await expect(form.getByRole('textbox')).toHaveCount(0);
    const a = await form.boundingBox(),
      b = await subs.boundingBox();
    if (width >= 992) {
      expect(Math.abs(a!.y - b!.y)).toBeLessThan(1);
      expect(b!.x).toBeGreaterThan(a!.x + a!.width);
    } else expect(b!.y).toBeGreaterThan(a!.y + a!.height);
    await expect(subs.locator('app-oposicion-identidad img')).toHaveCount(2);
    for (const img of await subs.locator('app-oposicion-identidad img').all())
      await expect
        .poll(() => img.evaluate((e: HTMLImageElement) => e.naturalWidth))
        .toBeGreaterThan(0);
    await expect(subs.getByText(/Desde/)).toHaveCount(2);
    await expect(subs).toContainText('79,90');
    await expect(
      page.getByTestId('profile-planning-card').locator('img'),
    ).toHaveAttribute('src', 'oposiciones/madrid.png');
    const nativeButton = form.getByRole('button', {
      name: 'Editar',
      exact: true,
    });
    await expect(nativeButton).toHaveClass(/p-button/);
    await expect(nativeButton).toHaveCSS('font-size', '16px');
    await expect(form.locator('.alumno-card-head')).toHaveCSS('height', '56px');
    await expect(form.locator('.alumno-card-head p')).toHaveCount(0);
    await expect(form.locator('.alumno-card-intro')).toContainText(
      'Mantén tu información al día.',
    );
    await expect(nativeButton).toHaveCSS('color', 'rgb(255, 255, 255)');
    await expect(form.locator('.alumno-card-head')).toHaveCSS(
      'background-color',
      'rgb(187, 41, 42)',
    );
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
    await page.mouse.move(0, 0);
    await expect(page.locator('.p-tooltip')).toHaveCount(0);
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
  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  await expect(page.getByText('Este usuario es tutor?')).toBeVisible();
  await expect(
    page.getByRole('dialog').getByLabel('Tutor asignado'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  const avatar = page.getByRole('button', { name: 'Cambiar foto de perfil' });
  await avatar.focus();
  await expect(avatar).toBeFocused();
  const choose = page.waitForEvent('filechooser');
  await page.keyboard.press('Enter');
  expect((await choose).isMultiple()).toBe(false);
});
for (const rol of ['ALUMNO', 'ADMIN', 'SUPERADMIN'] as const)
  test(`Tutorías Madrid solo consulta y muestra saldo de alumno: ${rol}`, async ({
    page,
  }) => {
    let consultas = 0;
    await page.route('**/madrid-tutorias/creditos', (r) => {
      consultas++;
      return r.fulfill({
        json: {
          disponibles: 2,
          reservados: 1,
          consumidos: 3,
          expirados: 0,
          historial: [],
        },
      });
    });
    await openProfile(page, rol, false, 'MADRID');
    const saldo = page.getByTestId('madrid-tutoria-balance-card');
    if (rol === 'ALUMNO') {
      await expect(saldo).toBeVisible();
      await expect(saldo).toContainText('Disponibles');
      await expect(saldo.locator('strong')).toHaveText(['2', '1', '3']);
      // El login puede visitar Perfil antes de la navegación explícita.
      expect(consultas).toBeGreaterThan(0);
    } else {
      await expect(saldo).toHaveCount(0);
      expect(consultas).toBe(0);
    }
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
  await page.getByRole('button', { name: 'Editar', exact: true }).click();
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
  await page
    .getByRole('button', { name: 'Gestionar plan Premium', exact: true })
    .click();
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
  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  const picker = page.locator('app-metodo-calificacion-picker .p-dropdown');
  await page
    .getByRole('button', { name: 'Guardar cambios', exact: true })
    .click();
  await expect(picker).toHaveClass(/p-disabled/);
  await expect(page.getByLabel('Nombre', { exact: true })).toBeDisabled();
  expect(writes).toHaveLength(1);
  expect(writes[0].metodoCalificacion).toBe('A1_E1_3_B0');
  release();
  await expect(
    page.getByRole('dialog', { name: 'Editar mis datos' }),
  ).not.toBeVisible();
  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  await expect(picker).not.toHaveClass(/p-disabled/);
  await expect(page.getByLabel('Nombre', { exact: true })).toBeEnabled();
});

test('cancelar edición descarta borrador y el tema admite otro primario', async ({
  page,
}) => {
  await openProfile(page);
  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Editar mis datos' });
  await expect(dialog.getByLabel('Email', { exact: true })).toBeDisabled();
  await dialog.getByLabel('Nombre', { exact: true }).fill('Sin guardar');
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(page.getByTestId('profile-main-card')).toContainText(
    'Lucía Soler',
  );
  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  await expect(dialog.getByLabel('Nombre', { exact: true })).toHaveValue(
    'Lucía',
  );
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.route('**/api/app-config', (r) =>
    r.fulfill({
      json: {
        appName: 'Academia QA',
        primaryColor: '#123456',
        secondaryColor: '#2c2c2c',
        logoUrl: null,
        updatedAt: new Date().toISOString(),
      },
    }),
  );
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Editar', exact: true }),
  ).toHaveCSS('color', 'rgb(255, 255, 255)');
  await expect(
    page.getByTestId('profile-main-card').locator('.alumno-card-head'),
  ).toHaveCSS('background-color', 'rgb(18, 52, 86)');
});
test('un escudo de planificación que falla conserva nombre y acceso', async ({
  page,
}) => {
  await page.route('**/oposiciones/madrid.png', (r) => r.abort());
  await openProfile(page);
  const plan = page.getByTestId('profile-planning-card');
  await expect(plan).toContainText('Plan de estudio Madrid');
  await expect(plan.locator('img')).toHaveCount(0);
  await expect(
    plan.locator('app-oposicion-identidad .pi-calendar'),
  ).toBeVisible();
  await expect(
    plan.getByRole('button', { name: 'Ver mi planificación', exact: true }),
  ).toBeVisible();
});

test('cabeceras mantienen contraste con un primario claro', async ({
  page,
}, info) => {
  await openProfile(page);
  await page.route('**/api/app-config', (r) =>
    r.fulfill({
      json: {
        appName: 'Academia QA',
        primaryColor: '#ffd54f',
        secondaryColor: '#2c2c2c',
        logoUrl: null,
        updatedAt: new Date().toISOString(),
      },
    }),
  );
  await page.reload();
  const header = page
    .getByTestId('profile-main-card')
    .locator('.alumno-card-head');
  await expect(header).toHaveCSS('background-color', 'rgb(255, 213, 79)');
  await expect(header.getByRole('heading')).toHaveCSS('color', 'rgb(0, 0, 0)');
  await expect(
    header.getByRole('button', { name: 'Editar', exact: true }),
  ).toHaveCSS('color', 'rgb(0, 0, 0)');
  await expect(page.getByTestId('profile-facturas')).toHaveCSS(
    'color',
    'rgb(0, 0, 0)',
  );
  await page.screenshot({
    path: info.outputPath('perfil-tema-claro.png'),
    fullPage: true,
  });
});
