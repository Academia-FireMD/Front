import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiBaseService } from '../../services/api-base.service';
import type { NivelOposicion } from '../../shared/models/pregunta.model';
import type {
  AlumnoSinCoincidencia,
  ConfiguracionPlanificacion,
  GuardarConfiguracionDTO,
  RecomendacionNivel,
  ReglaOposicionAdmin,
  VarianteAdmin,
} from '../models/autoasignacion.model';

/**
 * Cliente de la Fase 1 autoasignación (contrato FIJO definido en el plan:
 * `.kimi-code/plans/fase1-autoasignacion-frontend.md`). Todos los endpoints
 * viven bajo `/planificaciones`.
 *
 * `guardarConfiguracion` hace la llamada HTTP en bruto (sin pasar por
 * `ApiBaseService.put`, que descarta el status) porque el asistente necesita
 * distinguir 409 (versión desfasada) / 422 `SIN_VARIANTE` / 403.
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
  ): Observable<RecomendacionNivel> {
    return this.post('/recomendacion-nivel', {
      respuestas,
    }) as Observable<RecomendacionNivel>;
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
    },
  ): Observable<ConfiguracionPlanificacion> {
    return this.post(
      `/tutor/${alumnoId}/forzar`,
      body,
    ) as Observable<ConfiguracionPlanificacion>;
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
    data: Partial<VarianteAdmin>,
  ): Observable<VarianteAdmin> {
    return this.patch(
      '/admin/variantes/' + id,
      data,
    ) as Observable<VarianteAdmin>;
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
    data: Partial<ReglaOposicionAdmin>,
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
}
