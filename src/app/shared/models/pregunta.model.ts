import { Test } from './test.model';

export interface Pregunta {
  id: number;
  identificador: string;
  relevancia: Comunidad[];
  dificultad: Dificultad;
  tema: number;
  descripcion: string;
  solucion: string;
  respuestas: string[];
  respuestaCorrectaIndex: number;
  seguridad: SeguridadAlResponder;
  tests: Test[];
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
