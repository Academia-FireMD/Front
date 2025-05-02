import { Comunidad } from './pregunta.model';
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
  comunidad: Comunidad;
  avatarUrl: string;
  sub?: number;
  tipoDePlanificacionDuracionDeseada: TipoDePlanificacionDeseada;
}

export enum Rol {
  ADMIN = 'ADMIN',
  ALUMNO = 'ALUMNO',
}

export enum TipoDePlanificacionDeseada {
  FRANJA_CUATRO_A_SEIS_HORAS = 'FRANJA_CUATRO_A_SEIS_HORAS',
  FRANJA_SEIS_A_OCHO_HORAS = 'FRANJA_SEIS_A_OCHO_HORAS',
}
