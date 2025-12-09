import { Pregunta } from "../../shared/models/pregunta.model";
import { Oposicion } from "../../shared/models/subscription.model";
import { Test } from "../../shared/models/test.model";
import { MetodoCalificacion } from "../../shared/models/user.model";

export enum EstadoExamen {
  BORRADOR = 'BORRADOR',
  PUBLICADO = 'PUBLICADO',
  ARCHIVADO = 'ARCHIVADO',
}

export enum TipoAcceso {
  PUBLICO = 'PUBLICO',
  RESTRINGIDO = 'RESTRINGIDO',
  SIMULACRO = 'SIMULACRO',
  COLABORATIVO = 'COLABORATIVO',
}


export interface CondicionColaborativa {
  id?: number;
  numeroPreguntas: number;
  temasRequeridos: number[];
  orden?: number;
}

export interface Examen {
  id: number;
  titulo: string;
  descripcion: string;
  duracion: number;
  estado: EstadoExamen;
  tipoAcceso: TipoAcceso;
  codigoAcceso?: string;
  fechaActivacion?: Date;
  fechaSolucion?: Date;
  fechaPreparatoria?: Date;
  fechaFinPreparatoria?: Date;
  numeroPreguntas?: number;
  temasColaborativos?: number[];
  condicionesColaborativas?: CondicionColaborativa[];
  metodoCalificacion?: MetodoCalificacion;
  relevancia: Oposicion[];
  creadorId: number;
  testId?: number;
  test?: Test;
  preguntas?: Pregunta[];
  preguntasReserva?: Pregunta[];
  createdAt: Date;
  updatedAt: Date;
}
