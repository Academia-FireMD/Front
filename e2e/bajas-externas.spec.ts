/**
 * E2E — Baja TOTAL de membresía externa + continuidad de alumnos con cursos.
 *
 * Cubre el contrato aprobado (2026-11-01):
 *  - Solo cuentas exclusivamente EXTERNA ven la baja total.
 *  - La confirmación enumera las suscripciones vigentes (ACTIVE/PENDING_CANCEL
 *    con fecha nula/futura) e identifica al alumno.
 *  - El resultado usa totalCanceladas/cursosConservados del servidor, incluido
 *    el no-op idempotente y el 409 GESTION_EXTERNA_REQUERIDA.
 *  - Un 403 SUSCRIPCION_REQUERIDA recarga el perfil y lleva a /app/profile sin
 *    cerrar sesión.
 *  - Un alumno solo-curso (sin suscripciones ni oposiciones) mantiene el
 *    listado y la apertura de sus cursos.
 *
 * Todo se mockea en local; no se usan credenciales ni servicios reales.
 */
import { expect, test, type Page, type Request } from '@playwright/test';
import cursoDetailFixture from './fixtures/curso-detail.json';
import userAdminFixture from './fixtures/user-admin.json';
import { loginAsAdminMock, loginAsRoleMock } from './helpers/auth.helper';

const FUTURO = '2030-01-15T00:00:00.000Z';

function suscripcion(
  id: number,
  oposicion: string,
  tipo: string,
  status: string,
  extra: Record<string, unknown> = {},
) {
  return {
    id,
    usuarioId: 140,
    tipo,
    oposicion,
    status,
    fechaInicio: '2025-01-01T00:00:00.000Z',
    fechaFin: status === 'PENDING_CANCEL' ? FUTURO : null,
    cancelacionProgramada: status === 'PENDING_CANCEL' ? FUTURO : null,
    woocommerceSubscriptionId: null,
    fuenteGestion: 'EXTERNA',
    isOfferPlan: false,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...extra,
  };
}

const usuarioExterno = {
  id: 140,
  email: 'externa@test.com',
  nombre: 'Lucía',
  apellidos: 'Externa',
  rol: 'ALUMNO',
  validated: false,
  esTutor: false,
  authSource: 'LOCAL',
  wordpressAutoLinkBlocked: true,
  woocommerceCustomerId: null,
  createdAt: '2024-06-01T00:00:00Z',
  updatedAt: '2024-06-01T00:00:00Z',
  suscripciones: [
    suscripcion(701, 'VALENCIA_AYUNTAMIENTO', 'PREMIUM', 'ACTIVE'),
    suscripcion(702, 'ALICANTE_CPBA', 'ADVANCED', 'PENDING_CANCEL'),
    // Reserva sin cobro: no es membresía y no debe aparecer en la confirmación.
    suscripcion(703, 'MADRID', 'BASIC', 'PENDING_PAYMENT', {
      fechaFin: null,
      cancelacionProgramada: null,
    }),
  ],
  consumibles: [],
  labels: [],
};

const usuarioMixtoWordPress = {
  ...usuarioExterno,
  id: 141,
  email: 'mixta@test.com',
  nombre: 'Marta',
  apellidos: 'Mixta',
  authSource: 'WORDPRESS',
  woocommerceCustomerId: 987,
  suscripciones: [
    suscripcion(711, 'VALENCIA_AYUNTAMIENTO', 'PREMIUM', 'ACTIVE', {
      fuenteGestion: 'WOOCOMMERCE',
      woocommerceSubscriptionId: '999_abc',
    }),
    suscripcion(712, 'ALICANTE_CPBA', 'ADVANCED', 'ACTIVE'),
  ],
};

const usuarioSoloCursos = {
  ...usuarioExterno,
  id: 142,
  email: 'cursos@test.com',
  nombre: 'Carla',
  apellidos: 'Cursos',
  validated: false,
  authSource: 'LOCAL',
  woocommerceCustomerId: null,
  suscripciones: [],
  oposiciones: [],
  consumibles: [],
};

function esXhr(request: Request): boolean {
  const tipo = request.resourceType();
  return tipo === 'xhr' || tipo === 'fetch';
}

async function stubsAdminDashboard(
  page: Page,
  usuarios: () => any[],
): Promise<void> {
  await page.route('**/user/admin/*', (route) => {
    const id = Number(new URL(route.request().url()).pathname.split('/').pop());
    const usuario = usuarios().find((u) => u.id === id);
    if (!usuario)
      return route.fulfill({
        status: 404,
        json: { message: 'Alumno no encontrado' },
      });
    const externa =
      usuario.authSource !== 'WORDPRESS' &&
      !usuario.woocommerceCustomerId &&
      usuario.suscripciones.every((s: any) => s.fuenteGestion === 'EXTERNA');
    return route.fulfill({
      json: {
        usuario,
        cursos: [],
        gestion: {
          tipo: externa ? 'EXTERNA' : 'MIXTA',
          comprobadaEn: new Date().toISOString(),
          motivo: null,
          capacidades: {
            puedeDarBajaExterna: externa,
            puedeEliminar: externa,
            puedeGestionarWoo: !externa,
            suscripcionesExternas: usuario.suscripciones
              .filter((s: any) => s.fuenteGestion === 'EXTERNA')
              .map((s: any) => s.id),
          },
        },
        resumenEliminacion: {
          suscripciones: usuario.suscripciones.length,
          cursos: 0,
          progresos: 0,
          consumibles: 0,
          invitaciones: 0,
        },
        consultadoEn: new Date().toISOString(),
      },
    });
  });
  await page.route('**/user/admin/*/accesos', (route) =>
    route.fulfill({
      json: {
        capacidades: {},
        cursos: [],
        simulacros: [],
        tutorias: { invitaciones: [], creditos: [], reservas: [], compras: [] },
      },
    }),
  );
}
async function abrirBajaDesdeFicha(page: Page, id = 140): Promise<void> {
  await page.goto(`/app/test/user/${id}?tab=access`);
  await page.getByTestId('admin-baja-externa').click();
  await expect(
    page.getByRole('dialog', {
      name: 'Dar de baja la membresía externa',
      exact: true,
    }),
  ).toBeVisible();
}

test.describe('Admin — baja total de membresía externa', () => {
  test('confirma las 2 suscripciones vigentes, envía motivo y muestra el resultado del servidor', async ({
    page,
  }) => {
    let cancelado = false,
      payload: unknown = null,
      llamadas = 0;
    const usuarios = () => [
      {
        ...usuarioExterno,
        suscripciones: usuarioExterno.suscripciones.map((s) =>
          cancelado && [701, 702].includes(s.id)
            ? { ...s, status: 'CANCELLED' }
            : s,
        ),
      },
    ];
    await loginAsAdminMock(page, userAdminFixture);
    await stubsAdminDashboard(page, usuarios);
    await page.route('**/user/cancel-all-subscriptions/140', (route) => {
      llamadas++;
      payload = route.request().postDataJSON();
      cancelado = true;
      return route.fulfill({
        status: 201,
        json: {
          usuarioId: 140,
          canceladas: [701, 702],
          totalCanceladas: 2,
          yaEstabaDeBaja: false,
          cursosConservados: 3,
        },
      });
    });
    await abrirBajaDesdeFicha(page);
    const dialogo = page.getByRole('dialog', {
      name: 'Dar de baja la membresía externa',
      exact: true,
    });
    await expect(dialogo).toContainText('Lucía Externa');
    await expect(dialogo).toContainText('externa@test.com');
    await expect(dialogo).toContainText(
      'Se cancelarán 2 suscripciones vigentes',
    );
    await expect(dialogo).toContainText('Premium · Valencia Ayuntamiento');
    await expect(dialogo).toContainText('Baja programada');
    await expect(dialogo).toContainText('15/1/2030');
    await expect(dialogo).not.toContainText('Madrid');
    await expect(dialogo).toContainText(
      'Los cursos independientes, consumibles, créditos emitidos, reservas y progreso se conservan',
    );
    await expect(dialogo).toContainText('La cuenta mantiene su acceso local');
    await dialogo
      .getByLabel('Motivo (opcional)')
      .fill('Solicitud telefónica del alumno');
    await page.getByTestId('admin-confirm-action').click();
    const resultado = page.getByTestId('admin-operation-result');
    await expect(resultado).toContainText('Membresía externa dada de baja');
    await expect(resultado).toContainText('2 suscripciones canceladas');
    await expect(resultado).toContainText('Se conservaron 3 cursos');
    expect(payload).toEqual({ motivo: 'Solicitud telefónica del alumno' });
    expect(llamadas).toBe(1);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
  test('no ofrece la baja total en una cuenta WordPress/mixta', async ({
    page,
  }) => {
    await loginAsAdminMock(page, userAdminFixture);
    await stubsAdminDashboard(page, () => [
      usuarioMixtoWordPress,
      usuarioExterno,
    ]);
    await page.goto('/app/test/user/141?tab=access');
    await expect(
      page.getByRole('heading', { name: 'Marta Mixta', exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId('admin-baja-externa')).toHaveCount(0);
    await expect(page.getByTestId('ficha-tab-woo')).toBeVisible();
    await page.goto('/app/test/user/140?tab=access');
    await expect(page.getByTestId('admin-baja-externa')).toBeVisible();
  });
  test('no-op idempotente: informa que ya estaba de baja y conserva cursos', async ({
    page,
  }) => {
    await loginAsAdminMock(page, userAdminFixture);
    await stubsAdminDashboard(page, () => [usuarioExterno]);
    await page.route('**/user/cancel-all-subscriptions/140', (route) =>
      route.fulfill({
        status: 201,
        json: {
          usuarioId: 140,
          canceladas: [],
          totalCanceladas: 0,
          yaEstabaDeBaja: true,
          cursosConservados: 2,
        },
      }),
    );
    await abrirBajaDesdeFicha(page);
    await page.getByTestId('admin-confirm-action').click();
    const resultado = page.getByTestId('admin-operation-result');
    await expect(resultado).toContainText(
      'La membresía externa ya estaba de baja',
    );
    await expect(resultado).toContainText('No se canceló ninguna suscripción');
    await expect(resultado).toContainText('Se conservaron 2 cursos');
    await expect(page.locator('.ficha-form-error')).toHaveCount(0);
  });
  test('409 GESTION_EXTERNA_REQUERIDA: no muestra éxito y explica que no se modificó nada', async ({
    page,
  }) => {
    await loginAsAdminMock(page, userAdminFixture);
    await stubsAdminDashboard(page, () => [usuarioExterno]);
    await page.route('**/user/cancel-all-subscriptions/140', (route) =>
      route.fulfill({
        status: 409,
        json: {
          reason: 'GESTION_EXTERNA_REQUERIDA',
          message: 'La cuenta no es exclusivamente externa',
        },
      }),
    );
    await abrirBajaDesdeFicha(page);
    await page.getByTestId('admin-confirm-action').click();
    const error = page.getByRole('dialog').getByRole('alert');
    await expect(error).toContainText('exclusivamente externa');
    await expect(error).toContainText('No se ha modificado nada');
    await expect(page.getByTestId('admin-operation-result')).toHaveCount(0);
  });
  test('la cancelación individual avisa de que solo afecta a ese plan', async ({
    page,
  }) => {
    await loginAsAdminMock(page, userAdminFixture);
    await stubsAdminDashboard(page, () => [usuarioExterno]);
    await page.goto('/app/test/user/140?tab=access');
    const acciones = page
      .getByTestId('alumno-suscripciones')
      .getByRole('button', { name: /Acciones del plan/ })
      .first();
    await acciones.scrollIntoViewIfNeeded();
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    await acciones.click();
    await page
      .getByRole('menuitem', { name: 'Cancelar este plan', exact: true })
      .click();
    const confirmacion = page.getByRole('dialog');
    await expect(confirmacion).toContainText('solo el plan');
    await expect(confirmacion).toContainText('las demás suscripciones');
    await expect(confirmacion).not.toContainText('perderá el acceso');
  });
});

test.describe('Alumno — pérdida de membresía y cursos', () => {
  test('un 403 SUSCRIPCION_REQUERIDA recarga el perfil y mantiene la sesión', async ({
    page,
  }) => {
    await loginAsRoleMock(page, {
      rol: 'ALUMNO',
      email: 'cursos@test.com',
      userFixture: usuarioSoloCursos,
    });

    let perfilesCargados = 0;
    await page.route('**/user/profile', (route) => {
      perfilesCargados += 1;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(usuarioSoloCursos),
      });
    });
    await page.route('**/planificacion-fisica/**', (route) => {
      if (!esXhr(route.request())) return route.continue();
      return route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({
          reason: 'SUSCRIPCION_REQUERIDA',
          message: 'Tu membresía no está vigente',
        }),
      });
    });
    await page.route('**/cursos/mios', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      }),
    );

    perfilesCargados = 0;
    await page.goto('/app/planificacion-fisica');

    await expect(page).toHaveURL(/\/app\/profile/, { timeout: 15_000 });
    await expect(
      page.getByText('Tu membresía ya no está activa', { exact: false }),
    ).toBeVisible({ timeout: 10_000 });
    expect(perfilesCargados).toBeGreaterThanOrEqual(1);
    const token = await page.evaluate(() =>
      sessionStorage.getItem('authToken'),
    );
    expect(token).toBeTruthy();
    await expect(page).not.toHaveURL(/\/auth/);
  });

  test('un alumno solo-curso navega y abre sus cursos sin suscripción', async ({
    page,
  }) => {
    await loginAsRoleMock(page, {
      rol: 'ALUMNO',
      email: 'cursos@test.com',
      userFixture: usuarioSoloCursos,
    });

    await page.route('**/cursos/mios', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 1,
            cursoId: cursoDetailFixture.id,
            usuarioId: 142,
            curso: cursoDetailFixture,
            progreso: [],
            createdAt: new Date().toISOString(),
          },
        ]),
      }),
    );
    await page.route('**/cursos/curso-qa-test', (route) => {
      if (!esXhr(route.request())) return route.continue();
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          curso: cursoDetailFixture,
          tieneAcceso: true,
          progreso: [],
        }),
      });
    });
    await page.route('**/user/tutores', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      }),
    );

    await page.goto('/app/cursos');
    await expect(page.getByRole('heading', { name: 'Mis Cursos' })).toBeVisible(
      { timeout: 15_000 },
    );
    await expect(
      page.getByRole('heading', { name: 'Curso QA Test' }).first(),
    ).toBeVisible();

    await page
      .getByRole('button', { name: 'Curso QA Test', exact: true })
      .click();
    await expect(page).toHaveURL(/\/app\/cursos\/curso-qa-test/, {
      timeout: 10_000,
    });
  });
});
