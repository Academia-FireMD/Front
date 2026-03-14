import { Rol, MetodoCalificacion, Usuario } from '../../shared/models/user.model';

/**
 * Creates a test Usuario object for the Angular front-end.
 */
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

/**
 * Creates a test admin user.
 */
export function createTestAdmin(overrides: Partial<Usuario> = {}): Usuario {
  return createTestUser({
    id: 99,
    email: 'admin@test.com',
    nombre: 'Admin',
    rol: Rol.ADMIN,
    ...overrides,
  });
}
