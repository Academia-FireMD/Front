import { decodeJwtPayload } from './jwt.util';

/** Aislamiento del borrador local; la autorización siempre se comprueba en el servidor. */
export function clavePendientesAlumno(alumnoId: number): string {
  const actor =
    decodeJwtPayload(sessionStorage.getItem('authToken'))?.sub || 'sin-sesion';
  return `gestion-externa-pendiente-${actor}-${alumnoId}`;
}
