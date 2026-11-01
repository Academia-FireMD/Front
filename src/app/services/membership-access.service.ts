import { Injectable, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { ToastrService } from 'ngx-toastr';
import {
  Observable,
  catchError,
  finalize,
  of,
  shareReplay,
  take,
  tap,
} from 'rxjs';
import { AppState } from '../store/app.state';
import * as UserActions from '../store/user/user.actions';
import { REASON_SUSCRIPCION_REQUERIDA } from '../shared/models/subscription.model';
import { Usuario } from '../shared/models/user.model';
import { suscripcionesVigentes } from '../shared/utils/membresia-externa.util';
import { AuthService } from './auth.service';
import {
  AuthSessionService,
  AuthSessionSnapshot,
} from './auth-session.service';
import { UserService } from './user.service';

/** Evita repetir carga/toast si llegan varios 403 en paralelo o en ráfaga. */
const COOLDOWN_MS = 3_000;

/**
 * Gestión del 403 de negocio `SUSCRIPCION_REQUERIDA`.
 *
 * El backend reserva ese `reason` para "la membresía que daba acceso ya no
 * está vigente". En ese caso —y SOLO en ese caso— recargamos el perfil actual
 * una vez, actualizamos el store y llevamos al alumno a un destino permitido.
 *
 * No cerramos sesión, no borramos tokens y no tratamos otros 403 (por ejemplo
 * `TIER_TOO_LOW`) como pérdida de membresía. El single-flight del refresh de
 * `AuthService` y el reintento del interceptor quedan intactos: esto ocurre
 * después de que el interceptor descarte un 401.
 */
@Injectable({ providedIn: 'root' })
export class MembershipAccessService {
  private readonly authService = inject(AuthService);
  private readonly userService = inject(UserService);
  private readonly store = inject<Store<AppState>>(Store);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastrService);
  private readonly sessions = inject(AuthSessionService);

  private reloadInFlight: {
    session: AuthSessionSnapshot;
    observable: Observable<Usuario | null>;
  } | null = null;
  private cooldownSession: AuthSessionSnapshot | null = null;
  private lastHandledAt = 0;
  private lastToastAt = 0;

  /** ¿Este error es el 403 estable de membresía que debemos gestionar? */
  debeGestionar(error: unknown): boolean {
    const httpError = error as HttpErrorResponse | null | undefined;
    const reason = (httpError?.error as { reason?: unknown } | undefined)
      ?.reason;
    return httpError?.status === 403 && reason === REASON_SUSCRIPCION_REQUERIDA;
  }

  /**
   * Recarga el perfil actual una sola vez y redirige. Es síncrono para el
   * interceptor: el error original se propaga igualmente al componente.
   */
  handleSuscripcionRequerida(): void {
    if (!this.esAlumnoAutenticado()) return;

    const session = this.sessions.snapshot();
    // El cooldown es de la sesión: un 403 de A no debe silenciar el primer
    // 403 legítimo de B tras cambiar de cuenta.
    if (this.cooldownSession !== session) {
      this.cooldownSession = session;
      this.lastHandledAt = 0;
      this.lastToastAt = 0;
    }

    if (
      this.reloadInFlight &&
      this.sessions.isCurrent(this.reloadInFlight.session)
    ) {
      return;
    }

    const ahora = Date.now();
    if (ahora - this.lastHandledAt < COOLDOWN_MS) return;
    this.lastHandledAt = ahora;

    const slot = {
      session,
      observable: null as unknown as Observable<Usuario | null>,
    };
    const reload$ = this.userService.getUserProfile$().pipe(
      tap((user) => {
        if (!this.sessions.isCurrent(session)) return;
        this.authService.lastUserLoaded = user;
        this.store.dispatch(UserActions.loadUserSuccess({ user }));
      }),
      catchError(() => of(null)),
      finalize(() => {
        if (this.reloadInFlight === slot) {
          this.reloadInFlight = null;
        }
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );

    slot.observable = reload$;
    this.reloadInFlight = slot;
    reload$
      .pipe(take(1))
      .subscribe((user) => this.explicarYRedirigir(user, session));
  }

  private esAlumnoAutenticado(): boolean {
    const claims = this.authService.decodeToken?.();
    return claims?.rol === 'ALUMNO';
  }

  private explicarYRedirigir(
    user: Usuario | null,
    session: AuthSessionSnapshot,
  ): void {
    // La respuesta pertenece a una sesión anterior: no debe redirigir ni
    // mostrar toasts como si fueran del usuario actual.
    if (!this.sessions.isCurrent(session)) return;

    // Si el reload falló con 401, el refresh inválido ya limpió la sesión y
    // ApiBaseService habrá mandado al login. No la pisamos con /app/profile.
    if (!this.esAlumnoAutenticado()) return;

    // `getUserProfile$` siempre emite un Usuario; null significa que el reload
    // falló. En ese caso el estado de la membresía es DESCONOCIDO: no podemos
    // afirmar que se haya cancelado nada.
    const mensaje = !user
      ? 'No hemos podido confirmar el estado de tu membresía, pero tu sesión sigue activa. Te llevamos a tu perfil; tus cursos concedidos y tu progreso se conservan.'
      : suscripcionesVigentes(user).length > 0
        ? 'Tu plan actual no incluye esta sección. Te llevamos a tu perfil para que sigas con lo que tienes disponible.'
        : 'Tu membresía ya no está activa. Mantienes el acceso a tu perfil, a los cursos concedidos y a tu historial.';

    if (Date.now() - this.lastToastAt >= COOLDOWN_MS) {
      this.lastToastAt = Date.now();
      this.toast.info(mensaje, 'Acceso actualizado');
    }

    const url = this.router.url.split('?')[0];
    const yaEstoyEnDestinoPermitido =
      url === '/app/profile' ||
      url === '/app/cursos' ||
      url.startsWith('/app/cursos/');
    if (!yaEstoyEnDestinoPermitido) {
      void this.router.navigate(['/app/profile']);
    }
  }
}
