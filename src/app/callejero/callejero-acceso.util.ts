import {
  isSubscriptionAccessible,
  Oposicion,
} from '../shared/models/subscription.model';
import { Usuario } from '../shared/models/user.model';
import { esAdminOSuperior } from '../shared/utils/rol.utils';

export type DestinoCallejero =
  | 'valencia'
  | 'alicante'
  | 'selector'
  | 'sin-acceso';

type UsuarioCallejero = Pick<Usuario, 'rol' | 'oposiciones' | 'suscripciones'>;

/**
 * Las suscripciones accesibles son la fuente de verdad cuando el perfil las
 * incluye. `oposiciones` se conserva como fallback porque el backend también
 * lo deriva de las suscripciones vigentes para el JWT y respuestas reducidas.
 */
export function obtenerOposicionesCallejero(
  user: UsuarioCallejero,
): Oposicion[] {
  if (Array.isArray(user.suscripciones)) {
    return [
      ...new Set(
        user.suscripciones
          .filter((suscripcion) => isSubscriptionAccessible(suscripcion.status))
          .map((suscripcion) => suscripcion.oposicion),
      ),
    ];
  }

  return user.oposiciones ?? [];
}

export function puedeAccederCallejero(
  user: UsuarioCallejero,
  oposicion: Oposicion,
): boolean {
  return (
    esAdminOSuperior(user.rol) ||
    obtenerOposicionesCallejero(user).includes(oposicion)
  );
}

export function resolverDestinoCallejero(
  user: UsuarioCallejero,
): DestinoCallejero {
  if (esAdminOSuperior(user.rol)) return 'selector';

  const oposiciones = obtenerOposicionesCallejero(user);
  const tieneValencia = oposiciones.includes(Oposicion.VALENCIA_AYUNTAMIENTO);
  const tieneAlicante = oposiciones.includes(Oposicion.ALICANTE_CPBA);

  if (tieneValencia && tieneAlicante) return 'selector';
  if (tieneValencia) return 'valencia';
  if (tieneAlicante) return 'alicante';
  return 'sin-acceso';
}
