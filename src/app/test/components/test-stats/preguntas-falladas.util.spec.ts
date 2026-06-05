import { EstadoPregunta, Test } from '../../../shared/models/test.model';
import {
  extraerPreguntasFalladas,
  construirMensajeFallos,
} from './preguntas-falladas.util';

function testFixture(): Test {
  return {
    id: 1,
    realizadorId: 1,
    realizador: {} as any,
    preguntas: [
      {
        id: 10,
        descripcion: 'Presión manguera 45mm',
        respuestas: ['4 bar', '9 bar'],
        respuestaCorrectaIndex: 1,
        tema: { descripcion: 'Hidráulica' },
      } as any,
      {
        id: 11,
        descripcion: 'Art. 1.124 CC',
        respuestas: ['A', 'B'],
        respuestaCorrectaIndex: 0,
        tema: { descripcion: 'Legislación' },
      } as any,
      {
        id: 12,
        descripcion: 'Acertada',
        respuestas: ['X', 'Y'],
        respuestaCorrectaIndex: 0,
        tema: { descripcion: 'Otro' },
      } as any,
    ],
    respuestas: [
      {
        id: 1,
        testId: 1,
        preguntaId: 10,
        respuestaDada: 0,
        esCorrecta: false,
        estado: EstadoPregunta.RESPONDIDA,
      } as any,
      {
        id: 2,
        testId: 1,
        preguntaId: 11,
        respuestaDada: 1,
        esCorrecta: false,
        estado: EstadoPregunta.RESPONDIDA,
      } as any,
      {
        id: 3,
        testId: 1,
        preguntaId: 12,
        respuestaDada: 0,
        esCorrecta: true,
        estado: EstadoPregunta.RESPONDIDA,
      } as any,
    ],
    testPreguntasIds: [],
    status: 'FINALIZADO' as any,
    createdAt: new Date(),
  };
}

describe('extraerPreguntasFalladas', () => {
  it('devuelve solo las respondidas e incorrectas, con enunciado y tema', () => {
    const falladas = extraerPreguntasFalladas(testFixture());
    expect(falladas.map((f) => f.id)).toEqual([10, 11]);
    expect(falladas[0]).toMatchObject({
      descripcion: 'Presión manguera 45mm',
      tema: 'Hidráulica',
    });
  });

  it('ignora las no respondidas/omitidas', () => {
    const t = testFixture();
    t.respuestas[1].estado = EstadoPregunta.NO_RESPONDIDA;
    expect(extraerPreguntasFalladas(t).map((f) => f.id)).toEqual([10]);
  });

  it('devuelve [] si no hay test o respuestas', () => {
    expect(extraerPreguntasFalladas(undefined as any)).toEqual([]);
  });
});

describe('construirMensajeFallos', () => {
  it('genera un mensaje con los enunciados fallados y pide nemotécnicas', () => {
    const msg = construirMensajeFallos([
      {
        id: 10,
        descripcion: 'Presión manguera 45mm',
        correcta: '9 bar',
        tema: 'Hidráulica',
      },
    ]);
    expect(msg).toContain('Presión manguera 45mm');
    expect(msg).toContain('9 bar');
    expect(
      msg
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, ''),
    ).toContain('nemotecn');
  });

  it('devuelve cadena vacía sin fallos', () => {
    expect(construirMensajeFallos([])).toBe('');
  });
});
