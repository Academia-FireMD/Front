import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of, timeout } from 'rxjs';
import { AppConfigService } from '../../services/app-config.service';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { ModuloApp } from '../../shared/models/modulo-app.enum';
import { Rol } from '../../shared/models/user.model';

export const previaLibrillosGuard: CanActivateFn = () => {
  const router = inject(Router);
  const config = inject(AppConfigService);
  const auth = inject(AuthService);
  const usuarios = inject(UserService);
  const sesion = auth.sessionSnapshot();
  const perfil = router.createUrlTree(['/app/profile']);

  if (!config.isModuloHabilitado(ModuloApp.DOCUMENTACION)) return perfil;

  return usuarios.getCurrentUser$().pipe(
    timeout(12000),
    map(
      ({ rol }) =>
        (rol === Rol.ALUMNO && auth.isSessionCurrent(sesion)) || perfil,
    ),
    catchError(() => of(perfil)),
  );
};
