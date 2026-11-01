import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injector, inject } from '@angular/core';
import { Router } from '@angular/router';
import { isArray } from 'lodash';
import { ToastrService } from 'ngx-toastr';
import { catchError, Observable, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { REASON_SUSCRIPCION_REQUERIDA } from '../shared/models/subscription.model';

/**
 * Error HTTP normalizado por `ApiBaseService`.
 *
 * `handleError` conserva status/reason/body para que los componentes puedan
 * distinguir contratos estables (p.ej. 409 GESTION_EXTERNA_REQUERIDA) sin
 * inspeccionar el `Error` genérico. El interceptor sigue viendo el
 * `HttpErrorResponse` original antes de esta transformación.
 */
export interface ApiRequestError extends Error {
  status?: number;
  reason?: string;
  error?: unknown;
}

export class ApiBaseService {
  protected controllerPrefix = '';
  private _toast?: ToastrService;
  private _router?: Router;
  protected injector = inject(Injector);

  protected get toast(): ToastrService {
    if (!this._toast) {
      this._toast = this.injector.get(ToastrService);
    }
    return this._toast;
  }

  protected get router(): Router {
    if (!this._router) {
      this._router = this.injector.get(Router);
    }
    return this._router;
  }

  constructor(protected _http: HttpClient) {}

  public get(
    endpoint: string,
    ignoreError?: boolean,
    withCredentials = true,
  ): Observable<any> {
    return this._http
      .get(environment.apiUrl + this.controllerPrefix + endpoint, {
        withCredentials,
      })
      .pipe(catchError((err) => this.handleError(err, ignoreError)));
  }

  public delete(
    endpoint: string,
    ignoreError?: boolean,
    withCredentials = true,
  ): Observable<any> {
    return this._http
      .delete(environment.apiUrl + this.controllerPrefix + endpoint, {
        withCredentials,
      })
      .pipe(catchError((err) => this.handleError(err, ignoreError)));
  }

  public put(
    endpoint: string,
    body: any,
    ignoreError?: boolean,
  ): Observable<any> {
    return this._http
      .put(environment.apiUrl + this.controllerPrefix + endpoint, body, {
        withCredentials: true,
      })
      .pipe(catchError((err) => this.handleError(err, ignoreError)));
  }
  public post(
    endpoint: string,
    body: any,
    ignoreError?: boolean,
  ): Observable<any> {
    return this._http
      .post(environment.apiUrl + this.controllerPrefix + endpoint, body, {
        withCredentials: true,
      })
      .pipe(catchError((err) => this.handleError(err, ignoreError)));
  }

  public patch(
    endpoint: string,
    body: any,
    ignoreError?: boolean,
  ): Observable<any> {
    return this._http
      .patch(environment.apiUrl + this.controllerPrefix + endpoint, body, {
        withCredentials: true,
      })
      .pipe(catchError((err) => this.handleError(err, ignoreError)));
  }

  protected handleError(
    response: HttpErrorResponse,
    ignoreError: boolean = false,
  ): Observable<Object> {
    let message: any;

    if (response.error?.message) {
      if (typeof response.error?.message === 'string') {
        message = response.error?.message;
      } else if (isArray(response.error?.message)) {
        message = response.error.message.join(' ');
      } else {
        message = response.error?.message.message;
      }
    }

    const reason =
      typeof response.error?.reason === 'string'
        ? response.error.reason
        : undefined;
    const esDenegacionMembresia =
      response.status === 403 && reason === REASON_SUSCRIPCION_REQUERIDA;

    if (!ignoreError && !esDenegacionMembresia) {
      const toastMessage =
        response.status === 500
          ? 'Ocurrió un error interno. Vuelve a intentarlo en unos segundos.'
          : message || 'Ocurrió un error procesando la petición.';
      this.toast.error(toastMessage);
    }

    // Un 403 NO implica perder la sesión: puede ser una autorización de
    // negocio (membresía/tier/módulo). El interceptor decide el caso concreto
    // de SUSCRIPCION_REQUERIDA; el resto se propaga al componente. Solo un 401
    // sin refresh válido devuelve al login.
    if (response.status === 401) {
      this.router.navigate(['/auth']);
    }

    const apiError = new Error(message) as ApiRequestError;
    apiError.status = response.status;
    apiError.reason = reason;
    apiError.error = response.error;
    return throwError(() => apiError);
  }
}
