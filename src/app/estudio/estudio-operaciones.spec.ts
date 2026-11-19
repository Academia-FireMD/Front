import { operacionEstudio } from './estudio-operaciones';

const psico = { tipo: 'psico' } as const;
const librillo = { tipo: 'librillo', documentoId: 14 } as const;

describe('operaciones del visor', () => {
  it.each([
    ['/admin/weeks', 'GET'],
    ['https://example.test/psico/me', 'GET'],
    ['/week/start?p=cv&other=1', 'POST'],
    ['/me', 'POST'],
    ['/week/answer?p=cv', 'POST'],
  ])('descarta %s %s fuera del contrato del visor', (path, method) => {
    expect(operacionEstudio(psico, { path, method })).toBeNull();
  });

  it('fija el recurso y transporta únicamente los campos del intento', () => {
    expect(
      operacionEstudio(psico, {
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

  it('permite una eliminación con ancla estable dentro del documento actual', () => {
    const partes = { notas12345678901234567890: { base: 1, at: 2, j: null } };
    expect(
      operacionEstudio(librillo, { op: 'guardar', payload: partes, doc: 99 }),
    ).toEqual({
      method: 'POST',
      path: '/guardar',
      body: { partes },
    });
    expect(
      operacionEstudio(librillo, { op: 'leer', payload: ['other'] }),
    ).toBeNull();
  });
});
