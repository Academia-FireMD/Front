import { expect, test } from '@playwright/test';
import { join } from 'node:path';
import alumno from './fixtures/user-alumno.json';

const curso = {
  id: 31,
  cursoId: 31,
  usuarioId: 1,
  expiraEn: '2026-12-07T12:39:00.000Z',
  curso: {
    id: 31,
    titulo: 'Opositor de Élite nivel 1',
    slug: 'opositor-de-elite-nivel-1',
    estado: 'PUBLICADO',
    secciones: [],
  },
};

test('el alumno sin suscripción ve sus accesos compactos en escritorio y móvil', async ({
  page,
}) => {
  const usuario = {
    ...alumno,
    suscripciones: [],
    consumibles: [
      {
        id: 12,
        tipo: 'SIMULACRO',
        estado: 'ACTIVADO',
        sku: 'SIM-QA',
        examen: { id: 8, titulo: 'Simulacro de acceso' },
      },
    ],
  };
  const json = (body: unknown) => ({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });

  await page.route('**/api/app-config', (route) =>
    route.fulfill(
      json({
        appName: 'TécnikaFire',
        logoUrl: null,
        primaryColor: '#e64133',
        secondaryColor: '#1f2937',
        updatedAt: new Date().toISOString(),
      }),
    ),
  );
  await page.route('**/api/app-config/modulos', (route) =>
    route.fulfill(
      json({
        CURSOS: true,
        SIMULACROS: true,
        TEST: true,
        EXAMEN: true,
      }),
    ),
  );
  await page.route('**/user/get-by-email', (route) =>
    route.fulfill(json(usuario)),
  );
  await page.route('**/ai-assistant/token', (route) =>
    route.fulfill({ ...json({}), status: 403 }),
  );
  await page.route('**/user/profile', (route) => route.fulfill(json(usuario)));
  await page.route('**/cursos/mios', (route) => route.fulfill(json([curso])));
  await page.route('**/cursos/opositor-de-elite-nivel-1', (route) => {
    if (route.request().resourceType() === 'document') return route.continue();
    return route.fulfill(
      json({ curso: curso.curso, tieneAcceso: true, progreso: [] }),
    );
  });
  await page.route('**/planificaciones/configuracion', (route) =>
    route.fulfill(json(null)),
  );
  const payload = Buffer.from(
    JSON.stringify({
      rol: 'ALUMNO',
      email: usuario.email,
      sub: usuario.id,
      exp: 9_999_999_999,
    }),
  ).toString('base64');
  const token = `x.${payload}.x`;
  await page.route('**/auth/login', (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    return route.fulfill(json({ access_token: token, refresh_token: token }));
  });

  await page.goto('/auth/login');
  await page.locator('input[formControlName="email"]').fill(usuario.email);
  await page.locator('app-password-input input').fill('test1234');
  await page.locator('app-async-button button').first().click();
  await page.waitForURL('**/app/**');
  await page.goto('/app/profile');

  const card = page.getByTestId('profile-accesos-card');
  await expect(card).toBeVisible();
  await expect(card.getByText('Opositor de Élite nivel 1')).toBeVisible();
  await expect(card.getByRole('button', { name: /Ver curso/ })).toBeVisible();
  const screenshots = process.env['PROFILE_QA_SCREENSHOT_DIR'];
  if (screenshots)
    await card.screenshot({
      path: join(screenshots, 'mis-accesos-desktop.png'),
    });

  await card.getByRole('button', { name: /Simulacros/ }).click();
  await expect(card.getByText('Simulacro de acceso')).toBeVisible();
  await expect(card.getByRole('button', { name: 'Usar' })).toBeVisible();
  if (screenshots)
    await card.screenshot({
      path: join(screenshots, 'mis-accesos-simulacros.png'),
    });

  await page.setViewportSize({ width: 390, height: 844 });
  await card.getByRole('button', { name: /Cursos/ }).click();
  await expect(card.getByRole('button', { name: /Ver curso/ })).toBeVisible();
  if (screenshots)
    await card.screenshot({
      path: join(screenshots, 'mis-accesos-mobile.png'),
    });

  await card.getByRole('button', { name: /Ver curso/ }).click();
  await page.waitForURL('**/app/cursos/opositor-de-elite-nivel-1');

  const sinAccesos = { ...usuario, consumibles: [] };
  await page.route('**/user/get-by-email', (route) =>
    route.fulfill(json(sinAccesos)),
  );
  await page.route('**/user/profile', (route) =>
    route.fulfill(json(sinAccesos)),
  );
  await page.route('**/cursos/mios', (route) => route.fulfill(json([])));
  await page.goto('/app/profile');
  await expect(card.getByText('Aún no tienes acceso')).toBeVisible();
  await expect(card.locator('.accesos-tabs')).toHaveCount(0);
  if (screenshots)
    await card.screenshot({
      path: join(screenshots, 'mis-accesos-vacio.png'),
    });
});
