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
  tipoDePlanificacionDuracionDeseada: TipoDePlanificacionDeseada;
}

export enum Rol {
  ADMIN = 'ADMIN',
  ALUMNO = 'ALUMNO',
}

export enum TipoDePlanificacionDeseada {
  CUATRO_HORAS = 'CUATRO_HORAS',
  SEIS_HORAS = 'SEIS_HORAS',
  OCHO_HORAS = 'OCHO_HORAS',
}
