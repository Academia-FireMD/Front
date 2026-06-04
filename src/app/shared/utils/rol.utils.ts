import { Rol } from '../models/user.model';

/**
 * Helpers de jerarquía de rol para la UI. Espejo del backend
 * (`Server/src/utils/rol.utils.ts`): SUPERADMIN > ADMIN > ALUMNO.
 *
 * Motivo: muchos componentes hacían checks binarios `rol === 'ADMIN'` que
 * trataban a SUPERADMIN como alumno (le mostraban suscripciones/accesos, le
 * etiquetaban "Alumno", le ocultaban acciones de admin). Usar estos helpers
 * en vez del literal evita ese sesgo y deja un único sitio que define la
 * jerarquía para el front.
 */
type RolLike = Rol | string | null | undefined;

/** True para ADMIN o SUPERADMIN (admin o superior). */
export function esAdminOSuperior(rol: RolLike): boolean {
  return rol === Rol.ADMIN || rol === Rol.SUPERADMIN;
}

/** True solo para SUPERADMIN. */
export function esSuperadmin(rol: RolLike): boolean {
  return rol === Rol.SUPERADMIN;
}

/** Etiqueta humana completa del rol (badge de perfil). */
export function etiquetaRol(rol: RolLike): string {
  switch (rol) {
    case Rol.SUPERADMIN:
      return 'Superadministrador';
    case Rol.ADMIN:
      return 'Administrador';
    default:
      return 'Alumno';
  }
}

/** Etiqueta corta del rol (chips en listados). */
export function etiquetaRolCorta(rol: RolLike): string {
  switch (rol) {
    case Rol.SUPERADMIN:
      return 'Super';
    case Rol.ADMIN:
      return 'Admin';
    default:
      return 'Alumno';
  }
}
