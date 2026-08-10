import { expect, test } from '@playwright/test';
import userAdminFixture from './fixtures/user-admin.json';
import { loginAsAdminMock } from './helpers/auth.helper';

const user = {
  id: 140,
  email: 'diego@test.com',
  nombre: 'Diego',
  apellidos: 'Sánchez',
  rol: 'ALUMNO',
  validated: true,
  esTutor: false,
  authSource: 'LOCAL',
  woocommerceCustomerId: null,
  wpUserId: null,
  cantidadPlanificaciones: 2,
  suscripciones: [],
  consumibles: [],
  labels: [],
};

test.describe('Admin — navegación desde la lista compacta de usuarios', () => {
  test('conserva filtros y paginación al abrir y volver de una ficha', async ({
    page,
  }) => {
    await loginAsAdminMock(page, userAdminFixture);
    let hasLabel = true;
    const matchingListRequests: unknown[] = [];
    await page.route('**/user/all', (route) => {
      const body = route.request().postDataJSON();
      const isExpectedRequest =
        body?.skip === 10 &&
        body?.take === 10 &&
        body?.where?.variasPlanificaciones === true;
      if (!isExpectedRequest) {
        return route.fulfill({ status: 422, body: '{}' });
      }
      matchingListRequests.push(body);
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [user],
          pagination: { skip: 10, take: 10, count: 11 },
        }),
      });
    });
    await page.route('**/user/admin/140', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...user,
          labels: hasLabel
            ? [
                {
                  labelId: 'label-1',
                  label: { id: 'label-1', key: 'cohorte', value: 'septiembre' },
                },
              ]
            : [],
        }),
      }),
    );
    await page.route('**/labels', (route) =>
      route.fulfill({
        status: 200,
        body: JSON.stringify([
          { id: 'label-1', key: 'cohorte', value: 'septiembre' },
        ]),
      }),
    );
    await page.route('**/labels/users/140/labels/label-1', (route) => {
      hasLabel = false;
      route.fulfill({ status: 200, body: '{}' });
    });
    await page.route('**/labels/users/140/labels', (route) => {
      expect(route.request().postDataJSON()).toEqual({ labelId: 'label-1' });
      hasLabel = true;
      route.fulfill({ status: 201, body: '[]' });
    });
    await page.route('**/user/planifications/140', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '[]',
      }),
    );
    await page.route('**/planificacion-fisica/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '[]',
      }),
    );

    await page.goto(
      '/app/test/user?variasPlanificaciones=varias&skip=10&take=10',
    );
    await expect(page.getByText('Diego Sánchez')).toBeVisible({
      timeout: 15_000,
    });
    await expect(page).toHaveURL(/variasPlanificaciones=varias/);
    await expect(page).toHaveURL(/skip=10/);

    await expect.poll(() => matchingListRequests.length).toBeGreaterThan(0);

    await page.getByText('Diego Sánchez').click();
    await page.waitForURL('**/app/test/user/140?**');
    await expect(page).toHaveURL(/variasPlanificaciones=varias/);
    await expect(page).toHaveURL(/skip=10/);

    await page.getByRole('button', { name: 'Quitar etiqueta' }).click();
    await expect(page.getByText('cohorte: septiembre')).toHaveCount(0);
    await page.getByRole('button', { name: 'Etiquetas' }).click();
    await page.locator('.p-dialog').last().locator('.p-dropdown').click();
    await page.getByRole('option', { name: /cohorte/i }).click();
    await page.getByRole('button', { name: 'Asignar existente' }).click();
    await expect(
      page.locator('.label-entry').getByText('cohorte: septiembre'),
    ).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.p-dialog')).toHaveCount(0);

    const requestsBeforeReturn = matchingListRequests.length;
    await page.getByRole('button', { name: 'Volver a Usuarios' }).click();
    await page.waitForURL('**/app/test/user?**');
    await expect(page).toHaveURL(/variasPlanificaciones=varias/);
    await expect(page).toHaveURL(/skip=10/);
    await expect
      .poll(() => matchingListRequests.length)
      .toBeGreaterThan(requestsBeforeReturn);
  });
});
