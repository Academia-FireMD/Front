import { Usuario } from './user.model';

export interface PlanificacionBloque {
  id: any;
  nombre: string;
  descripcion?: string;
  subBloques: SubBloque[];
  createdAt: Date;
  updatedAt: Date;
  diaSemana?: DiaSemana;
  diaSemanaId?: number;
  planificacionMensual?: PlanificacionMensual;
  planificacionMensualId?: number;
}

export interface SubBloque {
  id: any;
  horaInicio: Date;
  duracion: number;
  nombre: string;
  comentarios?: string;
  bloqueId?: number;
  bloque?: PlanificacionBloque;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PlantillaSemanal {
  id: number;
  nombre: string;
  descripcion?: string;
  dias: DiaSemana[];
  planificaciones: PlanificacionMensualPlantilla[];
  createdAt: Date;
  updatedAt: Date;
}

export interface DiaSemana {
  id: number;
  dia: string;
  bloques: PlanificacionBloque[];
  plantillaId: number;
  plantilla: PlantillaSemanal;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlanificacionMensual {
  id: number;
  nombre: string;
  descripcion?: string;
  mes: number;
  ano: number;
  plantillas: PlanificacionMensualPlantilla[];
  bloques: PlanificacionBloque[];
  asignaciones: AsignacionAlumno[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PlanificacionMensualPlantilla {
  plantillaId: number;
  planificacionId: number;
  plantilla: PlantillaSemanal;
  planificacion: PlanificacionMensual;
}

export interface AsignacionAlumno {
  alumnoId: number;
  planificacionId: number;
  alumno: Usuario;
  planificacion: PlanificacionMensual;
}
