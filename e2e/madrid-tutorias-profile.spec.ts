import { expect, test } from '@playwright/test';
import userAlumnoFixture from './fixtures/user-alumno.json';
import { loginAsRoleMock } from './helpers/auth.helper';

const madridUser = {
  ...userAlumnoFixture,
  suscripciones: [
    {
      ...userAlumnoFixture.suscripciones[0],
      tipo: 'ADVANCED',
      oposicion: 'MADRID',
      sku: 'MADRID-ADVANCED-TUTOR12-OFFER',
      monthlyPrice: 79.8,
    },
  ],
};

test('muestra el saldo Tutor12 únicamente para una suscripción Madrid viva', async ({
  page,
}) => {
  await page.route('**/madrid-tutorias/creditos', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        disponibles: 1,
        reservados: 0,
        consumidos: 2,
        expirados: 0,
        historial: [
          {
            id: 10,
            ciclo: 3,
            estado: 'DISPONIBLE',
            validoDesde: '2026-08-31T00:00:00.000Z',
            validoHasta: '2026-09-30T23:59:59.000Z',
            reservaId: null,
            movimientos: [],
          },
        ],
      }),
    }),
  );

  await loginAsRoleMock(page, {
    rol: 'ALUMNO',
    email: madridUser.email,
    userFixture: madridUser,
  });
  await page.goto('/app/profile');

  const card = page.getByTestId('madrid-tutoria-balance-card');
  await expect(card).toBeVisible();
  await expect(card).toContainText('Tutorías Madrid');
  await expect(card).toContainText('Disponibles');
  await expect(card).toContainText('Consumidas');
  await expect(card).toContainText('Ciclo 3');
  await expect(card).toContainText('Disponible');
});
