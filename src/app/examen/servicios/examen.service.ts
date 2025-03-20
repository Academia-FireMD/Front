import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ApiBaseService } from '../../services/api-base.service';
import { PaginatedResult, PaginationFilter } from '../../shared/models/pagination.model';
import { Examen } from '../models/examen.model';
@Injectable({
  providedIn: 'root',
})
export class ExamenesService extends ApiBaseService {
  constructor(private http: HttpClient) {
    super(http);
    this.controllerPrefix = '/examenes';
  }


  public updatePreguntaReservaStatus$(
    examenId: number,
    preguntaId: number,
    esReserva: boolean
  ): Observable<any> {
    return this.put(`/${examenId}/preguntas/${preguntaId}/reserva`, { esReserva }) as Observable<any>;
  }

  // Métodos para administradores
  public getExamenes$(
    pagination: PaginationFilter
  ): Observable<PaginatedResult<Examen>> {
    return this.post('/listar', pagination) as Observable<PaginatedResult<Examen>>;
  }

  public getExamenById$(id: number): Observable<Examen> {
    return this.get(`/${id}`) as Observable<Examen>;
  }

  public createExamen$(examen: any): Observable<Examen> {
    return this.post('/crear', examen) as Observable<Examen>;
  }

  public updateExamen$(id: number, examen: any): Observable<Examen> {
    return this.put(`/${id}`, examen) as Observable<Examen>;
  }

  public deleteExamen$(id: number): Observable<any> {
    return this.delete(`/${id}`) as Observable<any>;
  }

  public publicarExamen$(id: number): Observable<Examen> {
    return this.post(`/${id}/publicar`, {}) as Observable<Examen>;
  }

  public archivarExamen$(id: number): Observable<Examen> {
    return this.post(`/${id}/archivar`, {}) as Observable<Examen>;
  }

  public addPreguntasToExamen$(
    examenId: number,
    preguntaIds: number[]
  ): Observable<any> {
    return this.post(`/${examenId}/preguntas`, {
      preguntaIds,
    }) as Observable<any>;
  }



  public removePreguntasFromExamen$(
    examenId: number,
    preguntaIds: number[]
  ): Observable<any> {
    return this.post(`/${examenId}/eliminar-preguntas`, {
      preguntaIds,
    }) as Observable<any>;
  }

  // Métodos para alumnos
  public getExamenesDisponibles$(
    pagination: PaginationFilter
  ): Observable<PaginatedResult<Examen>> {
    return this.post('/disponibles', pagination) as Observable<PaginatedResult<Examen>>;
  }

  public startExamen$(examenId: number): Observable<any> {
    return this.post(`/iniciar/${examenId}`, {}) as Observable<any>;
  }

  public getResultadosExamenes$(): Observable<any> {
    return this.get('/resultados') as Observable<any>;
  }

  public updatePreguntasOrder$(examenId: number, preguntaIds: number[]) {
    return this.put(`/${examenId}/preguntas/order`, {
      preguntaIds
    }) as Observable<any>;
  }



  public downloadExamenWithFilename$(id: number, examenName: string): Observable<{ blob: Blob, filename: string }> {
    return this.http.get(`${environment.apiUrl}${this.controllerPrefix}/download-word/${id}`, {
      observe: 'response',
      responseType: 'blob'
    }).pipe(
      map(response => {
        // Extraer el nombre del archivo del header Content-Disposition
        const contentDisposition = response.headers.get('Content-Disposition') || '';

        // Asegurarse de que el nombre del archivo esté correctamente formateado para HTTP
        const safeFilename = examenName.replace(/ /g, '_').toLowerCase();
        let filename = `${safeFilename}_${+new Date()}.docx`;

        // Intentar extraer el nombre del archivo con diferentes patrones
        const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
        const matches = filenameRegex.exec(contentDisposition);
        if (matches != null && matches[1]) {
          filename = matches[1].replace(/['"]/g, '');
          // Decodificar el nombre del archivo si está codificado
          try {
            filename = decodeURIComponent(filename);
          } catch (e) {
            console.warn('Error al decodificar el nombre del archivo', e);
          }
        }

        console.log('Nombre de archivo extraído:', filename);

        return {
          blob: response.body as Blob,
          filename: filename
        };
      })
    );
  }
}
