import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
} from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { AuthService } from './auth.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private authService: AuthService) {}

  intercept(
    req: HttpRequest<any>,
    next: HttpHandler
  ): Observable<HttpEvent<any>> {
    const authToken = this.authService.getToken();

    // Clonar la solicitud con el token si está presente
    let clonedRequest = req;
    if (authToken) {
      clonedRequest = req.clone({
        headers: req.headers.set('Authorization', `Bearer ${authToken}`),
      });
    }

    return next.handle(clonedRequest).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401 && this.authService.getRefreshToken()) {
          // Si el access token ha expirado, intenta renovar usando el refresh token
          return this.authService.refreshToken$().pipe(
            switchMap(() => {
              // Obtén el nuevo token y clona nuevamente la solicitud original
              const newToken = this.authService.getToken();
              const newRequest = req.clone({
                headers: req.headers.set('Authorization', `Bearer ${newToken}`),
              });
              return next.handle(newRequest);
            }),
            catchError((refreshError) => {
              // Si el refresh token también falla, cierra sesión
              this.authService.clearToken();
              this.authService.clearRefreshToken();
              return throwError(refreshError);
            })
          );
        }

        // Si el error no es 401, propaga el error
        return throwError(error);
      })
    );
  }
}
