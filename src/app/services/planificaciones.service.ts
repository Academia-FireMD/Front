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
import {
  AplicarPlantillasSemanalesRequest,
  AplicarPlantillasSemanalesResponse,
} from '../planificacion/models/aplicar-plantillas-semanales.model';
import {
  CatalogoContenidoItem,
  ComponerContenidoResponse,
  TipoTrabajoCatalogo,
} from '../planificacion/models/catalogo-contenido.model';
import {
  VolcarPlantillasRequest,
  VolcarPlantillasResponse,
} from '../planificacion/models/volcar-plantillas.model';

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
      '/plantillas-semanales/' + id,
    ) as Observable<PlantillaSemanal>;
  }

  public getPlanificacionMensualById$(id: number) {
    return this.get(
      '/planificaciones-mensuales/' + id,
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
      filter,
    ) as Observable<PaginatedResult<any>>;
  }

  public getPlanificacionMensual$(filter: PaginationFilter) {
    return this.post('/planificaciones-mensuales', filter) as Observable<
      PaginatedResult<PlanificacionMensual>
    >;
  }

  public getPlanificacionesPorDefecto$(
    tipoDePlanificacion: TipoDePlanificacionDeseada,
  ) {
    return this.post('/planificaciones-por-defecto', {
      tipoDePlanificacion,
    }) as Observable<PlanificacionMensual[]>;
  }

  public getPlanificacionMensualAlumno$(filter: PaginationFilter) {
    return this.post('/planificaciones-mensuales-alumno', filter) as Observable<
      PaginatedResult<PlanificacionMensual>
    >;
  }

  public createPlanificacionMensual$(
    data: Partial<PlanificacionMensual>,
  ): Observable<PlanificacionMensual> {
    return this.post(
      '/planificacion-mensual',
      data,
    ) as Observable<PlanificacionMensual>;
  }

  public createPlantillaSemanal$(
    data: Partial<PlantillaSemanal>,
  ): Observable<PlantillaSemanal> {
    return this.post(
      '/plantilla-semanal',
      data,
    ) as Observable<PlantillaSemanal>;
  }

  public updateBloque$(pregunta: Partial<PlanificacionBloque>) {
    return this.post(
      '/actualizar-bloque',
      pregunta,
    ) as Observable<PlanificacionBloque>;
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

  /**
   * Fase 2 bridge temario↔física: enlaza un sub-bloque ENTRENAMIENTO por día
   * y normaliza los duplicados existentes.
   */
  public convertirBloquesFisica$(planificacionId: number): Observable<{
    actualizados: number;
    ignorados: number;
    sinCoincidencia: number;
    desmarcados?: number;
  }> {
    return this.post(
      `/planificacion-mensual/${planificacionId}/convertir-bloques-fisica`,
      {},
    ) as Observable<{
      actualizados: number;
      ignorados: number;
      sinCoincidencia: number;
      desmarcados?: number;
    }>;
  }

  public clonarBloque$(id: number) {
    return this.post('/bloque/clonar/' + id, null);
  }

  public clonarPlantillaSemanal$(id: number) {
    return this.post('/plantilla-semanal/clonar/' + id, null);
  }

  public getInfoPlanificacionesAsignadas() {
    return this.get('/count-planificationes-asignadas');
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

  public crearEventoPersonalizado$(
    dto: EventoPersonalizadoDTO,
  ): Observable<any> {
    return this.post('/eventos-personalizados', dto);
  }

  public actualizarEventoPersonalizado$(
    dto: EventoPersonalizadoDTO,
  ): Observable<any> {
    return this.post('/eventos-personalizados/actualizar', dto);
  }

  public eliminarEventoPersonalizado$(id: number): Observable<any> {
    return this.delete(`/eventos-personalizados/${id}`);
  }

  // Método específico para actualizar solo el estado "realizado" de un evento personalizado
  public actualizarEventoPersonalizadoRealizado$(
    id: number,
    planificacionId: number,
    realizado: boolean,
  ): Observable<any> {
    return this.post('/eventos-personalizados/actualizar-realizado', {
      id,
      planificacionId,
      realizado,
    });
  }

  /**
   * Fase 2: aplica una o varias plantillas semanales sobre planificaciones
   * mensuales, con soporte de preview server-side (preview: true).
   */
  public aplicarPlantillasSemanales$(
    body: AplicarPlantillasSemanalesRequest,
  ): Observable<AplicarPlantillasSemanalesResponse> {
    return this.post(
      '/aplicar-plantillas-semanales',
      body,
    ) as Observable<AplicarPlantillasSemanalesResponse>;
  }

  /**
   * Volcado completo de una variante importada (plantillas semanales cuyo
   * identificador termina en el prefijo dado) sobre una planificación mensual.
   * `dryRun: true` devuelve el resumen sin escribir nada.
   */
  public volcarPlantillas$(
    planificacionId: number,
    body: VolcarPlantillasRequest,
  ): Observable<VolcarPlantillasResponse> {
    return this.post(
      `/planificacion-mensual/${planificacionId}/volcar-plantillas`,
      body,
    ) as Observable<VolcarPlantillasResponse>;
  }

  /**
   * Fase 3: búsqueda de códigos de catálogo de contenido (máx. 10, solo activas).
   */
  public buscarCatalogoContenido(
    q: string,
  ): Observable<CatalogoContenidoItem[]> {
    return this.get(
      `/catalogo-contenido/buscar?q=${encodeURIComponent(q)}`,
    ) as Observable<CatalogoContenidoItem[]>;
  }

  /**
   * Fase 3: compone nombre, color y comentarios a partir de un código de catálogo.
   */
  public componerContenidoCatalogo(
    codigo: string,
    tipoTrabajo?: TipoTrabajoCatalogo,
  ): Observable<ComponerContenidoResponse> {
    return this.post(
      '/catalogo-contenido/componer',
      {
        codigo,
        tipoTrabajo,
      },
      true,
    ) as Observable<ComponerContenidoResponse>;
  }
}
