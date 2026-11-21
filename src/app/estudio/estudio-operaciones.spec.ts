import { operacionEstudio } from './estudio-operaciones';

describe('operaciones del visor', () => {
  it.each([
    ['/admin/weeks', 'GET'],
    ['https://example.test/psico/me', 'GET'],
    ['/week/start?p=cv&other=1', 'POST'],
    ['/me', 'POST'],
    ['/week/answer?p=cv', 'POST'],
  ])('descarta %s %s fuera del contrato del visor', (path, method) => {
    expect(operacionEstudio({ path, method })).toBeNull();
  });

  it('transporta únicamente los campos del intento', () => {
    expect(
      operacionEstudio({
        path: '/week/answer?p=cam',
        method: 'POST',
        body: {
          week: '2026-S47',
          attemptId: 'intento-1',
          base: 2,
          i: 3,
          sel: -1,
          opId: 'operacion-1',
          usuarioId: 9,
        },
      }),
    ).toEqual({
      path: '/week/answer',
      method: 'POST',
      perfil: 'cam',
      body: {
        week: '2026-S47',
        attemptId: 'intento-1',
        base: 2,
        i: 3,
        sel: -1,
        opId: 'operacion-1',
      },
    });
  });
});
