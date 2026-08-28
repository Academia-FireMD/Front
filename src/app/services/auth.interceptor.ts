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

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private authService!: AuthService;

  constructor(private injector: Injector) {}

  private getAuthService(): AuthService {
    if (!this.authService) {
      this.authService = this.injector.get(AuthService);
    }
    return this.authService;
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
          // Si el access token ha expirado, intenta renovar usando el refresh token
          return authSvc.refreshToken$().pipe(
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
                  return throwError(() => error);
                }
                const newRequest = req.clone({
                  context: req.context.set(AUTH_REFRESH_RETRIED, true),
                  headers: req.headers.set(
                    'Authorization',
                    `Bearer ${newToken}`,
                  ),
                });
                return next.handle(newRequest);
              },
            ),
            catchError((refreshError) => {
              // Si el refresh token también falla, cierra sesión
              authSvc.clearToken();
              authSvc.clearRefreshToken();
              return throwError(() => refreshError);
            }),
          );
        }

        // Si el error no es 401, propaga el error
        return throwError(() => error);
      }),
    );
  }

  private isRefreshRequest(req: HttpRequest<any>): boolean {
    return /\/auth\/refresh\/?$/.test(req.url.split('?')[0]);
  }
}

/** Marca una solicitud ya reintentada para no entrar en un bucle de refresh. */
export const AUTH_REFRESH_RETRIED = new HttpContextToken<boolean>(() => false);
