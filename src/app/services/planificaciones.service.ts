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

// Interfaz para la actualización de progreso
export interface ProgresoSubBloqueDTO {
  subBloqueId: number;
  realizado?: boolean;
  comentariosAlumno?: string;
}

// Definir interfaz para eventos personalizados
export interface EventoPersonalizadoDTO {
  id?: number;
  planificacionId: number;
  nombre: string;
  descripcion?: string;
  horaInicio: Date;
  duracion: number;
  color?: string;
  importante?: boolean;
  tiempoAviso?: number;
  realizado?: boolean;
}

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

  public getPlanificacionesPorDefecto$(tipoDePlanificacion: TipoDePlanificacionDeseada) {
    return this.post('/planificaciones-por-defecto', { tipoDePlanificacion }) as Observable<PlanificacionMensual[]>;
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

  public clonarBloque$(id: number) {
    return this.post('/bloque/clonar/' + id, null);
  }

  public clonarPlantillaSemanal$(id: number) {
    return this.post('/plantilla-semanal/clonar/' + id, null);
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

  // NUEVO: Método para actualizar el progreso de un subbloque
  public actualizarProgresoSubBloque$(dto: {
    subBloqueId: number;
    planificacionId: number;
    realizado?: boolean;
    comentariosAlumno?: string;
    posicionPersonalizada?: Date;
  }): Observable<any> {
    return this.post('/actualizar-progreso-subbloque', dto);
  }

  // Métodos para eventos personalizados
  public getEventosPersonalizados$(planificacionId: number): Observable<any[]> {
    return this.get(`/eventos-personalizados/${planificacionId}`);
  }

  public crearEventoPersonalizado$(dto: EventoPersonalizadoDTO): Observable<any> {
    return this.post('/eventos-personalizados', dto);
  }

  public actualizarEventoPersonalizado$(dto: EventoPersonalizadoDTO): Observable<any> {
    return this.post('/eventos-personalizados/actualizar', dto);
  }

  public eliminarEventoPersonalizado$(id: number): Observable<any> {
    return this.delete(`/eventos-personalizados/${id}`);
  }

  // Método específico para actualizar solo el estado "realizado" de un evento personalizado
  public actualizarEventoPersonalizadoRealizado$(id: number, planificacionId: number, realizado: boolean): Observable<any> {
    return this.post('/eventos-personalizados/actualizar-realizado', {
      id,
      planificacionId,
      realizado
    });
  }

  public desvincularPlanificacionMensual$(id: number): Observable<any> {
    return this.post(`/desvincular-planificacion-mensual/${id}`, null);
  }

  public desvincularPlanificacionMensualAdmin$(planificacionId: number, alumnoId: number): Observable<any> {
    return this.post(`/desvincular-planificacion-mensual-admin/${planificacionId}/${alumnoId}`, null);
  }
}
