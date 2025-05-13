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

  public getCurrentUser$(): Observable<Usuario> {
    return this.get('/me') as Observable<Usuario>;
  }

  public uploadAvatar$(formData: FormData): Observable<Usuario> {
    return this.post('/upload-avatar', formData) as Observable<Usuario>; // Retorna la URL del avatar subido
  }

  public getByEmail$(email: string) {
    return this.post('/get-by-email', { email }) as Observable<Usuario>;
  }

  public getNonVerifiedUsers$(filter: PaginationFilter) {
    return this.post('/pending', filter) as Observable<
      PaginatedResult<Usuario>
    >;
  }

  public getVerifiedUsers$(filter: PaginationFilter) {
    return this.post('/validated', filter) as Observable<
      PaginatedResult<Usuario>
    >;
  }

  public getAllUsers$(filter: PaginationFilter) {
    return this.post('/all', filter) as Observable<PaginatedResult<Usuario>>;
  }

  public getAllTutores$() {
    return this.get('/tutores') as Observable<Usuario[]>;
  }

  public permitirUsuario(userId: number) {
    return this.get('/approve/' + userId);
  }

  public denegarUsuario(userId: number) {
    return this.get('/deny/' + userId);
  }

  public eliminarUsuario(userId: number) {
    return this.get('/delete/' + userId);
  }

  public updateUser(userId: number, userToUpdate: Partial<Usuario>) {
    return this.post('/update/' + userId, userToUpdate);
  }
}
