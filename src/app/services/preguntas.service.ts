import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  PaginatedResult,
  PaginationFilter,
} from '../shared/models/pagination.model';
import { Dificultad, Pregunta } from '../shared/models/pregunta.model';
import { ApiBaseService } from './api-base.service';
import { GenerarTestDto } from './test.service';

@Injectable({
  providedIn: 'root',
})
export class PreguntasService extends ApiBaseService {
  constructor(private http: HttpClient) {
    super(http);
    this.controllerPrefix = '/preguntas';
  }

  public updatePregunta$(pregunta: Partial<Pregunta>) {
    return this.post('/update-pregunta', pregunta) as Observable<Pregunta>;
  }

  public getPreguntas$(filter: PaginationFilter) {
    return this.post('', filter) as Observable<PaginatedResult<Pregunta>>;
  }

  public getPreguntasAlumno$(filter: PaginationFilter) {
    return this.post('/alumno', filter) as Observable<
      PaginatedResult<Pregunta>
    >;
  }

  public getPreguntaById(id: number) {
    return this.get('/' + id) as Observable<Pregunta>;
  }

  public getPreguntaByIdentificador(identificador: string) {
    return this.get('/identificador/' + identificador) as Observable<Pregunta>;
  }

  public nextPregunta(id: string) {
    return this.get('/next/' + id) as Observable<Pregunta>;
  }

  public nextPreguntaForward(id: string) {
    return this.get('/next-forward/' + id) as Observable<Pregunta>;
  }

  public prevPregunta(id: string) {
    return this.get('/prev/' + id) as Observable<Pregunta>;
  }

  public prevPreguntaForward(id: string) {
    return this.get('/prev-forward/' + id) as Observable<Pregunta>;
  }

  public importarPreguntasExcel(file: FormData) {
    return this.post('/importar-excel', file);
  }

  public deletePregunta$(id: number) {
    return this.delete('/' + id);
  }

  public getAllPreguntasCreadosPorAlumnos() {
    return this._http.post(
      environment.apiUrl +
      this.controllerPrefix +
      '/preguntas-creadas-por-alumnos',
      {},
      { responseType: 'blob' }
    );
  }

  public getAllPreguntasByFilter$(dto: GenerarTestDto) {
    return this.post('/get-all-preguntas-by-filter', dto) as Observable<
      Pregunta[]
    >;
  }

  public descargarPlantillaImportacion() {
    return this._http.get(
      environment.apiUrl + this.controllerPrefix + '/plantilla-importacion',
      { responseType: 'blob' }
    );
  }

  public exportarPreguntasExcel(temaIds?: number[], soloAlumnos?: boolean, dificultad?: Dificultad): Observable<Blob> {
    let url = `${environment.apiUrl}${this.controllerPrefix}/exportar/excel`;
    const params: string[] = [];

    if (temaIds && temaIds.length > 0) {
      params.push(`temaIds=${temaIds.join(',')}`);
    }

    if (soloAlumnos !== undefined) {
      params.push(`soloAlumnos=${soloAlumnos}`);
    }

    if (dificultad) {
      params.push(`dificultad=${dificultad}`);
    }
    if (params.length > 0) {
      url += `?${params.join('&')}`;
    }

    return this._http.get(url, { responseType: 'blob' });
  }

  public exportarPreguntasWord(temaIds?: number[], soloAlumnos?: boolean, dificultad?: Dificultad): Observable<Blob> {
    let url = `${environment.apiUrl}${this.controllerPrefix}/exportar/word`;
    const params: string[] = [];

    if (temaIds && temaIds.length > 0) {
      params.push(`temaIds=${temaIds.join(',')}`);
    }

    if (soloAlumnos !== undefined) {
      params.push(`soloAlumnos=${soloAlumnos}`);
    }

    if (dificultad) {
      params.push(`dificultad=${dificultad}`);
    }

    if (params.length > 0) {
      url += `?${params.join('&')}`;
    }

    return this._http.get(url, { responseType: 'blob' });
  }
}
