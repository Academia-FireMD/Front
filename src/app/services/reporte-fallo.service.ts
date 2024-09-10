import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

import { Observable } from 'rxjs';
import {
  PaginatedResult,
  PaginationFilter,
} from '../shared/models/pagination.model';
import { PreguntaFallo } from '../shared/models/pregunta.model';
import { ApiBaseService } from './api-base.service';

@Injectable({
  providedIn: 'root',
})
export class ReportesFalloService extends ApiBaseService {
  constructor(private http: HttpClient) {
    super(http);
    this.controllerPrefix = '/reportes';
  }

  public reportarFallo(dto: { preguntaId: number; descripcion: string }) {
    return this.post('/fallo', dto);
  }

  public reportarFalloFlashcard(dto: {
    flashcardDataId: number;
    descripcion: string;
  }) {
    return this.post('/fallo-flashcard', dto);
  }

  public getReporteFallos$(filter: PaginationFilter) {
    return this.post('', filter) as Observable<PaginatedResult<PreguntaFallo>>;
  }
  public getReporteFallosFlashcards$(filter: PaginationFilter) {
    return this.post('/flashcards', filter) as Observable<
      PaginatedResult<PreguntaFallo>
    >;
  }

  public deleteReporteFallo$(id: number) {
    return this.delete('/' + id);
  }
}
