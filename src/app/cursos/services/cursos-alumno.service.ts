import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, Observable, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CompraFiscalService } from '../../compras/compra-fiscal.service';
import { importeConfirmadoEnCentimos } from '../../compras/importe-confirmado.util';
import { ApiBaseService } from '../../services/api-base.service';
import {
  AccesoConCurso,
  ComprarCursoCofDto,
  ComprarCursoCofResponse,
  CursoPublico,
  CursoSlugResponse,
  GuardarProgresoInteractivoPayload,
  LeccionResponse,
  ProgresoInteractivoRespuesta,
  UpsertProgresoDto,
} from '../models/curso.model';

@Injectable({ providedIn: 'root' })
export class CursosAlumnoService extends ApiBaseService {
  constructor(
    private http: HttpClient,
    private compraFiscal: CompraFiscalService,
  ) {
    super(http);
    this.controllerPrefix = '/cursos';
  }

  listMisCursos(): Observable<AccesoConCurso[]> {
    return this.get('/mios') as Observable<AccesoConCurso[]>;
  }

  /**
   * Clases grabadas (2026-06-29): cursos marcados `esClaseGrabada` accesibles por
   * suscripción + oposición. El backend devuelve la MISMA forma que `/mios`
   * (`AccesoConCurso[]`: curso + progreso envueltos en un acceso sintético), para
   * que `MisCursosPageComponent` se reutilice parametrizado sin tipo unión.
   */
  listClasesGrabadas(): Observable<AccesoConCurso[]> {
    return this.get('/clases-grabadas') as Observable<AccesoConCurso[]>;
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
  comprarCursoCof(
    cursoId: number,
    importeConfirmado: number,
  ): Observable<ComprarCursoCofResponse> {
    const importe = importeConfirmadoEnCentimos(importeConfirmado);
    if (importe === null) {
      return throwError(
        () => new Error('El precio visible del curso no es válido.'),
      );
    }
    const dto: ComprarCursoCofDto = { importeConfirmado: importe };
    // Server resuelve primero la reserva previa y exige ficha antes de un cargo
    // nuevo. Un GET fiscal previo podría bloquear el acceso de un pago ya hecho.
    return this.compraFiscal.ejecutarConDatosFiscales(
      () =>
        this.http.post<ComprarCursoCofResponse>(
          `${environment.apiUrl}/cursos/${cursoId}/comprar-cof`,
          dto,
          { withCredentials: true },
        ),
      undefined,
      { omitirLecturaInicial: true },
    );
  }

  /**
   * Descarga PROTEGIDA del documento de un bloque DOCUMENTO. El backend valida
   * acceso al curso (`tieneAccesoOAdmin`) y devuelve el archivo como stream. No
   * es una URL pública: el `AuthInterceptor` añade el Bearer token a esta
   * petición HttpClient, igual que al resto. El caller crea un objectURL con el
   * blob para descargar o mostrar en un visor inline (PDF).
   */
  descargarDocumento(bloqueId: number): Observable<Blob> {
    return this.http
      .get(`${environment.apiUrl}/cursos/bloques/${bloqueId}/documento`, {
        withCredentials: true,
        responseType: 'blob',
      })
      .pipe(catchError((err) => this.handleError(err))) as Observable<Blob>;
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

  /**
   * HTML protegido de un bloque INTERACTIVO (2026-10-28). El backend resuelve
   * el registro fijo (HIDRAULICA) y valida acceso al curso; nunca se sirve una
   * URL pública. El caller crea un objectURL y lo carga en un iframe.
   */
  descargarAplicacionInteractiva(bloqueId: number): Observable<Blob> {
    return this.http
      .get(`${environment.apiUrl}/cursos/bloques/${bloqueId}/aplicacion`, {
        withCredentials: true,
        responseType: 'blob',
      })
      .pipe(catchError((err) => this.handleError(err))) as Observable<Blob>;
  }

  /**
   * Estado acumulado de la aplicación interactiva de la lección.
   * `{ estado:null, revision:0 }` cuando el alumno aún no ha guardado nada.
   * La propiedad SIEMPRE la decide la sesión en backend.
   */
  getProgresoInteractivo(
    leccionId: number,
  ): Observable<ProgresoInteractivoRespuesta> {
    return this.http
      .get<ProgresoInteractivoRespuesta>(
        `${environment.apiUrl}/lecciones/${leccionId}/progreso/interactivo`,
        { withCredentials: true },
      )
      .pipe(
        catchError((err) => this.handleError(err)),
      ) as Observable<ProgresoInteractivoRespuesta>;
  }

  /**
   * Guarda el último snapshot completo. Body EXACTO `{ estado }`; el backend
   * incrementa `revisionInteractivo` y devuelve el estado aceptado. Sin CAS:
   * el último guardado aceptado gana.
   */
  guardarProgresoInteractivo(
    leccionId: number,
    estado: Record<string, unknown>,
  ): Observable<ProgresoInteractivoRespuesta> {
    const body: GuardarProgresoInteractivoPayload = { estado };
    return this.http
      .put<ProgresoInteractivoRespuesta>(
        `${environment.apiUrl}/lecciones/${leccionId}/progreso/interactivo`,
        body,
        { withCredentials: true },
      )
      .pipe(
        catchError((err) => this.handleError(err)),
      ) as Observable<ProgresoInteractivoRespuesta>;
  }
}
