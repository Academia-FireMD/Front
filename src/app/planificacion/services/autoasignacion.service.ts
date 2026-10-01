import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiBaseService } from '../../services/api-base.service';
import type {
  ConfiguracionPlanificacion,
  CuestionarioNivel,
  GuardarConfiguracionDTO,
  RecomendacionNivel,
} from '../models/autoasignacion.model';

/** La recomendación no guarda nada: solo Confirmar cambia el calendario. */
@Injectable({ providedIn: 'root' })
export class AutoasignacionService extends ApiBaseService {
  constructor(private readonly http: HttpClient) {
    super(http);
    this.controllerPrefix = '/planificaciones';
  }

  getConfiguracion$(): Observable<ConfiguracionPlanificacion> {
    return this.get('/configuracion') as Observable<ConfiguracionPlanificacion>;
  }

  getCuestionarioNivel$(): Observable<CuestionarioNivel> {
    return this.get('/cuestionario-nivel') as Observable<CuestionarioNivel>;
  }

  recomendarNivel$(
    respuestas: number[],
    versionCuestionario: number,
  ): Observable<RecomendacionNivel> {
    return this.http.post<RecomendacionNivel>(
      `${environment.apiUrl}/planificaciones/recomendacion-nivel`,
      { respuestas, versionCuestionario },
      { withCredentials: true },
    );
  }

  guardarConfiguracion$(
    body: GuardarConfiguracionDTO,
  ): Observable<ConfiguracionPlanificacion> {
    return this.http.put<ConfiguracionPlanificacion>(
      `${environment.apiUrl}/planificaciones/configuracion`,
      body,
      { withCredentials: true },
    );
  }
}
