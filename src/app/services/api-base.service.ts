import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { isArray } from 'lodash';
import { ToastrService } from 'ngx-toastr';
import { catchError, Observable, throwError } from 'rxjs';
import { environment } from '../../environments/environment';

export class ApiBaseService {
  protected controllerPrefix = '';
  protected toast = inject(ToastrService);
  protected router = inject(Router);

  constructor(protected _http: HttpClient) { }

  public get(
    endpoint: string,
    ignoreError?: boolean,
    withCredentials = true
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
    withCredentials = true
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
    ignoreError?: boolean
  ): Observable<any> {
    return this._http.put(environment.apiUrl + this.controllerPrefix + endpoint, body, { withCredentials: true })
      .pipe(catchError((err) => this.handleError(err, ignoreError)));
  }
  public post(
    endpoint: string,
    body: any,
    ignoreError?: boolean
  ): Observable<any> {
    return this._http
      .post(environment.apiUrl + this.controllerPrefix + endpoint, body, {
        withCredentials: true,
      })
      .pipe(catchError((err) => this.handleError(err, ignoreError)));
  }

  protected handleError(
    response: HttpErrorResponse,
    ignoreError: boolean = false
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

    if (response.status !== 500 && !!message) {
      if (!ignoreError) this.toast.error(message);
    }
    if (response.status == 401) {
      this.router.navigate(['/auth']);
    }

    return throwError(() => new Error(message));
  }
}
