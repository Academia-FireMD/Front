import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiBaseService } from '../../services/api-base.service';
import {
  AccesoConCurso,
  ComprarCursoCofResponse,
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

  // /lecciones lives on its own controller (not under /cursos), so we
  // bypass the inherited /cursos prefix and call the backend directly.
  getLeccion(id: number): Observable<LeccionResponse> {
    return this.http
      .get<LeccionResponse>(`${environment.apiUrl}/lecciones/${id}`, {
        withCredentials: true,
      })
      .pipe(
        catchError((err) => this.handleError(err)),
      ) as Observable<LeccionResponse>;
  }

  /**
   * Compra un curso en 1 clic contra el COF (tarjeta guardada) del alumno.
   * El backend tarda ~2,5-5s (cobro vía SSH→WP), así que el caller DEBE mostrar
   * estado de carga. `ignoreError: true` → no disparamos el toast genérico de
   * `ApiBaseService`; la UX de error (decline vs técnico vs requiereCheckout) la
   * decide el componente según el `ComprarCursoCofResponse`. Espeja `anadirPlan`.
   */
  comprarCursoCof(cursoId: number): Observable<ComprarCursoCofResponse> {
    return this.post(
      `/${cursoId}/comprar-cof`,
      {},
      true,
    ) as Observable<ComprarCursoCofResponse>;
  }

  upsertProgreso(leccionId: number, dto: UpsertProgresoDto): Observable<void> {
    return this.http
      .post<void>(
        `${environment.apiUrl}/lecciones/${leccionId}/progreso`,
        dto,
        { withCredentials: true },
      )
      .pipe(catchError((err) => this.handleError(err))) as Observable<void>;
  }
}
