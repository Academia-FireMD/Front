import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService } from '../../services/api-base.service';
import { PaginatedResult, PaginationFilter } from '../models/pagination.model';

export interface Modulo {
  id: number;
  nombre: string;
  descripcion?: string;
  esPublico: boolean;
  createdAt: Date;
  updatedAt: Date;
  _count?: {
    temas: number;
  };
}

export interface DeleteModuloResponse {
  deleted: Modulo;
  temasEliminados: number;
}

export interface ModuloDto {
  id?: number;
  nombre: string;
  descripcion?: string;
  esPublico: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ModuloService extends ApiBaseService {
  constructor(private http: HttpClient) {
    super(http);
    this.controllerPrefix = '/modulo';
  }

  getModulos$(): Observable<Modulo[]> {
    return this.get('/get-modulos') as Observable<Modulo[]>;
  }

  getModulosPaginados$(filter: PaginationFilter): Observable<PaginatedResult<Modulo>> {
    return this.post('', filter) as Observable<PaginatedResult<Modulo>>;
  }

  getModulo$(id: number): Observable<Modulo> {
    return this.get(`/${id}`) as Observable<Modulo>;
  }

  updateModulo$(modulo: ModuloDto): Observable<Modulo> {
    return this.post('/update-modulo', modulo) as Observable<Modulo>;
  }

  deleteModulo$(id: number): Observable<DeleteModuloResponse> {
    return this.delete(`/${id}`) as Observable<DeleteModuloResponse>;
  }
}
