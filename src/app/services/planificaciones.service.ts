import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  PaginatedResult,
  PaginationFilter,
} from '../shared/models/pagination.model';
import { PlanificacionBloque } from '../shared/models/planificacion.model';
import { ApiBaseService } from './api-base.service';

@Injectable({
  providedIn: 'root',
})
export class PlanificacionesService extends ApiBaseService {
  constructor(private http: HttpClient) {
    super(http);
    this.controllerPrefix = '/planificaciones';
  }

  public getBloqueById(id: number) {
    return this.get('/' + id) as Observable<PlanificacionBloque>;
  }

  public getBloques$(filter: PaginationFilter) {
    return this.post('/bloques', filter) as Observable<
      PaginatedResult<PlanificacionBloque>
    >;
  }

  public updateBloque$(pregunta: Partial<PlanificacionBloque>) {
    return this.post(
      '/actualizar-bloque',
      pregunta
    ) as Observable<PlanificacionBloque>;
  }

  public importarExcel(file: FormData) {
    return this.post('/importar-excel', file);
  }

  public deleteBloque$(id: number) {
    return this.delete('/' + id);
  }
}
