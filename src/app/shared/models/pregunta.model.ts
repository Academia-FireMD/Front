import { Test } from './test.model';
import { Usuario } from './user.model';

export interface Pregunta {
  id: number;
  identificador: string;
  relevancia: Comunidad[];
  dificultad: Dificultad;
  tema: Tema;
  temaId: number;
  descripcion: string;
  solucion: string;
  respuestas: string[];
  respuestaCorrectaIndex: number;
  seguridad: SeguridadAlResponder;
  tests: Test[];
}

export interface PreguntaFallo {
  id: number;
  preguntaId: number;
  usuarioId: number;
  descripcion: string;
  createdAt: Date;
  updatedAt: Date;
  pregunta?: Pregunta; // Relación opcional con Pregunta
  usuario?: Usuario; // Relación opcional con Usuario
}

export interface Tema {
  id: number;
  numero: number;
  descripcion?: string;
  categoria?: string;
}

export enum Dificultad {
  BASICO = 'BASICO',
  INTERMEDIO = 'INTERMEDIO',
  DIFICIL = 'DIFICIL',
}

export enum SeguridadAlResponder {
  CINCUENTA_POR_CIENTO = 'CINCUENTA_POR_CIENTO',
  SETENTA_Y_CINCO_POR_CIENTO = 'SETENTA_Y_CINCO_POR_CIENTO',
  CIEN_POR_CIENTO = 'CIEN_POR_CIENTO',
}

export enum Comunidad {
  MADRID = 'MADRID',
  VALENCIA = 'VALENCIA',
  MURCIA = 'MURCIA',
}
