import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  PaginatedResult,
  PaginationFilter,
} from '../shared/models/pagination.model';
import {
  PlanificacionBloque,
  PlanificacionMensual,
  PlantillaSemanal,
} from '../shared/models/planificacion.model';
import { TipoDePlanificacionDeseada } from '../shared/models/user.model';
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

  public getPlantillaSemanalById(id: number) {
    return this.get(
      '/plantillas-semanales/' + id
    ) as Observable<PlantillaSemanal>;
  }

  public getPlanificacionMensualById$(id: number) {
    return this.get(
      '/planificaciones-mensuales/' + id
    ) as Observable<PlanificacionMensual>;
  }

  public getBloques$(filter: PaginationFilter) {
    return this.post('/bloques', filter) as Observable<
      PaginatedResult<PlanificacionBloque>
    >;
  }

  public getPlantillaSemanales$(filter: PaginationFilter) {
    return this.post('/plantillas-semanales', filter) as Observable<
      PaginatedResult<PlantillaSemanal>
    >;
  }

  public getComentariosAlumnos$(filter: PaginationFilter) {
    return this.post(
      '/comentarios-alumnos-planificacion',
      filter
    ) as Observable<PaginatedResult<any>>;
  }

  public getPlanificacionMensual$(filter: PaginationFilter) {
    return this.post('/planificaciones-mensuales', filter) as Observable<
      PaginatedResult<PlanificacionMensual>
    >;
  }

  public getPlanificacionMensualAlumno$(filter: PaginationFilter) {
    return this.post('/planificaciones-mensuales-alumno', filter) as Observable<
      PaginatedResult<PlanificacionMensual>
    >;
  }

  public createPlanificacionMensual$(
    data: Partial<PlanificacionMensual>
  ): Observable<PlanificacionMensual> {
    return this.post(
      '/planificacion-mensual',
      data
    ) as Observable<PlanificacionMensual>;
  }

  public createPlantillaSemanal$(
    data: Partial<PlantillaSemanal>
  ): Observable<PlantillaSemanal> {
    return this.post(
      '/plantilla-semanal',
      data
    ) as Observable<PlantillaSemanal>;
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

  public deletePlantillaSemanal$(id: number) {
    return this.delete('/plantilla-semanal/' + id);
  }

  public deletePlanificacionMensual$(id: number) {
    return this.delete('/planificacion-mensual/' + id);
  }

  public clonarPlanificacionMensual$(id: number) {
    return this.post('/planificacion-mensual/clonar/' + id, null);
  }

  public asignarPlanificacionMensual$(
    planificacionId: number,
    alumnosIds: number[]
  ): Observable<any> {
    return this.post('/asignar-planificacion-mensual', {
      planificacionId,
      alumnosIds,
    });
  }

  public getInfoPlanificacionesAsignadas() {
    return this.get('/count-planificationes-asignadas');
  }

  public autoAssignPlanificacionMensual(
    tipoDePlanificacion: TipoDePlanificacionDeseada
  ) {
    return this.post('/auto-assign-planificacion-mensual', {
      tipoDePlanificacion,
    });
  }

  public autoAssignPlanificacionMensualAll() {
    return this.post('/auto-assign-planificacion-mensual-all', {});
  }
}
