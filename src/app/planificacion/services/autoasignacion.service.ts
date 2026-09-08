import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiBaseService } from '../../services/api-base.service';
import type { NivelOposicion } from '../../shared/models/pregunta.model';
import type {
  AlumnoPlanificacionTutor,
  AlumnoSinCoincidencia,
  ConfiguracionPlanificacion,
  CuestionarioNivel,
  GuardarConfiguracionDTO,
  RecomendacionNivel,
  ReglaOposicionAdmin,
  ReconciliacionPlanificaciones,
  VarianteAdmin,
} from '../models/autoasignacion.model';

export type ActualizarVarianteAdminDTO = {
  activa: boolean;
  planificacionMensualId: number | null;
};

export type ActualizarReglaAdminDTO = {
  activa: boolean;
};

/**
 * Cliente de la Fase 1 autoasignación (contrato FIJO definido en el plan:
 * `.kimi-code/plans/fase1-autoasignacion-frontend.md`). Todos los endpoints
 * viven bajo `/planificaciones`.
 *
 * `recomendarNivel` y `guardarConfiguracion` hacen la llamada HTTP en bruto
 * (sin pasar por `ApiBaseService`, que descarta el status) porque el asistente
 * necesita distinguir 409 (versión desfasada) / 422 `SIN_VARIANTE` / 403.
 */
@Injectable({
  providedIn: 'root',
})
export class AutoasignacionService extends ApiBaseService {
  constructor(private http: HttpClient) {
    super(http);
    this.controllerPrefix = '/planificaciones';
  }

  public getConfiguracion$(): Observable<ConfiguracionPlanificacion> {
    return this.get('/configuracion') as Observable<ConfiguracionPlanificacion>;
  }

  public recomendarNivel$(
    respuestas: number[],
    versionCuestionario: number,
  ): Observable<RecomendacionNivel> {
    return this.http.post<RecomendacionNivel>(
      environment.apiUrl + '/planificaciones/recomendacion-nivel',
      { respuestas, versionCuestionario },
      { withCredentials: true },
    );
  }

  public getCuestionarioNivel$(): Observable<CuestionarioNivel> {
    return this.get('/cuestionario-nivel') as Observable<CuestionarioNivel>;
  }

  /** PUT en bruto: conserva el HttpErrorResponse para gestionar 409/422/403. */
  public guardarConfiguracion$(
    body: GuardarConfiguracionDTO,
  ): Observable<ConfiguracionPlanificacion> {
    return this.http.put<ConfiguracionPlanificacion>(
      environment.apiUrl + '/planificaciones/configuracion',
      body,
      { withCredentials: true },
    );
  }

  public recomendarNivelTutor$(
    alumnoId: number,
    nivel: NivelOposicion,
  ): Observable<{ ok: boolean; nivel?: NivelOposicion }> {
    return this.post(`/tutor/${alumnoId}/recomendar`, {
      nivel,
    }) as Observable<{ ok: boolean; nivel?: NivelOposicion }>;
  }

  public forzarConfiguracionTutor$(
    alumnoId: number,
    body: {
      oposicion: string;
      nivel: NivelOposicion;
      franja: string;
      motivo: string;
      version: number;
    },
  ): Observable<ConfiguracionPlanificacion> {
    return this.post(
      `/tutor/${alumnoId}/forzar`,
      body,
    ) as Observable<ConfiguracionPlanificacion>;
  }

  /** Alumnos visibles para el tutor actual (o para un admin autorizado). */
  public getTutorAlumnos$(): Observable<AlumnoPlanificacionTutor[]> {
    return this.get('/tutor/alumnos') as Observable<AlumnoPlanificacionTutor[]>;
  }

  /** Configuración acotada de un alumno para el diálogo admin legacy. */
  public getAdminAlumnoConfiguracion$(
    alumnoId: number,
  ): Observable<AlumnoPlanificacionTutor> {
    return this.get(
      `/admin/alumnos/${alumnoId}/configuracion`,
    ) as Observable<AlumnoPlanificacionTutor>;
  }

  public getVariantes$(): Observable<VarianteAdmin[]> {
    return this.get('/admin/variantes') as Observable<VarianteAdmin[]>;
  }

  public crearVariante$(
    data: Omit<VarianteAdmin, 'id'>,
  ): Observable<VarianteAdmin> {
    return this.post('/admin/variantes', data) as Observable<VarianteAdmin>;
  }

  public actualizarVariante$(
    id: number,
    data: ActualizarVarianteAdminDTO,
  ): Observable<VarianteAdmin> {
    return this.patch(
      '/admin/variantes/' + id,
      data,
    ) as Observable<VarianteAdmin>;
  }

  public publicarVariante$(
    id: number,
    planificacionMensualId: number,
  ): Observable<VarianteAdmin> {
    return this.post(`/admin/variantes/${id}/publicar`, {
      planificacionMensualId,
    }) as Observable<VarianteAdmin>;
  }

  public getReglas$(): Observable<ReglaOposicionAdmin[]> {
    return this.get('/admin/reglas') as Observable<ReglaOposicionAdmin[]>;
  }

  public crearRegla$(
    data: Omit<ReglaOposicionAdmin, 'id'>,
  ): Observable<ReglaOposicionAdmin> {
    return this.post('/admin/reglas', data) as Observable<ReglaOposicionAdmin>;
  }

  public actualizarRegla$(
    id: number,
    data: ActualizarReglaAdminDTO,
  ): Observable<ReglaOposicionAdmin> {
    return this.patch(
      '/admin/reglas/' + id,
      data,
    ) as Observable<ReglaOposicionAdmin>;
  }

  public getSinCoincidencia$(): Observable<AlumnoSinCoincidencia[]> {
    return this.get('/admin/sin-coincidencia') as Observable<
      AlumnoSinCoincidencia[]
    >;
  }

  public reconciliar$(
    aplicar: boolean,
    previewHash?: string | null,
  ): Observable<ReconciliacionPlanificaciones> {
    return this.post('/admin/reconciliar', {
      aplicar,
      ...(aplicar && previewHash ? { previewHash } : {}),
    }) as Observable<ReconciliacionPlanificaciones>;
  }
}
