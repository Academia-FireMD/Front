import { Comunidad } from './pregunta.model';
import { TipoDePlanificacionDeseada, Usuario } from './user.model';

export interface PlanificacionBloque {
  id: any;
  identificador: string;
  descripcion?: string;
  subBloques: SubBloque[]; // Relación con SubBloques
  createdAt: Date;
  updatedAt: Date;
  planificacionMensual?: PlanificacionMensual;
  planificacionMensualId?: number;
}

export interface SubBloque {
  id: any;
  horaInicio: Date; // La fecha y hora de inicio del sub-bloque
  duracion: number;
  color?: string;
  importante?: boolean;
  tiempoAviso?: number;
  nombre: string;
  comentarios?: string;
  bloqueId?: number; // Relación opcional con PlanificacionBloque
  bloque?: PlanificacionBloque; // Referencia opcional al bloque
  plantillaId?: number; // Relación con PlantillaSemanal
  plantilla?: PlantillaSemanal; // Relación con la plantilla semanal, si aplica
  createdAt?: Date;
  updatedAt?: Date;
  realizado?: boolean;
  comentariosAlumno?: string;
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
  identificador: string;
  descripcion?: string;
  mes: number;
  ano: number;
  subBloques: SubBloque[];
  asignacion: AsignacionAlumno;
  createdAt: Date;
  esPorDefecto: boolean;
  tipoDePlanificacion?: TipoDePlanificacionDeseada;
  relevancia: Array<Comunidad>;
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
