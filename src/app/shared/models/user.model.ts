import { Test } from "./test.model";

export interface Usuario {
  id: number;
  email: string;
  contrasenya: string;
  rol: Rol;
  createdAt: Date;
  updatedAt: Date;
  validated: boolean;
  tests: Test[];
}

export enum Rol {
  ADMIN = 'ADMIN',
  ALUMNO = 'ALUMNO',
}
