import { Dificultad, Pregunta } from '../../shared/models/pregunta.model';
import { EstadoPregunta, Respuesta, Test, TestStatus } from '../../shared/models/test.model';

/** Minimal mock Pregunta for use in tests. */
export function createMockPregunta(overrides: Partial<Pregunta> = {}): Pregunta {
  return {
    id: 1,
    identificador: 'TEST-001',
    relevancia: [],
    dificultad: Dificultad.INTERMEDIO,
    tema: { id: 1, numero: 1, descripcion: 'Sistema Cardiovascular' },
    temaId: 1,
    descripcion: '¿Cuál es la principal función del sistema cardiovascular?',
    solucion: 'El sistema cardiovascular transporta sangre, oxígeno y nutrientes.',
    respuestas: [
      'Transportar sangre y nutrientes',
      'Regular la temperatura corporal',
      'Filtrar toxinas del cuerpo',
      'Controlar el equilibrio hormonal',
    ],
    respuestaCorrectaIndex: 0,
    seguridad: undefined as any,
    tests: [],
    ReporteFallo: [],
    ...overrides,
  };
}

/** Creates a mock Respuesta (answer record). */
export function createMockRespuesta(overrides: Partial<Respuesta> = {}): Respuesta {
  return {
    id: 1,
    testId: 123,
    preguntaId: 1,
    respuestaDada: 0,
    esCorrecta: true,
    indicePregunta: 0,
    estado: EstadoPregunta.RESPONDIDA,
    createdAt: new Date('2024-01-15T10:00:00Z'),
    updatedAt: new Date('2024-01-15T10:00:00Z'),
    ...overrides,
  };
}

/** Creates a fully populated mock Test with 3 questions and no answers. */
export function createMockTest(overrides: Partial<Test & { respuestasCount: number }> = {}): Test & { respuestasCount: number } {
  const preguntas: Pregunta[] = [
    createMockPregunta({ id: 1, identificador: 'TEST-001', respuestaCorrectaIndex: 0 }),
    createMockPregunta({ id: 2, identificador: 'TEST-002', respuestaCorrectaIndex: 1, descripcion: 'Segunda pregunta' }),
    createMockPregunta({ id: 3, identificador: 'TEST-003', respuestaCorrectaIndex: 2, descripcion: 'Tercera pregunta' }),
  ];

  return {
    id: 123,
    realizadorId: 1,
    realizador: undefined as any,
    preguntas,
    respuestas: [],
    testPreguntasIds: [1, 2, 3],
    status: TestStatus.EMPEZADO,
    duration: undefined,
    endsAt: undefined,
    createdAt: new Date('2024-01-15T10:00:00Z'),
    esDeRepaso: false,
    respuestasCount: 0,
    ...overrides,
  };
}

/** Creates a mock Test in exam mode (with duration / endsAt). */
export function createMockExamenTest(overrides: Partial<Test & { respuestasCount: number }> = {}): Test & { respuestasCount: number } {
  const farFuture = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes from now
  return createMockTest({
    id: 456,
    duration: 30,
    endsAt: farFuture,
    status: TestStatus.EMPEZADO,
    ...overrides,
  });
}
