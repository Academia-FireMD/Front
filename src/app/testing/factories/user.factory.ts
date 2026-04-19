import {
  Rol,
  MetodoCalificacion,
  Usuario,
} from '../../shared/models/user.model';

export function createTestUser(overrides: Partial<Usuario> = {}): Usuario {
  return {
    id: 1,
    email: 'alumno@test.com',
    contrasenya: '',
    nombre: 'Test',
    apellidos: 'User',
    rol: Rol.ALUMNO,
    createdAt: new Date(),
    updatedAt: new Date(),
    validated: true,
    tests: [],
    esTutor: false,
    avatarUrl: '',
    tipoDePlanificacionDuracionDeseada: 'FRANJA_CUATRO_A_SEIS_HORAS' as any,
    metodoCalificacion: MetodoCalificacion.A1_E1_3_B0,
    ...overrides,
  } as Usuario;
}
