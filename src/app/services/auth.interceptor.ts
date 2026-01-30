import {
  HttpErrorResponse,
  HttpEvent,
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
    next: HttpHandler
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
        if (error.status === 401 && authSvc.getRefreshToken()) {
          // Si el access token ha expirado, intenta renovar usando el refresh token
          return authSvc.refreshToken$().pipe(
            switchMap(() => {
              // Obtén el nuevo token y clona nuevamente la solicitud original
              const newToken = authSvc.getToken();
              const newRequest = req.clone({
                headers: req.headers.set('Authorization', `Bearer ${newToken}`),
              });
              return next.handle(newRequest);
            }),
            catchError((refreshError) => {
              // Si el refresh token también falla, cierra sesión
              authSvc.clearToken();
              authSvc.clearRefreshToken();
              return throwError(() => refreshError);
            })
          );
        }

        // Si el error no es 401, propaga el error
        return throwError(() => error);
      })
    );
  }
}
