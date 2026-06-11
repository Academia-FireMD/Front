import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiBaseService } from '../../services/api-base.service';
import {
  PaginatedResult,
  PaginationFilter,
} from '../../shared/models/pagination.model';
import {
  Bloque,
  BloqueCreatePayload,
  BloqueReorderItem,
  BloqueUpdatePayload,
  Curso,
  CursoAdmin,
  CursoCreatePayload,
  CursoDetail,
  CursoUpdatePayload,
  LeccionCreatePayload,
  LeccionReorderItem,
  Leccion,
  LeccionUpdatePayload,
  Seccion,
  SeccionReorderItem,
  TusCredentials,
  WooCommerceProductSummary,
} from '../models/curso.model';

interface SeccionCreatePayload {
  titulo: string;
  orden: number;
}

@Injectable({ providedIn: 'root' })
export class CursosAdminService extends ApiBaseService {
  constructor(private http: HttpClient) {
    super(http);
    this.controllerPrefix = '/cursos';
  }

  /**
   * Refactor 2026-05-25 (D2): listado admin paginado. El backend acepta
   * `skip`, `take` y `searchTerm` como query params (no como body POST).
   */
  list(filter: PaginationFilter): Observable<PaginatedResult<CursoAdmin>> {
    const params: Record<string, string> = {
      skip: String(filter.skip ?? 0),
      take: String(filter.take ?? 10),
      searchTerm: filter.searchTerm ?? '',
    };
    const qs = new URLSearchParams(params).toString();
    return this.get(`/admin?${qs}`) as Observable<PaginatedResult<CursoAdmin>>;
  }

  getCurso(id: number): Observable<CursoDetail> {
    return this.get(`/admin/${id}`) as Observable<CursoDetail>;
  }

  create(dto: CursoCreatePayload): Observable<Curso> {
    return this.post('', dto) as Observable<Curso>;
  }

  /**
   * D15 — Optimistic locking. El payload incluye `updatedAt` obligatorio.
   * Si el backend devuelve 409 (curso modificado por otro admin), el caller
   * debe recargar — esta capa NO traga ese error: con `ignoreError=true`
   * el handleError no muestra toast y deja al caller actuar.
   */
  update(id: number, dto: CursoUpdatePayload): Observable<Curso> {
    return this.put(`/${id}`, dto, /* ignoreError */ true) as Observable<Curso>;
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

  /** BUG-002 fix counterpart — PUBLICADO/ARCHIVADO → BORRADOR. */
  despublicar(id: number): Observable<Curso> {
    return this.post(`/${id}/despublicar`, {}) as Observable<Curso>;
  }

  grantAccess(cursoId: number, usuarioId: number): Observable<unknown> {
    return this.post(`/${cursoId}/grant-access`, { usuarioId });
  }

  createSeccion(
    cursoId: number,
    dto: SeccionCreatePayload,
  ): Observable<Seccion> {
    return this.post(`/${cursoId}/secciones`, dto) as Observable<Seccion>;
  }

  updateSeccion(
    id: number,
    dto: Partial<SeccionCreatePayload>,
  ): Observable<Seccion> {
    return this.put(`/secciones/${id}`, dto) as Observable<Seccion>;
  }

  deleteSeccion(id: number): Observable<void> {
    return this.delete(`/secciones/${id}`) as Observable<void>;
  }

  reorderSecciones(items: SeccionReorderItem[]): Observable<void> {
    return this.put('/secciones/reorder', { items }) as Observable<void>;
  }

  createLeccion(
    seccionId: number,
    dto: LeccionCreatePayload,
  ): Observable<Leccion> {
    return this.post(
      `/secciones/${seccionId}/lecciones`,
      dto,
    ) as Observable<Leccion>;
  }

  updateLeccion(id: number, dto: LeccionUpdatePayload): Observable<Leccion> {
    return this.put(`/lecciones/${id}`, dto) as Observable<Leccion>;
  }

  deleteLeccion(id: number): Observable<void> {
    return this.delete(`/lecciones/${id}`) as Observable<void>;
  }

  reorderLecciones(items: LeccionReorderItem[]): Observable<void> {
    return this.put('/lecciones/reorder', { items }) as Observable<void>;
  }

  // ---- Bloques (widgets de la lección) ----

  createBloque(
    leccionId: number,
    dto: BloqueCreatePayload,
  ): Observable<Bloque> {
    return this.post(
      `/lecciones/${leccionId}/bloques`,
      dto,
    ) as Observable<Bloque>;
  }

  updateBloque(id: number, dto: BloqueUpdatePayload): Observable<Bloque> {
    return this.put(`/bloques/${id}`, dto) as Observable<Bloque>;
  }

  deleteBloque(id: number): Observable<void> {
    return this.delete(`/bloques/${id}`) as Observable<void>;
  }

  reorderBloques(items: BloqueReorderItem[]): Observable<void> {
    return this.put('/bloques/reorder', { items }) as Observable<void>;
  }

  requestVideoUploadUrl(title: string): Observable<TusCredentials> {
    return this.post('/videos/upload-url', {
      title,
    }) as Observable<TusCredentials>;
  }

  /**
   * Sube una imagen (miniatura/portada del curso) a Supabase vía el backend y
   * devuelve su URL pública. Reusa el mismo almacenamiento que avatares.
   */
  uploadImage(file: File): Observable<{ url: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ url: string }>(
      `${environment.apiUrl}/cursos/upload-image`,
      formData,
      { withCredentials: true },
    );
  }

  /**
   * Refactor 2026-05-25 (T14) — productos categoría CURSO desde cache backend.
   * Lee de BD (WooCommerceProductCache) sincronizado por cron horario. Admin
   * only en el backend (RolesGuard).
   */
  getWooProductsCursos(): Observable<WooCommerceProductSummary[]> {
    return this.http.get<WooCommerceProductSummary[]>(
      `${environment.apiUrl}/woocommerce/products/cursos`,
      { withCredentials: true },
    );
  }
}
