import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService } from '../../services/api-base.service';
import {
  AccesoConCurso,
  CursoPublico,
  CursoSlugResponse,
  LeccionResponse,
  UpsertProgresoDto,
} from '../models/curso.model';

@Injectable({ providedIn: 'root' })
export class CursosAlumnoService extends ApiBaseService {
  constructor(private http: HttpClient) {
    super(http);
    this.controllerPrefix = '/cursos';
  }

  listMisCursos(): Observable<AccesoConCurso[]> {
    return this.get('/mios') as Observable<AccesoConCurso[]>;
  }

  listCatalogo(): Observable<CursoPublico[]> {
    return this.get('/catalogo') as Observable<CursoPublico[]>;
  }

  getCurso(slug: string): Observable<CursoSlugResponse> {
    return this.get(`/${slug}`) as Observable<CursoSlugResponse>;
  }

  getLeccion(id: number): Observable<LeccionResponse> {
    return this.get(`/lecciones/${id}`) as Observable<LeccionResponse>;
  }

  upsertProgreso(leccionId: number, dto: UpsertProgresoDto): Observable<void> {
    return this.post(
      `/lecciones/${leccionId}/progreso`,
      dto,
    ) as Observable<void>;
  }
}
