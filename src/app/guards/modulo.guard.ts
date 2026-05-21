import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { AppConfigService } from '../services/app-config.service';
import { AuthService } from '../services/auth.service';
import { ModuloApp } from '../shared/models/modulo-app.enum';

/**
 * Frontend ModuloGuard (D12, §5.5).
 *
 * Lee `route.data.modulo: ModuloApp`. Si está OFF y el usuario NO es
 * SUPERADMIN, redirige a `/app/profile` con toast. SUPERADMIN bypassa
 * (puede entrar a un módulo apagado para diagnosticar).
 *
 * Si la route NO declara `modulo`, no aplica (permite).
 */
export const moduloGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const modulo = route.data?.['modulo'] as ModuloApp | undefined;
  if (!modulo) return true;

  const appConfig = inject(AppConfigService);
  const auth = inject(AuthService);
  const router = inject(Router);
  const toast = inject(ToastrService);

  const decoded = auth.decodeToken?.();
  if (decoded?.rol === 'SUPERADMIN') return true;

  if (appConfig.isModuloHabilitado(modulo)) return true;

  toast.error('Módulo no disponible');
  router.navigate(['/app/profile']);
  return false;
};
