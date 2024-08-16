import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  PaginatedResult,
  PaginationFilter,
} from '../shared/models/pagination.model';
import { Usuario } from '../shared/models/user.model';
import { ApiBaseService } from './api-base.service';

@Injectable({
  providedIn: 'root',
})
export class UserService extends ApiBaseService {
  constructor(private http: HttpClient) {
    super(http);
    this.controllerPrefix = '/user';
  }

  public getNonVerifiedUsers$(filter: PaginationFilter) {
    return this.post('/pending', filter) as Observable<
      PaginatedResult<Usuario>
    >;
  }

  public permitirUsuario(userId: number) {
    return this.get('/approve/' + userId);
  }

  public denegarUsuario(userId: number) {
    return this.get('/deny/' + userId);
  }
}
