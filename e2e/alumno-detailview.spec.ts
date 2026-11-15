import { expect, test, Page } from '@playwright/test';
import admin from './fixtures/user-admin.json';
import { loginAsRoleMock, loginAsAlumnoMock } from './helpers/auth.helper';
const user = (id = 140) => ({
  id,
  email: `alumno${id}@example.test`,
  nombre: id === 140 ? 'Diego' : 'Laura',
  apellidos: 'Prueba',
  rol: 'ALUMNO',
  validated: true,
  esTutor: false,
  authSource: 'LOCAL',
  woocommerceCustomerId: null,
  suscripciones: [
    {
      id: 11,
      usuarioId: id,
      tipo: 'ADVANCED',
      fechaInicio: '2026-10-01T12:00:00Z',
      monthlyPrice: 69.9,
      oposicion: 'ALICANTE_CPBA',
      status: 'ACTIVE',
      fuenteGestion: 'EXTERNA',
      woocommerceSubscriptionId: null,
      fechaFin: null,
    },
  ],
  consumibles: [],
  labels: [],
  tipoOposicion: ['ALICANTE_CPBA'],
  nivelOposicion: 'PRINCIPIANTE',
});
const ficha = (id = 140) => ({
  usuario: user(id),
  cursos: [],
  gestion: {
    tipo: 'EXTERNA',
    comprobadaEn: new Date().toISOString(),
    motivo: null as string | null,
    capacidades: {
      puedeDarBajaExterna: true,
      puedeEliminar: true,
      puedeGestionarWoo: false,
      suscripcionesExternas: [11],
    },
  },
  resumenEliminacion: {
    suscripciones: 1,
    cursos: 0,
    progresos: 2,
    consumibles: 0,
    invitaciones: 0,
  },
  consultadoEn: new Date().toISOString(),
});
const woo = {
  customerId: 90,
  consultadoEn: new Date().toISOString(),
  operaciones: [],
  suscripciones: [
    {
      id: 99,
      status: 'active',
      metodo: 'Redsys',
      fechaSiguientePago: '2026-12-10T12:00:00',
      fechaFin: null,
      discrepancia: false,
      puedeCancelarAhora: true,
      puedeCancelarFinPeriodo: true,
      locales: [
        {
          id: 11,
          tipo: 'ADVANCED',
          oposicion: 'ALICANTE_CPBA',
          status: 'ACTIVE',
          fechaFin: null,
        },
      ],
      renovaciones: [
        {
          id: 123,
          status: 'failed',
          pagado: false,
          importeCentimos: 7990,
          moneda: 'EUR',
          tarjeta: 'Tarjeta •••• 1234',
          puedeReintentar: true,
        },
      ],
    },
  ],
};
async function setup(page: Page, autoasignacion = true) {
  await loginAsRoleMock(page, {
    rol: 'ADMIN',
    userFixture: admin,
    modulos: { PLANIFICACION: autoasignacion },
  });
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
  await page.route('**/user/admin/*', async (r) => {
    const path = new URL(r.request().url()).pathname;
    if (/\/user\/admin\/\d+$/.test(path))
      return r.fulfill({ json: ficha(Number(path.split('/').pop())) });
    return r.continue();
  });
  await page.route('**/user/all', (r) =>
    r.fulfill({
      json: { data: [user()], pagination: { skip: 0, take: 10, count: 1 } },
    }),
  );
  await page.route('**/labels', (r) => r.fulfill({ json: [] }));
  await page.route('**/user/obtain-avaliable-subscriptions', (r) =>
    r.fulfill({ json: [] }),
  );
  await page.route('**/user/planifications/*', (r) =>
    r.fulfill({
      json: [
        {
          planificacion: {
            id: 55,
            identificador: 'Plan de Diego',
            descripcion: 'Teoría',
          },
        },
      ],
    }),
  );
  await page.route('**/planificacion-fisica/**', (r) =>
    r.fulfill({ status: 503, json: { message: 'QA marcas no disponibles' } }),
  );
  await page.route('**/user/admin/*/actividad?*', (r) => {
    const p = Number(new URL(r.request().url()).searchParams.get('page') || 1);
    return r.fulfill({
      json: {
        items: [
          {
            id: 'op:' + p,
            tipo: 'ACTUALIZAR_DATOS',
            estado: 'COMPLETADA',
            actorId: 7,
            descripcion: 'Datos actualizados',
            createdAt: new Date().toISOString(),
          },
        ],
        total: 21,
        page: p,
        take: 20,
      },
    });
  });
  await page.route('**/user/admin/*/woocommerce', (r) =>
    r.fulfill({ json: woo }),
  );
}
for (const width of [390, 768, 1120, 1440])
  test(`ficha responsive y secciones reales a ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 940 });
    await setup(page);
    await page.goto('/app/test/user/140?tab=info&page=3');
    await expect(
      page.getByRole('heading', { name: 'Diego Prueba', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Formación y experiencia' }),
    ).toBeVisible();
    if (width <= 768)
      await page.getByTestId('ficha-mobile-section').selectOption('access');
    else
      await page.getByRole('tab', { name: 'Acceso y suscripciones' }).click();
    await expect(
      page.getByText('Membresía de la academia', { exact: true }),
    ).toBeVisible();
    const baja = page.getByTestId('admin-baja-externa');
    await expect(baja).toHaveClass(/p-button p-component/);
    await expect(baja).toHaveCSS('font-size', '16px');
    await expect(baja).toHaveCSS('padding', '8px 16px');
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    await page.screenshot({
      path: info.outputPath(`ficha-${width}.png`),
      fullPage: true,
    });
  });
test('el listado abre la ficha y conserva filtros al volver', async ({
  page,
}) => {
  await setup(page);
  await page.goto('/app/test/user?page=3&search=Diego');
  await page.locator('app-user-dashboard .identifier').first().click();
  await expect(page).toHaveURL(/\/user\/140\?/);
  await expect(page).toHaveURL(/search=Diego/);
  await page.getByRole('button', { name: 'Usuarios', exact: true }).click();
  await expect(page).toHaveURL(/\/test\/user\?/);
  await expect(page).toHaveURL(/search=Diego/);
});
test('editar usa alumno destino y cancelar descarta el borrador', async ({
  page,
}) => {
  await setup(page);
  const requests: any[] = [];
  await page.route('**/user/update/*', async (r) => {
    requests.push({ url: r.request().url(), body: r.request().postDataJSON() });
    return r.fulfill({ json: user() });
  });
  await page.goto('/app/test/user/140');
  await page.getByTestId('admin-edit-alumno').click();
  await page.getByTestId('admin-edit-nombre').fill('No guardar');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Volver', exact: true })
    .click();
  await page.getByTestId('admin-edit-alumno').click();
  await expect(page.getByTestId('admin-edit-nombre')).toHaveValue('Diego');
  await page.getByTestId('admin-edit-nombre').fill('Guardado');
  await page.getByTestId('admin-confirm-action').click();
  await expect(page.getByTestId('admin-operation-result')).toContainText(
    'actualizados',
  );
  expect(requests).toHaveLength(1);
  expect(requests[0].url).toMatch(/\/update\/140$/);
  expect(requests[0].body.nombre).toBe('Guardado');
});
test('Atrás descarta modal y no lo aplica al siguiente alumno', async ({
  page,
}) => {
  await setup(page);
  await page.goto('/app/test/user/140?tab=access');
  await page.getByRole('tab', { name: 'Información personal' }).click();
  await page.getByTestId('admin-edit-alumno').click();
  await page.getByTestId('admin-edit-nombre').fill('Obsoleto');
  await page.goBack();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(
    page.getByRole('tab', { name: 'Acceso y suscripciones' }),
  ).toHaveAttribute('aria-selected', 'true');
  await page.goto('/app/test/user/141');
  await expect(
    page.getByRole('heading', { name: 'Laura Prueba', exact: true }),
  ).toBeVisible();
  await page.getByTestId('admin-edit-alumno').click();
  await expect(page.getByTestId('admin-edit-nombre')).toHaveValue('Laura');
});
test('Atrás durante guardado espera una única operación y luego navega', async ({
  page,
}) => {
  await setup(page);
  let release!: () => void;
  let calls = 0;
  await page.route('**/user/update/140', async (r) => {
    calls++;
    await new Promise<void>((resolve) => (release = resolve));
    await r.fulfill({ json: user() });
  });
  await page.goto('/app/test/user/140?tab=access');
  await page.getByRole('tab', { name: 'Información personal' }).click();
  await page.getByTestId('admin-edit-alumno').click();
  await page.getByTestId('admin-edit-nombre').fill('Cambio');
  await page.getByTestId('admin-confirm-action').click();
  await expect.poll(() => calls).toBe(1);
  const back = page.goBack();
  await page.waitForTimeout(100);
  await expect(page.getByRole('dialog')).toBeVisible();
  release();
  await back;
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page).toHaveURL(/tab=access/);
  expect(calls).toBe(1);
});
test('etiquetas se guardan juntas y descartar no emite escrituras', async ({
  page,
}) => {
  await setup(page);
  const writes: any[] = [];
  await page.route('**/labels/users/140/labels', (r) => {
    writes.push(r.request().postDataJSON());
    return r.fulfill({ json: [] });
  });
  await page.goto('/app/test/user/140');
  await page.getByTestId('admin-etiquetas').click();
  await page.getByTestId('admin-label-key').fill('Grupo');
  await page.getByTestId('admin-label-value').fill('A');
  await page
    .getByRole('button', { name: 'Añadir etiqueta', exact: true })
    .click();
  expect(writes).toHaveLength(0);
  await page.getByTestId('admin-confirm-action').click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(writes).toHaveLength(1);
  expect(writes[0].crear).toEqual([{ key: 'Grupo', value: 'A' }]);
});
test('la planificación se conserva si falla el módulo de marcas', async ({
  page,
}) => {
  await setup(page);
  await page.goto('/app/test/user/140?tab=planning');
  await expect(page.getByText('Plan de Diego', { exact: true })).toBeVisible();
});
test('el paginador mantiene un destino de foco accesible al llegar al final', async ({
  page,
}) => {
  await setup(page);
  await page.goto('/app/test/user/140?tab=activity');
  await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
  await expect(page.locator('#actividad-paginacion')).toBeFocused();
  await expect(
    page.getByRole('button', { name: 'Siguiente', exact: true }),
  ).toBeDisabled();
});
test('Woo es lazy y un timeout no repite el cobro al verificar', async ({
  page,
}) => {
  await setup(page);
  const detalleWoo = ficha();
  detalleWoo.gestion.tipo = 'MIXTA' as any;
  detalleWoo.gestion.capacidades.puedeGestionarWoo = true;
  await page.route('**/user/admin/140', (r) => r.fulfill({ json: detalleWoo }));
  let reads = 0,
    writes = 0,
    queries = 0;
  let key = '';
  await page.route('**/user/admin/140/woocommerce', (r) => {
    reads++;
    return r.fulfill({ json: woo });
  });
  await page.route(
    '**/user/admin/140/woocommerce/renovaciones/123/reintentar',
    (r) => {
      writes++;
      key = r.request().headers()['idempotency-key'];
      return r.abort('timedout');
    },
  );
  await page.route('**/user/admin/140/operaciones/*', (r) => {
    queries++;
    return r.fulfill({
      json: {
        id: key,
        tipo: 'REINTENTAR_RENOVACION',
        estado: 'COMPLETADA',
        usuarioId: 140,
        suscripcionId: '99',
        pedidoId: '123',
        mensaje: 'Pago confirmado',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });
  });
  await page.goto('/app/test/user/140');
  expect(reads).toBe(0);
  await page.getByRole('tab', { name: 'WooCommerce', exact: true }).click();
  await page
    .getByRole('button', { name: 'Reintentar cobro', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toContainText('79,90');
  await expect(page.getByTestId('admin-confirm-action')).toBeDisabled();
  await page.getByRole('dialog').getByRole('checkbox').check();
  await page.getByTestId('admin-confirm-action').click();
  await expect(
    page.getByRole('button', { name: 'Verificar resultado' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Verificar resultado' }).click();
  await expect(page.getByTestId('admin-operation-result')).toContainText(
    'Pago confirmado',
  );
  expect(writes).toBe(1);
  expect(queries).toBe(1);
  expect(key).toMatch(/^[a-f0-9-]{36}$/);
});
test('ALUMNO no abre ficha administrativa', async ({ page }) => {
  await loginAsAlumnoMock(page);
  let reads = 0;
  await page.route('**/user/admin/*', (r) => {
    reads++;
    return r.fulfill({ json: ficha() });
  });
  await page.goto('/app/test/user/140');
  await expect(page).not.toHaveURL(/\/user\/140$/);
  expect(reads).toBe(0);
});

test('Perfil mantiene acceso a facturas y autoasignación real en el estado vacío', async ({
  page,
}) => {
  const { loginAsRoleMock } = await import('./helpers/auth.helper');
  const alumno = {
    ...user(1),
    suscripciones: user(1).suscripciones.map((s) => ({
      ...s,
      tipo: 'PREMIUM',
    })),
    email: 'alumno@test.com',
    onboardingCompletado: true,
    dni: '12345678Z',
  };
  await loginAsRoleMock(page, {
    rol: 'ALUMNO',
    email: alumno.email,
    userFixture: alumno,
  });
  let asignaciones = 0;
  await page.route('**/user/profile', (r) => r.fulfill({ json: alumno }));
  await page.route('**/user/me/planificaciones', (r) =>
    r.fulfill({
      json: asignaciones
        ? [{ planificacion: { id: 55, identificador: 'Plan autoasignado' } }]
        : [],
    }),
  );
  await page.route('**/cursos/mios', (r) => r.fulfill({ json: [] }));
  await page.route('**/planificaciones/**', (r) => {
    if (r.request().method() === 'POST') {
      asignaciones++;
      return r.fulfill({ json: {} });
    }
    return r.fulfill({ json: { count: 0 } });
  });
  await page.route('**/facturas/**', (r) => r.fulfill({ json: [] }));
  await page.route('**/api/app-config/modulos', (r) =>
    r.fulfill({
      json: {
        PLANIFICACION: true,
        CURSOS: true,
      },
    }),
  );
  await page.goto('/app/profile');
  await page.reload();
  await page.getByTestId('profile-facturas').click();
  await expect(
    page.getByRole('dialog', { name: /Mis facturas/i }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await page
    .getByRole('button', { name: 'Gestionar mi planificación' })
    .click();
  await expect(page).toHaveURL(/configuracion-alumno/);
  expect(asignaciones).toBe(0);
});

test('administración recupera logos, fechas y eliminación de un registro externo con confirmación', async ({
  page,
}) => {
  await setup(page);
  const data = ficha();
  data.usuario.suscripciones[0].status = 'CANCELLED';
  await page.route('**/user/admin/140', (r) => r.fulfill({ json: data }));
  let writes = 0;
  await page.route('**/user/subscription/140/11', (r) => {
    writes++;
    expect(r.request().method()).toBe('DELETE');
    return r.fulfill({ json: {} });
  });
  await page.goto('/app/test/user/140?tab=access');
  const card = page.getByTestId('alumno-suscripciones');
  await expect(card.locator('app-oposicion-identidad img')).toHaveAttribute(
    'src',
    'oposiciones/alicante.png',
  );
  await expect
    .poll(() =>
      card
        .locator('app-oposicion-identidad img')
        .evaluate((e: HTMLImageElement) => e.naturalWidth),
    )
    .toBeGreaterThan(0);
  await expect(card).toContainText('Desde 1 oct 2026');
  await card.getByRole('button', { name: /Acciones del plan/ }).click();
  await page
    .getByRole('menuitem', { name: 'Eliminar registro', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toContainText('permanentemente');
  expect(writes).toBe(0);
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Volver', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(writes).toBe(0);
  await card.getByRole('button', { name: /Acciones del plan/ }).click();
  await page
    .getByRole('menuitem', { name: 'Eliminar registro', exact: true })
    .click();
  await page.getByTestId('admin-confirm-action').click();
  await expect(page.getByTestId('admin-operation-result')).toContainText(
    'eliminado',
  );
  expect(writes).toBe(1);
});

test('la ficha Woo no muestra eliminación local de su plan', async ({
  page,
}) => {
  await setup(page);
  const data = ficha();
  data.gestion = {
    ...data.gestion,
    tipo: 'WOOCOMMERCE',
    capacidades: {
      ...data.gestion.capacidades,
      suscripcionesExternas: [],
      puedeDarBajaExterna: false,
    },
  } as any;
  await page.route('**/user/admin/140', (r) => r.fulfill({ json: data }));
  await page.goto('/app/test/user/140?tab=access');
  await expect(
    page
      .getByTestId('alumno-suscripciones')
      .getByRole('button', { name: 'Eliminar registro', exact: true }),
  ).toHaveCount(0);
  await page
    .getByTestId('alumno-suscripciones')
    .getByRole('button', { name: /Acciones del plan/ })
    .click();
  await expect(
    page.getByRole('menuitem', { name: 'Eliminar registro', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('menuitem', { name: 'Editar plan', exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole('menuitem', { name: 'Ver WooCommerce', exact: true })
    .click();
  await expect(page).toHaveURL(/tab=woo/);
});

for (const accion of ['Recomendar nivel', 'Cambiar planificación']) {
  test(`producción no ofrece ${accion} sin contrato administrativo de planificación`, async ({ page }) => {
    await setup(page);
    const requests: string[] = [];
    await page.route('**/planificaciones/tutor/**', r => {
      requests.push(r.request().url());
      return r.fulfill({ status: 404, json: {} });
    });
    await page.goto('/app/test/user/140?tab=planning');
    await expect(page.getByRole('heading', { name: 'Planificaciones asignadas', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: accion, exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Ver planificación / })).toBeVisible();
    expect(requests).toEqual([]);
  });
}

test('autoasignación desactivada oculta las acciones y no consulta su configuración', async ({
  page,
}) => {
  await setup(page, false);
  let reads = 0;
  await page.route('**/planificaciones/admin/alumnos/*/configuracion', (r) => {
    reads++;
    return r.fulfill({ json: {} });
  });
  await page.goto('/app/test/user/140?tab=planning');
  await expect(
    page.getByRole('heading', {
      name: 'Planificaciones asignadas',
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Recomendar nivel', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Cambiar planificación', exact: true }),
  ).toHaveCount(0);
  expect(reads).toBe(0);
});

test('el escudo de planificación corresponde al plan y no a la suscripción del alumno', async ({
  page,
}) => {
  await setup(page);
  await page.route('**/user/planifications/*', (r) =>
    r.fulfill({
      json: [
        {
          planificacion: {
            id: 55,
            identificador: 'Plan Madrid',
            relevancia: ['MADRID'],
            subBloques: [],
          },
        },
      ],
    }),
  );
  await page.goto('/app/test/user/140?tab=planning');
  const plan = page.locator('.ficha-assignment');
  await expect(plan.locator('app-oposicion-identidad img')).toHaveAttribute(
    'src',
    'oposiciones/madrid.png',
  );
  await page.route('**/user/planifications/*', (r) =>
    r.fulfill({
      json: [
        {
          planificacion: {
            id: 55,
            identificador: 'Plan sin relevancia',
            subBloques: [],
          },
        },
      ],
    }),
  );
  await page.reload();
  await expect(plan).toContainText('Plan sin relevancia');
  await expect(plan.locator('img')).toHaveCount(0);
  await expect(plan.locator('.pi-calendar')).toBeVisible();
  await expect(
    plan.getByRole('button', { name: /^Ver planificación/ }),
  ).toBeVisible();
});

for (const closeWith of ['X', 'Escape'] as const)
  test(`cerrar edición con ${closeWith} descarta el borrador sin guardar`, async ({
    page,
  }) => {
    await setup(page);
    let writes = 0;
    await page.route('**/user/update/140', (r) => {
      writes++;
      return r.fulfill({ json: user() });
    });
    await page.goto('/app/test/user/140');
    await page.getByTestId('admin-edit-alumno').click();
    const dialog = page.getByRole('dialog');
    await page.getByTestId('admin-edit-nombre').fill('Sin guardar');
    if (closeWith === 'X')
      await dialog.locator('.p-dialog-header-close').click();
    else await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    expect(writes).toBe(0);
    await page.getByTestId('admin-edit-alumno').click();
    await expect(page.getByTestId('admin-edit-nombre')).toHaveValue('Diego');
  });

test('nombre del lateral legible y pestañas con subrayado recto', async ({
  page,
}) => {
  await setup(page);
  await page.goto('/app/test/user/140');
  await page.locator('.lateral-bar').hover();
  const name = page.locator('.perfil-nombre');
  await expect(name).toBeVisible();
  await expect(name).toHaveCSS('color', 'rgb(255, 255, 255)');
  await expect(name).toHaveCSS('font-size', '16px');
  await expect(
    page.getByRole('tab', { name: 'Información personal', exact: true }),
  ).toHaveCSS('border-radius', '0px');
});

for (const tipo of [
  'EXTERNA',
  'WOOCOMMERCE',
  'MIXTA',
  'POR_VERIFICAR',
] as const)
  test(`WooCommerce corresponde a gestión ${tipo} y normaliza acceso directo`, async ({
    page,
  }) => {
    await setup(page);
    const data = ficha();
    data.gestion.tipo = tipo as any;
    // Un cliente o historial antiguo puede conservar esta capacidad incluso
    // cuando la gestión está verificada como externa o sigue pendiente.
    data.gestion.capacidades.puedeGestionarWoo = true;
    data.gestion.motivo =
      tipo === 'POR_VERIFICAR' ? 'Origen pendiente de verificar' : null;
    await page.route('**/user/admin/140', (r) => r.fulfill({ json: data }));
    let reads = 0;
    await page.route('**/user/admin/140/woocommerce', (r) => {
      reads++;
      return r.fulfill({ json: woo });
    });
    await page.goto('/app/test/user/140?tab=woo&page=3&search=Diego');
    if (tipo === 'EXTERNA' || tipo === 'POR_VERIFICAR') {
      await expect(
        page.getByRole('tab', { name: 'WooCommerce', exact: true }),
      ).toHaveCount(0);
      await expect(page).toHaveURL(/tab=access/);
      await expect(page).toHaveURL(/search=Diego/);
      expect(reads).toBe(0);
      if (tipo === 'POR_VERIFICAR')
        await expect(
          page.getByText('Origen pendiente de verificar'),
        ).toBeVisible();
      await page.setViewportSize({ width: 390, height: 844 });
      await expect(
        page.getByTestId('ficha-mobile-section').locator('option[value="woo"]'),
      ).toHaveCount(0);
    } else {
      await expect(
        page.getByRole('tab', { name: 'WooCommerce', exact: true }),
      ).toBeVisible();
      await expect.poll(() => reads).toBe(1);
    }
  });

for (const width of [1440, 390])
  test(`resumen expandible conserva fila, caché y ficha a ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 940 });
    await setup(page);
    let reads = 0;
    await page.route('**/user/planifications/140', (r) => {
      reads++;
      return r.fulfill({
        json: [
          {
            planificacion: {
              id: 55,
              identificador: 'Plan de Diego',
              descripcion: 'Teoría',
            },
          },
        ],
      });
    });
    await page.goto('/app/test/user?page=3&search=Diego');
    await expect(
      page.getByRole('button', { name: 'Ver ficha', exact: true }),
    ).toHaveCount(0);
    const expand = page.getByTestId('user-expand').first();
    await expand.click();
    const panel = page.getByTestId('user-quickview-140');
    await expect(panel).toBeVisible();
    await expect(panel).toContainText('Plan de Diego');
    await expect(
      panel.getByRole('tab', { name: /Información Personal$/ }),
    ).toBeVisible();
    await panel.getByRole('tab', { name: /Marcas físicas$/ }).click();
    await expect(panel.getByRole('alert')).toContainText(
      'No se pudieron cargar las marcas',
    );
    await expect(page).toHaveURL(/\/test\/user\?/);
    await panel.getByRole('tab', { name: /Información Personal$/ }).click();
    await panel.getByRole('tab', { name: /Datos Personales$/ }).click();
    await expect(panel).toContainText('DNI:');
    for (const tab of ['Formación', 'Objetivos', 'Academia', 'Comentarios'])
      await expect(
        panel.getByRole('tab', { name: new RegExp(tab + '$') }),
      ).toBeVisible();
    await expect(page).toHaveURL(/\/test\/user\?/);
    await expand.click();
    await expect(panel).toHaveCount(0);
    await expand.click();
    await expect(panel).toBeVisible();
    expect(reads).toBe(1);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath(`alumnos-resumen-${width}.png`),
      fullPage: true,
    });
    await page.locator('app-user-dashboard .identifier').first().click();
    await expect(page).toHaveURL(/\/user\/140\?/);
    await expect(page).toHaveURL(/search=Diego/);
  });

test('abrir planificación queda alineado con su identidad', async ({
  page,
}) => {
  await setup(page);
  await page.goto('/app/test/user/140?tab=planning');
  const row = page.locator('.ficha-assignment').first();
  const name = row.getByRole('heading', { name: 'Plan de Diego', exact: true });
  const button = row.getByRole('button', {
    name: 'Ver planificación Plan de Diego',
    exact: true,
  });
  await expect(button).toBeVisible();
  const a = await name.boundingBox(),
    b = await button.boundingBox();
  expect(Math.abs(a!.y - b!.y)).toBeLessThan(20);
  expect(b!.x).toBeGreaterThan(a!.x);
});

test('selección de alumno en factura conserva checkbox y oculta expansión', async ({
  page,
}) => {
  await setup(page);
  await page.route('**/admin/facturas**', (r) =>
    r.fulfill({
      json: {
        facturas: [],
        total: 0,
        pagina: 1,
        porPagina: 10,
        totalPaginas: 0,
      },
    }),
  );
  await page.goto('/app/facturacion');
  await page.getByRole('button', { name: /Nueva factura/ }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId('user-expand')).toHaveCount(0);
  const checkbox = dialog.getByRole('checkbox').first();
  await dialog.locator('.p-checkbox-box').first().click();
  await expect(checkbox).toBeChecked();
  await expect(
    dialog.getByRole('button', { name: /Confirmar selección/ }),
  ).toBeEnabled();
  await expect(dialog.locator('.user-quickview')).toHaveCount(0);
  await expect(page).toHaveURL(/\/app\/facturacion/);
});

test('resumen permite reintentar una lectura fallida sin abrir la ficha', async ({
  page,
}) => {
  await setup(page);
  let reads = 0;
  await page.route('**/user/planifications/140', (r) => {
    reads++;
    return r.fulfill(
      reads === 1
        ? { status: 503, json: { message: 'QA' } }
        : {
            json: [
              { planificacion: { id: 55, identificador: 'Plan recuperado' } },
            ],
          },
    );
  });
  await page.goto('/app/test/user');
  await page.getByTestId('user-expand').first().click();
  const panel = page.getByTestId('user-quickview-140');
  await expect(
    panel.getByRole('button', { name: 'Reintentar planificaciones' }),
  ).toBeVisible();
  await panel
    .getByRole('button', { name: 'Reintentar planificaciones' })
    .click();
  await expect(panel).toContainText('Plan recuperado');
  expect(reads).toBe(2);
  await expect(page).toHaveURL(/\/test\/user$/);
});

test('resumen original reintenta marcas y conserva el historial completo', async ({
  page,
}) => {
  await setup(page);
  let reads = 0;
  const marcas = [
    {
      id: 1,
      pruebaFisicaId: 1,
      pruebaNombre: 'Carrera antigua',
      fecha: '2026-01-03',
      valor: 100,
      unidad: 's',
    },
    {
      id: 2,
      pruebaFisicaId: 1,
      pruebaNombre: 'Carrera anterior',
      fecha: '2026-01-02',
      valor: 101,
      unidad: 's',
    },
    {
      id: 3,
      pruebaFisicaId: 1,
      pruebaNombre: 'Carrera inicial',
      fecha: '2026-01-01',
      valor: 102,
      unidad: 's',
    },
    {
      id: 4,
      pruebaFisicaId: 2,
      pruebaNombre: 'Press reciente',
      fecha: '2026-11-11',
      valor: 20,
      unidad: 'kg',
    },
    {
      id: 5,
      pruebaFisicaId: 3,
      pruebaNombre: 'Natación reciente',
      fecha: '2026-11-10',
      valor: 30,
      unidad: 's',
    },
  ];
  await page.route('**/planificacion-fisica/marcas/alumno/140', (r) => {
    reads++;
    return r.fulfill(
      reads === 1 ? { status: 503, json: { message: 'QA' } } : { json: marcas },
    );
  });
  await page.goto('/app/test/user');
  await page.getByTestId('user-expand').first().click();
  const panel = page.getByTestId('user-quickview-140');
  await panel.getByRole('tab', { name: /Marcas físicas$/ }).click();
  await panel
    .getByRole('button', { name: 'Reintentar marcas', exact: true })
    .click();
  const section = panel.locator('.marcas-content');
  await expect(section.locator('.marca-card')).toHaveCount(5);
  await expect(section).toContainText('Press reciente');
  await expect(section).toContainText('Carrera inicial');
  await expect(page).toHaveURL(/\/test\/user$/);
  await page.getByTestId('user-expand').first().click();
  await page.getByTestId('user-expand').first().click();
  await panel.getByRole('tab', { name: /Marcas físicas$/ }).click();
  await expect(section.locator('.marca-card')).toHaveCount(5);
  expect(reads).toBe(2);
});

for (const width of [1440, 390])
  test(`menús compactos de suscripción conservan alumno, plan y teclado a ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 940 });
    await setup(page);
    const data = ficha();
    data.usuario.suscripciones.push({
      ...data.usuario.suscripciones[0],
      id: 12,
      oposicion: 'MADRID',
    });
    data.gestion.capacidades.suscripcionesExternas = [11, 12];
    await page.route('**/user/admin/140', (r) => r.fulfill({ json: data }));
    let writes = 0;
    await page.route('**/user/subscription/**', (r) => {
      writes++;
      return r.fulfill({ json: {} });
    });
    await page.goto('/app/test/user/140?tab=access');
    const card = page.getByTestId('alumno-suscripciones');
    const triggers = card.getByRole('button', { name: /Acciones del plan/ });
    await expect(triggers).toHaveCount(2);
    await expect(
      card.getByRole('button', { name: 'Editar plan', exact: true }),
    ).toHaveCount(0);
    for (const trigger of await triggers.all()) {
      await expect(trigger.locator('.pi-ellipsis-v')).toBeVisible();
      const box = await trigger.boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(36);
      expect(box!.height).toBeGreaterThanOrEqual(36);
    }
    await card.screenshot({
      path: info.outputPath(`suscripciones-compactas-${width}.png`),
    });
    const madrid = card.getByRole('button', {
      name: 'Acciones del plan Madrid · Avanzado',
      exact: true,
    });
    await madrid.focus();
    await page.keyboard.press('Enter');
    const menuId = await madrid.getAttribute('aria-controls');
    const menu = page.locator(`[id="${menuId}"]`).getByRole('menu');
    await expect(menu).toBeVisible();
    await expect(madrid).toHaveAttribute('aria-expanded', 'true');
    await expect(menu.getByRole('menuitem')).toHaveText([
      'Editar plan',
      'Cancelar este plan',
      'Eliminar registro',
    ]);
    const box = await menu.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    await page.screenshot({
      path: info.outputPath(`menu-suscripcion-${width}.png`),
      fullPage: true,
    });
    await page.keyboard.press('Escape');
    await expect(menu).not.toBeVisible();
    await expect(madrid).toBeFocused();
    await expect(madrid).toHaveAttribute('aria-expanded', 'false');
    await madrid.click();
    await page
      .getByRole('heading', { name: 'Suscripciones del alumno', exact: true })
      .click();
    await expect(menu).not.toBeVisible();
    await madrid.click();
    await page
      .getByRole('menuitem', { name: 'Editar plan', exact: true })
      .click();
    await expect(
      page
        .getByRole('dialog')
        .getByRole('combobox', { name: 'Oposición', exact: true }),
    ).toHaveValue('MADRID');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await madrid.click();
    await page
      .getByRole('menuitem', { name: 'Cancelar este plan', exact: true })
      .click();
    await expect(page.getByRole('dialog')).toContainText('Madrid');
    await expect(page.getByRole('dialog')).not.toContainText('CPBA Alicante');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(writes).toBe(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });

test('menú conserva cancelación deshabilitada para un plan inactivo', async ({
  page,
}) => {
  await setup(page);
  const data = ficha();
  data.usuario.suscripciones[0].status = 'CANCELLED';
  await page.route('**/user/admin/140', (r) => r.fulfill({ json: data }));
  await page.goto('/app/test/user/140?tab=access');
  await page
    .getByTestId('alumno-suscripciones')
    .getByRole('button', { name: /Acciones del plan/ })
    .click();
  await expect(
    page.getByRole('menuitem', { name: 'Cancelar este plan', exact: true }),
  ).toHaveAttribute('aria-disabled', 'true');
  await expect(
    page.getByRole('menuitem', { name: 'Reactivar plan', exact: true }),
  ).not.toHaveAttribute('aria-disabled', 'true');
  await expect(
    page.getByRole('menuitem', { name: 'Eliminar registro', exact: true }),
  ).not.toHaveAttribute('aria-disabled', 'true');
});

test('desvincular planificación pasa al menú conservando confirmación y permiso', async ({
  page,
}) => {
  await setup(page);
  let puedeDesvincular = true;
  await page.route('**/user/admin/140', (r) =>
    r.fulfill({
      json: {
        ...ficha(),
        accionesPlanificacion: { puedeDesvincular },
      },
    }),
  );
  await page.goto('/app/test/user/140?tab=planning');
  const row = page.locator('.ficha-assignment').first();
  await expect(
    row.getByRole('button', { name: 'Desvincular', exact: true }),
  ).toHaveCount(0);
  await expect(
    row.getByRole('button', {
      name: 'Ver planificación Plan de Diego',
      exact: true,
    }),
  ).toBeVisible();
  await row
    .getByRole('button', {
      name: 'Acciones de planificación Plan de Diego',
      exact: true,
    })
    .click();
  await page
    .getByRole('menuitem', { name: 'Desvincular', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toContainText(
    'La planificación compartida y sus otros alumnos se conservan.',
  );
  await page.keyboard.press('Escape');
  puedeDesvincular = false;
  await page.reload();
  await expect(
    page.getByRole('button', { name: /Acciones de planificación/ }),
  ).toHaveCount(0);
});
