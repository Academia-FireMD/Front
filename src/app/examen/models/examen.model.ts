import { Comunidad, Pregunta } from "../../shared/models/pregunta.model";
import { Test } from "../../shared/models/test.model";
import { MetodoCalificacion } from "../../shared/models/user.model";

export enum EstadoExamen {
  BORRADOR = 'BORRADOR',
  PUBLICADO = 'PUBLICADO',
  ARCHIVADO = 'ARCHIVADO',
}

export enum TipoAcceso {
  PUBLICO = 'PUBLICO',
  SIMULACRO = 'SIMULACRO',
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
  metodoCalificacion?: MetodoCalificacion;
  relevancia: Comunidad[];
  creadorId: number;
  testId?: number;
  test?: Test;
  preguntas?: Pregunta[];
  preguntasReserva?: Pregunta[];
  createdAt: Date;
  updatedAt: Date;
}
