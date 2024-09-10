import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  EstadoFlashcard,
  FlashcardData,
  FlashcardTest,
} from '../shared/models/flashcard.model';
import {
  PaginatedResult,
  PaginationFilter,
} from '../shared/models/pagination.model';
import { Dificultad } from '../shared/models/pregunta.model';
import { ApiBaseService } from './api-base.service';
export interface RegistrarFlashcardRespuestaDto {
  testId: number; // El ID del test de flashcards
  testItemId: number; // Relación con el ítem del test que contiene la flashcard
  flashcardId: number; // El ID de la flashcard
  estado: EstadoFlashcard; // Estado de la respuesta: BIEN, MAL, REVISAR
}
export interface GenerarFlashcardTestDto {
  numPreguntas: number;
  dificultad: Dificultad;
  temas: Array<number>;
  generarTestDeRepaso: boolean;
}
@Injectable({
  providedIn: 'root',
})
export class FlashcardDataService extends ApiBaseService {
  constructor(private http: HttpClient) {
    super(http);
    this.controllerPrefix = '/flashcards';
  }

  public getFlashcards$(filter: PaginationFilter) {
    return this.post('', filter) as Observable<PaginatedResult<FlashcardData>>;
  }

  public importarExcel(file: FormData) {
    return this.post('/importar-excel', file);
  }

  public updateFlashcard$(flashcard: Partial<FlashcardData>) {
    return this.post(
      '/update-flashcard',
      flashcard
    ) as Observable<FlashcardData>;
  }

  public obtenerFallosCount() {
    return this.get('/obtener-fallos-count') as Observable<number>;
  }

  public getFlashcardById(id: number) {
    return this.get('/' + id) as Observable<FlashcardData>;
  }

  public deleteFlashcard$(id: number) {
    return this.delete('/' + id);
  }

  public actualizarProgresoTest(dto: RegistrarFlashcardRespuestaDto) {
    return this.post('/registrar-respuesta', dto);
  }

  public getTestById(id: number) {
    return this.get('/por-id/' + id);
  }

  public getAllTest() {
    return this.get('/tests');
  }

  public eliminarTest(idTest: number) {
    return this.delete('/delete-test/' + idTest);
  }

  public generarTest(dto: GenerarFlashcardTestDto) {
    return this.post('/start-test', dto);
  }

  public getStats(idTest: number) {
    return this.get('/test-stats/' + idTest);
  }

  public getAllFinishedTest() {
    return this.get('/finished') as Observable<Array<FlashcardTest>>;
  }
}
