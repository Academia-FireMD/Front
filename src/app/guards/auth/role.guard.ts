import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';

/**
 * Jerarquía de roles. Cualquier rol con nivel >= al expectedRole pasa.
 * SUPERADMIN > ADMIN > ALUMNO/USER. SIN_APROBACION queda fuera (rechazo
 * incondicional aunque alguien la sete a 999 — el código abajo lo
 * filtra primero).
 *
 * Pre-fix bug WL-roleguard (2026-05-25): el guard solo aceptaba match
 * exacto + bypass implícito para `userRole === 'ADMIN'`. Olvidaba
 * SUPERADMIN, así que un super-admin recibía "No tiene permiso para
 * acceder a esta ruta" al intentar entrar a rutas con
 * `expectedRole: 'ADMIN'`.
 */
const ROLE_RANK: Record<string, number> = {
  SUPERADMIN: 3,
  ADMIN: 2,
  ALUMNO: 1,
  USER: 1,
};

export const roleGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const toast = inject(ToastrService);
  const token = sessionStorage.getItem('authToken');

  if (!token) {
    router.navigate(['/auth']);
    toast.warning('No se ha loggeado, redirigiendo al login...');
    return false;
  }

  const payload = JSON.parse(atob(token.split('.')[1]));
  const userRole = payload.rol as string | undefined;
  const expectedRole = route.data['expectedRole'] as string | undefined;

  if (!userRole || userRole === 'SIN_APROBACION') {
    router.navigate(['/auth']);
    toast.error('No tiene permiso para acceder a esta ruta');
    return false;
  }

  const userRank = ROLE_RANK[userRole] ?? 0;
  const expectedRank = expectedRole ? (ROLE_RANK[expectedRole] ?? 0) : 0;

  // Match exacto (legacy) OR jerarquía suficiente.
  if (userRole === expectedRole || userRank >= expectedRank) {
    return true;
  }

  router.navigate(['/auth']);
  toast.error('No tiene permiso para acceder a esta ruta');
  return false;
};
