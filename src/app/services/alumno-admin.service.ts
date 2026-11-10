import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  FichaAlumno,
  WooAlumno,
  OperacionAlumno,
  PaginaActividadAlumno,
} from '../shared/models/alumno-admin.model';
import { ApiBaseService } from './api-base.service';
@Injectable({ providedIn: 'root' })
export class AlumnoAdminService extends ApiBaseService {
  constructor(http: HttpClient) {
    super(http);
    this.controllerPrefix = '/user/admin';
  }
  detalle(id: number): Observable<FichaAlumno> {
    return this.get(`/${id}`, true);
  }
  actividad(id: number, page = 1): Observable<PaginaActividadAlumno> {
    return this.get(`/${id}/actividad?page=${page}`, true);
  }
  woocommerce(id: number): Observable<WooAlumno> {
    return this.get(`/${id}/woocommerce`, true);
  }
  operacion(id: number, key: string): Observable<OperacionAlumno> {
    return this.get(`/${id}/operaciones/${key}`, true);
  }
  accionWoo(
    id: number,
    target: string,
    key: string,
    body: unknown,
  ): Observable<OperacionAlumno> {
    return this._http
      .post<OperacionAlumno>(
        `${environment.apiUrl}/user/admin/${id}/woocommerce/${target}`,
        body,
        { withCredentials: true, headers: { 'Idempotency-Key': key } },
      )
      .pipe(
        catchError((err) => this.handleError(err, true) as Observable<never>),
      );
  }
  eliminar(
    id: number,
    emailConfirmacion: string,
  ): Observable<{
    eliminado: boolean;
    usuarioId: number;
    operacionId: string;
  }> {
    return this._http
      .delete<{
        eliminado: boolean;
        usuarioId: number;
        operacionId: string;
      }>(`${environment.apiUrl}/user/${id}`, {
        body: { emailConfirmacion },
        withCredentials: true,
      })
      .pipe(
        catchError((err) => this.handleError(err, true) as Observable<never>),
      );
  }
}
