import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { filter, map, take } from 'rxjs';
import { Oposicion } from '../shared/models/subscription.model';
import { selectCurrentUser } from '../store/user/user.selectors';
import { puedeAccederCallejero } from '../callejero/callejero-acceso.util';

function crearCallejeroOposicionGuard(oposicion: Oposicion): CanActivateFn {
  return () => {
    const store = inject(Store);
    const router = inject(Router);

    return store.select(selectCurrentUser).pipe(
      filter((user) => user !== null),
      take(1),
      map((user) =>
        puedeAccederCallejero(user, oposicion)
          ? true
          : router.createUrlTree(['/app/profile']),
      ),
    );
  };
}

/** Limita cada callejero a su oposición o a roles administrativos. */
export const callejeroAlicanteGuard = crearCallejeroOposicionGuard(
  Oposicion.ALICANTE_CPBA,
);
export const callejeroValenciaGuard = crearCallejeroOposicionGuard(
  Oposicion.VALENCIA_AYUNTAMIENTO,
);
