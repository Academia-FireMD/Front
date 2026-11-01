import {
  HttpErrorResponse,
  HttpEvent,
  HttpContextToken,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
} from '@angular/common/http';
import { Injectable, Injector } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { MembershipAccessService } from './membership-access.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private authService!: AuthService;
  private membershipAccessService!: MembershipAccessService;

  constructor(private injector: Injector) {}

  private getAuthService(): AuthService {
    if (!this.authService) {
      this.authService = this.injector.get(AuthService);
    }
    return this.authService;
  }

  private getMembershipAccessService(): MembershipAccessService {
    if (!this.membershipAccessService) {
      this.membershipAccessService = this.injector.get(MembershipAccessService);
    }
    return this.membershipAccessService;
  }

  intercept(
    req: HttpRequest<any>,
    next: HttpHandler,
  ): Observable<HttpEvent<any>> {
    // Leer token directamente de sessionStorage para evitar dependencia circular
    const authToken = sessionStorage.getItem('authToken');

    // Clonar la solicitud con el token si está presente
    let clonedRequest = req;
    if (authToken) {
      clonedRequest = req.clone({
        headers: req.headers.set('Authorization', `Bearer ${authToken}`),
      });
    }

    return next.handle(clonedRequest).pipe(
      catchError((error: HttpErrorResponse) => {
        const authSvc = this.getAuthService();
        if (
          error.status === 401 &&
          !this.isRefreshRequest(req) &&
          !req.context.get(AUTH_REFRESH_RETRIED) &&
          authSvc.getRefreshToken()
        ) {
          // Si el access token ha expirado, intenta renovar usando el refresh
          // token. IMPORTANTE: este catchError va ANTES del switchMap para
          // limpiar la sesión SOLO si falla el refresh, no si falla la request
          // reintentada (un 403 de membresía tras un refresh válido debe
          // conservar los tokens y los cursos permanentes).
          return authSvc.refreshToken$().pipe(
            catchError((refreshError: HttpErrorResponse) => {
              // Solo un rechazo de credenciales invalida la sesión. Un 5xx,
              // timeout o fallo de red al consultar la BD NO significa que el
              // refresh token sea inválido: conservamos los tokens y dejamos
              // que el error transitorio se propague sin reintentos en bucle.
              if (
                refreshError?.status === 401 ||
                refreshError?.status === 403
              ) {
                authSvc.clearToken();
                authSvc.clearRefreshToken();
              }
              return throwError(() => refreshError);
            }),
            switchMap(
              (tokens: { access_token?: unknown } | null | undefined) => {
                // Solo reintenta con el access_token recién emitido; nunca con
                // un token viejo que quedase en sessionStorage si la respuesta
                // de refresh viene incompleta.
                const newToken =
                  typeof tokens?.access_token === 'string' &&
                  tokens.access_token.length > 0
                    ? tokens.access_token
                    : null;
                if (!newToken) {
                  // Refresh 200 sin access_token: la sesión no puede continuar
                  // y el usuario debe volver a autenticarse.
                  authSvc.clearToken();
                  authSvc.clearRefreshToken();
                  return throwError(() => error);
                }
                const newRequest = req.clone({
                  context: req.context.set(AUTH_REFRESH_RETRIED, true),
                  headers: req.headers.set(
                    'Authorization',
                    `Bearer ${newToken}`,
                  ),
                });
                return next.handle(newRequest).pipe(
                  catchError((retryError: HttpErrorResponse) => {
                    if (retryError.status === 401) {
                      // El refresh fue válido pero el reintento sigue sin
                      // autenticar: la sesión no sirve.
                      authSvc.clearToken();
                      authSvc.clearRefreshToken();
                    } else if (retryError.status === 403) {
                      this.manejarForbiddenDeMembresia(
                        retryError,
                        req,
                        newToken,
                      );
                    }
                    return throwError(() => retryError);
                  }),
                );
              },
            ),
          );
        }

        // 403 de negocio: SOLO el reason estable de membresía recarga el
        // perfil actual y redirige. El resto de 403 se propaga sin tocar la
        // sesión (nunca son motivo de logout).
        this.manejarForbiddenDeMembresia(error, req, authToken);

        // Si el error no es 401, propaga el error
        return throwError(() => error);
      }),
    );
  }

  /**
   * Aplica el tratamiento del 403 de membresía tanto al request original como
   * al reintento posterior a un refresh. Nunca limpia tokens por sí mismo.
   */
  private manejarForbiddenDeMembresia(
    error: HttpErrorResponse,
    req: HttpRequest<any>,
    authToken: string | null,
  ): void {
    if (
      error.status !== 403 ||
      !authToken ||
      this.isRefreshRequest(req) ||
      this.isProfileRequest(req)
    ) {
      return;
    }
    const membershipAccess = this.getMembershipAccessService();
    if (membershipAccess.debeGestionar(error)) {
      membershipAccess.handleSuscripcionRequerida();
    }
  }

  private isRefreshRequest(req: HttpRequest<any>): boolean {
    return /\/auth\/refresh\/?$/.test(req.url.split('?')[0]);
  }

  /** No reaccionar al propio reload de perfil (evita bucles). */
  private isProfileRequest(req: HttpRequest<any>): boolean {
    const path = req.url.split('?')[0];
    return /\/user\/(profile|me)\/?$/.test(path);
  }
}

/** Marca una solicitud ya reintentada para no entrar en un bucle de refresh. */
export const AUTH_REFRESH_RETRIED = new HttpContextToken<boolean>(() => false);
