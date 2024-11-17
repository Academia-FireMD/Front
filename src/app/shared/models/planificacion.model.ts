import { Usuario } from './user.model';

export interface PlanificacionBloque {
  id: any;
  identificador: string;
  descripcion?: string;
  subBloques: SubBloque[]; // Relación con SubBloques
  createdAt: Date;
  updatedAt: Date;
  planificacionMensual?: PlanificacionMensual;
  planificacionMensualId?: number;
  origenBloqueId?: number; // ID del bloque original, si es una copia
  origenBloque?: PlanificacionBloque;
  duplicados?: PlanificacionBloque[];
}

export interface SubBloque {
  id: any;
  horaInicio: Date; // La fecha y hora de inicio del sub-bloque
  duracion: number;
  color?: string;
  nombre: string;
  comentarios?: string;
  bloqueId?: number; // Relación opcional con PlanificacionBloque
  bloque?: PlanificacionBloque; // Referencia opcional al bloque
  plantillaId?: number; // Relación con PlantillaSemanal
  plantilla?: PlantillaSemanal; // Relación con la plantilla semanal, si aplica
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PlantillaSemanal {
  id: number;
  identificador: string;
  descripcion?: string;
  subBloques: SubBloque[]; // Relación directa con los sub-bloques o eventos específicos
  planificaciones: PlanificacionMensualPlantilla[]; // Relación con planificaciones mensuales
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
