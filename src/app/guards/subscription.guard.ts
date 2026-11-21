import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { ToastrService } from 'ngx-toastr';
import { Observable, filter, map, take } from 'rxjs';
import { SuscripcionTipo } from '../shared/models/subscription.model';
import { esAdminOSuperior } from '../shared/utils/rol.utils';
import { selectCurrentUser } from '../store/user/user.selectors';
import { esSuscripcionVigente } from '../shared/utils/membresia-externa.util';

@Injectable({
  providedIn: 'root',
})
export class SubscriptionGuard implements CanActivate {
  constructor(
    private store: Store,
    private router: Router,
    private toast: ToastrService,
  ) {}

  canActivate(route: ActivatedRouteSnapshot): Observable<boolean> {
    const allowedSubscriptions = route.data[
      'allowedSubscriptions'
    ] as SuscripcionTipo[];

    return this.store.select(selectCurrentUser).pipe(
      filter((user) => !!user),
      take(1),
      map((user) => {
        const vigentes =
          user?.suscripciones?.filter((s) => esSuscripcionVigente(s)) ?? [];
        const hasAccess =
          (route.data['cualquierSuscripcionVigente']
            ? vigentes.length > 0
            : this.hasAccess(
                vigentes.map((s) => s.tipo),
                allowedSubscriptions,
              )) || esAdminOSuperior(user?.rol);

        if (!hasAccess) {
          this.router.navigate(['/app/profile']);
          this.toast.error('No tienes acceso a esta sección');
          return false;
        }

        return true;
      }),
    );
  }

  private hasAccess(
    subscriptionTypes: SuscripcionTipo[],
    allowedSubscriptions?: SuscripcionTipo[],
  ): boolean {
    if (!allowedSubscriptions || allowedSubscriptions.length === 0) {
      return true; // Si no se especifican restricciones, permitir acceso
    }

    // Verificar si alguna de las suscripciones activas está permitida
    return subscriptionTypes.some((type) =>
      allowedSubscriptions.includes(type),
    );
  }
}
