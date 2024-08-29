import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  PaginatedResult,
  PaginationFilter,
} from '../shared/models/pagination.model';
import {
  Dificultad,
  SeguridadAlResponder,
} from '../shared/models/pregunta.model';
import { Respuesta, Test } from '../shared/models/test.model';
import { ApiBaseService } from './api-base.service';
export interface RegistrarRespuestaDto {
  testId: number;
  preguntaId: number;
  respuestaDada: number;
  seguridad?: SeguridadAlResponder;
}
export interface GenerarTestDto {
  numPreguntas: number;
  dificultad: Dificultad;
  temas: Array<number>;
  generarTestDeRepaso: boolean;
  duracion: number;
}
@Injectable({
  providedIn: 'root',
})
export class TestService extends ApiBaseService {
  constructor(private http: HttpClient) {
    super(http);
    this.controllerPrefix = '/tests';
  }

  public sendFeedback(dto: {
    preguntaId: number;
    dificultadPercibida: Dificultad;
    comentario: string;
  }) {
    return this.post('/anyadir-feedback', dto);
  }

  public generarTest(dto: GenerarTestDto) {
    return this.post('/start', dto);
  }
  public getTestById(id: number) {
    return this.get('/por-id/' + id) as Observable<Test>;
  }

  public getAllTest() {
    return this.get('');
  }

  public getAllFinishedTest() {
    return this.get('/finished');
  }

  public obtenerFallosCount() {
    return this.get('/obtener-fallos-count') as Observable<number>;
  }

  public obtenerFallos(filter: PaginationFilter) {
    return this.post('/obtener-fallos', filter) as Observable<
      PaginatedResult<Respuesta>
    >;
  }

  public actualizarProgresoTest(dto: RegistrarRespuestaDto) {
    return this.post('/registrar-respuesta', dto);
  }

  public eliminarTest(idTest: number) {
    return this.delete('/' + idTest);
  }

  public getStats(idTest: number) {
    return this.get('/test-stats/' + idTest);
  }
}
