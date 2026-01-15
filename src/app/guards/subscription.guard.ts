import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { ToastrService } from 'ngx-toastr';
import { Observable, map, take } from 'rxjs';
import { SuscripcionTipo } from '../shared/models/subscription.model';
import { selectCurrentUser } from '../store/user/user.selectors';

@Injectable({
  providedIn: 'root'
})
export class SubscriptionGuard implements CanActivate {
  constructor(
    private store: Store,
    private router: Router,
    private toast: ToastrService
  ) { }

  canActivate(route: ActivatedRouteSnapshot): Observable<boolean> {
    const allowedSubscriptions = route.data['allowedSubscriptions'] as SuscripcionTipo[];

    return this.store.select(selectCurrentUser).pipe(
      take(1),
      map(user => {
        // Obtener el tipo de suscripción más alto de todas las suscripciones activas
        const subscriptionTypes = user?.suscripciones
          ?.filter(s => s.status === 'ACTIVE')
          ?.map(s => s.tipo) || [];
        const hasAccess = this.hasAccess(subscriptionTypes, allowedSubscriptions) || user?.rol == 'ADMIN';

        if (!hasAccess) {
          this.router.navigate(['/app/profile']);
          this.toast.error('No tienes acceso a esta sección');
          return false;
        }

        return true;
      })
    );
  }

  private hasAccess(subscriptionTypes: SuscripcionTipo[], allowedSubscriptions?: SuscripcionTipo[]): boolean {
    if (!allowedSubscriptions || allowedSubscriptions.length === 0) {
      return true; // Si no se especifican restricciones, permitir acceso
    }

    // Verificar si alguna de las suscripciones activas está permitida
    return subscriptionTypes.some(type => allowedSubscriptions.includes(type));
  }
}
