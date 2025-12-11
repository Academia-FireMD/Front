import { NivelOposicion, TipoOposicion } from './pregunta.model';
import { Oposicion, Suscripcion } from './subscription.model';
import { Test } from './test.model';


export interface Usuario {
  id: number;
  email: string;
  contrasenya: string;
  rol: Rol;
  createdAt: Date;
  updatedAt: Date;
  validated: boolean;
  tests: Test[];
  nombre: string;
  apellidos: string;
  esTutor: boolean;
  tutorId?: number;
  avatarUrl: string;
  sub?: number;
  tipoDePlanificacionDuracionDeseada: TipoDePlanificacionDeseada;
  metodoCalificacion: MetodoCalificacion;
  woocommerceCustomerId?: string;
  suscripciones?: Suscripcion[];  // Usuario puede tener múltiples suscripciones
  consumibles?: Consumible[];
  oposiciones?: Oposicion[];  // Oposiciones activas (derivado de suscripciones activas)
  labels?: { labelId: string; label: { id: string; key: string; value?: string } }[];

  // Campos de onboarding
  dni?: string;
  fechaNacimiento?: Date;
  nombreEmpresa?: string;
  paisRegion?: string;
  direccionCalle?: string;
  codigoPostal?: string;
  poblacion?: string;
  provincia?: string;
  telefono?: string;
  municipioResidencia?: string;
  estudiosPrevaios?: string;
  actualTrabajoOcupacion?: string;
  hobbies?: string;
  descripcionSemana?: string;
  horasEstudioDiaSemana?: number;
  horasEntrenoDiaSemana?: number;
  organizacionEstudioEntreno?: string;
  temaPersonal?: string;
  oposicionesHechasResultados?: string;
  pruebasFisicas?: string;
  tecnicasEstudioUtilizadas?: string;
  objetivosSeisMeses?: string;
  objetivosUnAno?: string;
  experienciaAcademias?: boolean;
  queValorasAcademia?: string;
  queMenosGustaAcademias?: string;
  queEsperasAcademia?: string;
  trabajasActualmente?: string;
  agotamientoFisicoMental?: string;
  tiempoDedicableEstudio?: string;
  diasSemanaDisponibles?: string;
  otraInformacionLaboral?: string;
  comentariosAdicionales?: string;
  onboardingCompletado?: boolean;
  ultimoRecordatorioOnboarding?: Date;

  // Nuevos campos faltantes
  tipoOposicion?: TipoOposicion;
  nivelOposicion?: NivelOposicion;
}

export interface Consumible {
  id: number;
  tipo: 'SIMULACRO' | 'EXAMEN' | 'CURSO' | 'OTRO';
  estado: 'ACTIVADO' | 'USADO' | 'EXPIRADO';
  sku: string;
  orderId: string;
  examenId?: number;
  activadoEn: Date;
  expiraEn?: Date;
  usadoEn?: Date;
  // Relación con examen (puede venir populated)
  examen?: {
    id: number;
    titulo: string;
    descripcion?: string;
    codigoAcceso?: string;
  };
}

export enum Rol {
  ADMIN = 'ADMIN',
  ALUMNO = 'ALUMNO',
}

export const rolesPlataforma = [Rol.ADMIN, Rol.ALUMNO];
export const esRolPlataforma = (rol: Rol) => rolesPlataforma.includes(rol);

export enum TipoDePlanificacionDeseada {
  FRANJA_CUATRO_A_SEIS_HORAS = 'FRANJA_CUATRO_A_SEIS_HORAS',
  FRANJA_SEIS_A_OCHO_HORAS = 'FRANJA_SEIS_A_OCHO_HORAS',
}

export enum MetodoCalificacion {
  A1_E1_3_B0 = 'A1_E1_3_B0',
  A1_E1_4_B0 = 'A1_E1_4_B0',
  BASICO = 'BASICO',
}
