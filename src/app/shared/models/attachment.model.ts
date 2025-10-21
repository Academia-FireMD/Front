export interface Adjunto {
  id: number;
  identificador: string;
  descripcion?: string;
  url: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  filePath: string;
  entidadTipo: EntidadTipo;
  entidadId: number;
  createdById: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: {
    id: number;
    nombre: string;
    apellidos: string;
  };
}

export enum EntidadTipo {
  PLANIFICACION_MENSUAL = 'PLANIFICACION_MENSUAL',
  PLANIFICACION_BLOQUE = 'PLANIFICACION_BLOQUE',
  PLANTILLA_SEMANAL = 'PLANTILLA_SEMANAL',
  EXAMEN = 'EXAMEN',
  OTRO = 'OTRO',
}

export interface CreateAdjuntoDto {
  identificador: string;
  descripcion?: string;
  entidadTipo: EntidadTipo;
  entidadId: number;
  file: File;
}

export interface UpdateAdjuntoDto {
  id: number;
  identificador?: string;
  descripcion?: string;
}
