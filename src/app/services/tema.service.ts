import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  PaginatedResult,
  PaginationFilter,
} from '../shared/models/pagination.model';
import { Tema } from '../shared/models/pregunta.model';
import { ApiBaseService } from './api-base.service';

@Injectable({
  providedIn: 'root',
})
export class TemaService extends ApiBaseService {
  constructor(private http: HttpClient) {
    super(http);
    this.controllerPrefix = '/tema';
  }

  public getPaginatedTemas$(filter: PaginationFilter) {
    return this.post('', filter) as Observable<PaginatedResult<Tema>>;
  }

  public getAllTemas$() {
    return this.get('/get-temas') as Observable<Array<Tema>>;
  }

  public deleteTema$(id: number) {
    return this.delete('/' + id);
  }
  public getTema$(id: number) {
    return this.get('/' + id);
  }

  public updateTema$(tema: Partial<Tema>) {
    return this.post('/update-tema', tema) as Observable<Tema>;
  }
}
