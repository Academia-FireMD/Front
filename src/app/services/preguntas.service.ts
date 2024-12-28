import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  PaginatedResult,
  PaginationFilter,
} from '../shared/models/pagination.model';
import { Pregunta } from '../shared/models/pregunta.model';
import { ApiBaseService } from './api-base.service';

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

  public importarPreguntasExcel(file: FormData) {
    return this.post('/importar-excel', file);
  }

  public deletePregunta$(id: number) {
    return this.delete('/' + id);
  }
}
