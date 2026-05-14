import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService } from '../../services/api-base.service';
import type { components } from '../../api/schema';
import {
  Curso,
  CursoAdmin,
  CursoDetail,
  LeccionReorderItem,
  Leccion,
  Seccion,
  SeccionReorderItem,
  TusCredentials,
} from '../models/curso.model';

type CursoCreateDto = components['schemas']['CursoCreateDto'];
type CursoUpdateDto = components['schemas']['CursoUpdateDto'];
type SeccionCreateDto = components['schemas']['SeccionCreateDto'];
type LeccionCreateDto = components['schemas']['LeccionCreateDto'];
type LeccionUpdateDto = components['schemas']['LeccionUpdateDto'];

@Injectable({ providedIn: 'root' })
export class CursosAdminService extends ApiBaseService {
  constructor(private http: HttpClient) {
    super(http);
    this.controllerPrefix = '/cursos';
  }

  list(): Observable<CursoAdmin[]> {
    return this.get('/admin') as Observable<CursoAdmin[]>;
  }

  getCurso(id: number): Observable<CursoDetail> {
    return this.get(`/admin/${id}`) as Observable<CursoDetail>;
  }

  create(dto: CursoCreateDto): Observable<Curso> {
    return this.post('', dto) as Observable<Curso>;
  }

  update(id: number, dto: CursoUpdateDto): Observable<Curso> {
    return this.put(`/${id}`, dto) as Observable<Curso>;
  }

  remove(id: number): Observable<void> {
    return this.delete(`/${id}`) as Observable<void>;
  }

  publicar(id: number): Observable<Curso> {
    return this.post(`/${id}/publicar`, {}) as Observable<Curso>;
  }

  archivar(id: number): Observable<Curso> {
    return this.post(`/${id}/archivar`, {}) as Observable<Curso>;
  }

  grantAccess(cursoId: number, usuarioId: number): Observable<unknown> {
    return this.post(`/${cursoId}/grant-access`, { usuarioId });
  }

  createSeccion(cursoId: number, dto: SeccionCreateDto): Observable<Seccion> {
    return this.post(`/${cursoId}/secciones`, dto) as Observable<Seccion>;
  }

  updateSeccion(
    id: number,
    dto: Partial<SeccionCreateDto>,
  ): Observable<Seccion> {
    return this.put(`/secciones/${id}`, dto) as Observable<Seccion>;
  }

  deleteSeccion(id: number): Observable<void> {
    return this.delete(`/secciones/${id}`) as Observable<void>;
  }

  reorderSecciones(items: SeccionReorderItem[]): Observable<void> {
    return this.put('/secciones/reorder', { items }) as Observable<void>;
  }

  createLeccion(seccionId: number, dto: LeccionCreateDto): Observable<Leccion> {
    return this.post(
      `/secciones/${seccionId}/lecciones`,
      dto,
    ) as Observable<Leccion>;
  }

  updateLeccion(id: number, dto: LeccionUpdateDto): Observable<Leccion> {
    return this.put(`/lecciones/${id}`, dto) as Observable<Leccion>;
  }

  deleteLeccion(id: number): Observable<void> {
    return this.delete(`/lecciones/${id}`) as Observable<void>;
  }

  reorderLecciones(items: LeccionReorderItem[]): Observable<void> {
    return this.put('/lecciones/reorder', { items }) as Observable<void>;
  }

  requestVideoUploadUrl(title: string): Observable<TusCredentials> {
    return this.post('/videos/upload-url', {
      title,
    }) as Observable<TusCredentials>;
  }
}
