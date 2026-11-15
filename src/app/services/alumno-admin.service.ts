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
import {
  CatalogoExterno,
  InventarioExterno,
  ResultadoManual,
} from '../shared/models/alumno-externo.model';
@Injectable({ providedIn: 'root' })
export class AlumnoAdminService extends ApiBaseService {
  constructor(http: HttpClient) {
    super(http);
    this.controllerPrefix = '/user/admin';
  }
  detalle(id: number): Observable<FichaAlumno> {
    return this.get(`/${id}`, true);
  }
  inventario(id: number): Observable<InventarioExterno> {
    return this.get(`/${id}/accesos`, true);
  }
  consultarAlta(key: string): Observable<OperacionAlumno> {
    return this.get(`/externos/operaciones/${key}`, true);
  }
  catalogo(
    id: number,
    tipo: string,
    search = '',
    skip = 0,
  ): Observable<CatalogoExterno> {
    return this.get(
      `/${id}/catalogo?tipo=${tipo}&search=${encodeURIComponent(search)}&skip=${skip}&take=30`,
      true,
    );
  }
  accionManual(
    ruta: string,
    metodo: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    body: object,
    clave: string,
  ): Observable<ResultadoManual> {
    return this._http.request<ResultadoManual>(
      metodo,
      `${environment.apiUrl}/user/admin/${ruta}`,
      {
        body,
        withCredentials: true,
        headers: { 'Idempotency-Key': clave },
      },
    );
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
