import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { AuthService } from '../services/auth.service';

/**
 * Gatea `/app/superadmin/*` (§4.1). Si el rol del JWT no es SUPERADMIN,
 * redirige a `/app/profile` con toast.
 */
export const superadminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const toast = inject(ToastrService);

  const decoded = auth.decodeToken?.();
  if (decoded?.rol === 'SUPERADMIN') {
    return true;
  }

  toast.error('Requiere rol SUPERADMIN');
  router.navigate(['/app/profile']);
  return false;
};
