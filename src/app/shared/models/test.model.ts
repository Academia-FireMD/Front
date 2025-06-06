import { Examen } from '../../examen/models/examen.model';
import { Pregunta, SeguridadAlResponder } from './pregunta.model';
import { Usuario } from './user.model';

export enum TestStatus {
  CREADO = 'CREADO',
  EMPEZADO = 'EMPEZADO',
  FINALIZADO = 'FINALIZADO',
}

export enum EstadoPregunta {
  NO_RESPONDIDA = 'NO_RESPONDIDA',
  RESPONDIDA = 'RESPONDIDA',
  OMITIDA = 'OMITIDA',
}

export interface Test {
  id: number;
  realizadorId: number;
  realizador: Usuario;
  testPreguntas?: any[];
  preguntas: Pregunta[];
  respuestas: Respuesta[];
  testPreguntasIds: number[];
  status: TestStatus;
  duration?: number;
  endsAt?: Date;
  createdAt: Date;
  esDeRepaso?: boolean;
  examenId?: number;
  ExamenRealizado?: Examen;
  ExamenOriginal?: Examen;
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
  indicePregunta: number;
  estado: EstadoPregunta;
}
