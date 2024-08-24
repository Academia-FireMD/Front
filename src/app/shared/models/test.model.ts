import { Pregunta, SeguridadAlResponder } from './pregunta.model';
import { Usuario } from './user.model';

enum TestStatus {
  CREADO = 'CREADO',
  EMPEZADO = 'EMPEZADO',
  FINALIZADO = 'FINALIZADO',
}

export interface Test {
  id: number;
  realizadorId: number;
  realizador: Usuario;
  preguntas: Pregunta[];
  status: TestStatus;
}

export interface Respuesta {
  id: number;
  testId: number;
  preguntaId: number;
  respuestaDada: number;
  esCorrecta: boolean;
  seguridad?: SeguridadAlResponder;
  createdAt: Date;
  updatedAt: Date;
}
