import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of, switchMap, timeout } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { Rol } from '../../shared/models/user.model';
import { EstudioApiService } from '../estudio-api.service';
import { TEMAS_PREVIA_LIBRILLOS } from './previa-librillos';

export const previaLibrillosGuard: CanActivateFn = () => {
  const router = inject(Router);
  const auth = inject(AuthService);
  const usuarios = inject(UserService);
  const estudio = inject(EstudioApiService);
  const sesion = auth.sessionSnapshot();
  const denegada = router.createUrlTree(['/app/documentacion/alumno']);
  const documentoId = TEMAS_PREVIA_LIBRILLOS[0].documentoId;

  return usuarios.getCurrentUser$().pipe(
    switchMap(({ rol }) =>
      rol === Rol.ALUMNO && auth.isSessionCurrent(sesion)
        ? estudio
            .librillo(documentoId)
            .pipe(
              map(
                (ficha) =>
                  ficha.documentoId === documentoId &&
                  auth.isSessionCurrent(sesion),
              ),
            )
        : of(false),
    ),
    timeout(12000),
    map((permitido) => permitido || denegada),
    catchError(() => of(denegada)),
  );
};
