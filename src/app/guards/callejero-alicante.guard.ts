import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { filter, map, take } from 'rxjs';
import { Oposicion } from '../shared/models/subscription.model';
import { esAdminOSuperior } from '../shared/utils/rol.utils';
import { selectCurrentUser } from '../store/user/user.selectors';

/** Limita la beta Alicante a alumnos CPBA y roles administrativos. */
export const callejeroAlicanteGuard: CanActivateFn = () => {
  const store = inject(Store);
  const router = inject(Router);

  return store.select(selectCurrentUser).pipe(
    filter((user) => user !== null),
    take(1),
    map((user) => {
      const tieneAcceso =
        esAdminOSuperior(user?.rol) ||
        user?.oposiciones?.includes(Oposicion.ALICANTE_CPBA);

      return tieneAcceso ? true : router.createUrlTree(['/app/profile']);
    }),
  );
};
