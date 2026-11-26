import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { catchError, filter, map, of, take, timeout } from 'rxjs';
import { environment } from '../../../environments/environment';
import { usuarioIdDeSubject } from '../../cursos/services/hidraulica-interactivo.service';
import { AppConfigService } from '../../services/app-config.service';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { ModuloApp } from '../../shared/models/modulo-app.enum';
import { Rol } from '../../shared/models/user.model';
import { selectCurrentUser } from '../../store/user/user.selectors';
import { puedeAbrirTemario, RUTA_PREVIA_LIBRILLOS } from './previa-librillos';

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

// Se ejecuta después de las guardas de acceso de Documentación.
export const documentacionAlumnoGuard: CanActivateFn = (ruta) => {
  if (!environment.librillosMenu) return true;

  const config = inject(AppConfigService);
  if (
    !config.isModuloHabilitado(ModuloApp.DOCUMENTACION) ||
    !config.isModuloHabilitado(ModuloApp.LIBRILLOS)
  )
    return true;

  const auth = inject(AuthService);
  const sesion = auth.sessionSnapshot();
  const id = usuarioIdDeSubject(sesion.sub);
  if (id === null) return true;
  const destino = inject(Router).createUrlTree([RUTA_PREVIA_LIBRILLOS], {
    queryParams: { ...ruta.queryParams, vista: 'documentos' },
    fragment: ruta.fragment ?? undefined,
  });
  return inject(Store)
    .select(selectCurrentUser)
    .pipe(
      filter((usuario) => usuario?.id === id),
      take(1),
      timeout(12000),
      map((usuario) =>
        auth.isSessionCurrent(sesion) &&
        puedeAbrirTemario(usuario, config.estadoModulos())
          ? destino
          : true,
      ),
      catchError(() => of(true)),
    );
};
