import {
  HttpClient,
  HttpErrorResponse,
  HttpParams,
} from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ApiBaseService } from '../../services/api-base.service';
import {
  PaginatedResult,
  PaginationFilter,
} from '../../shared/models/pagination.model';
import {
  AplicarSincronizacionFiscalRequest,
  AplicarSincronizacionFiscalResponse,
  CompletarFiscalDto,
  CrearFacturaManualDto,
  CrearRectificativaDto,
  EliminarFacturaResult,
  Factura,
  FacturasResponse,
  ReconciliacionResult,
  ReprocesarFacturaFiscalResponse,
  SincronizacionFiscalPreview,
  SincronizacionFiscalPreviewRequest,
} from '../models/factura.model';

@Injectable({ providedIn: 'root' })
export class FacturacionService extends ApiBaseService {
  constructor(http: HttpClient) {
    super(http);
    this.controllerPrefix = '/admin/facturas';
  }

  listar$(
    pagination: PaginationFilter = { skip: 0, take: 20, searchTerm: '' },
  ): Observable<PaginatedResult<Factura>> {
    const pagina = Math.floor(pagination.skip / pagination.take) + 1;
    const where = pagination.where ?? {};

    let params = new HttpParams()
      .set('pagina', String(pagina))
      .set('porPagina', String(pagination.take));

    if (
      where['dateRange'] &&
      Array.isArray(where['dateRange']) &&
      where['dateRange'].length >= 2
    ) {
      const [d0, d1] = where['dateRange'];
      if (d0)
        params = params.set(
          'desde',
          d0 instanceof Date ? d0.toISOString().split('T')[0] : String(d0),
        );
      if (d1)
        params = params.set(
          'hasta',
          d1 instanceof Date ? d1.toISOString().split('T')[0] : String(d1),
        );
    } else {
      if (where['desde']) params = params.set('desde', where['desde']);
      if (where['hasta']) params = params.set('hasta', where['hasta']);
    }
    if (where['tipo']) params = params.set('tipo', where['tipo']);
    if (where['estado']) params = params.set('estado', where['estado']);
    if (where['usuarioId'])
      params = params.set('usuarioId', String(where['usuarioId']));
    if (pagination.searchTerm?.trim())
      params = params.set('searchTerm', pagination.searchTerm.trim());

    return this._http
      .get<FacturasResponse>(`${environment.apiUrl}${this.controllerPrefix}`, {
        params,
        withCredentials: true,
      })
      .pipe(
        map((res) => ({
          data: res.facturas,
          pagination: {
            skip: pagination.skip,
            take: pagination.take,
            searchTerm: pagination.searchTerm ?? '',
            count: res.total,
          },
        })),
      );
  }

  crearManual$(dto: CrearFacturaManualDto): Observable<Factura> {
    return this.post('/manual', dto) as Observable<Factura>;
  }

  crearRectificativa$(
    id: number,
    dto: CrearRectificativaDto,
  ): Observable<Factura> {
    return this.post(`/${id}/rectificativa`, dto) as Observable<Factura>;
  }

  descargarPdf$(id: number): Observable<Blob> {
    return this._http.get(
      `${environment.apiUrl}${this.controllerPrefix}/${id}/pdf`,
      { responseType: 'blob', withCredentials: true },
    );
  }

  misFacturas$(
    pagination: PaginationFilter = { skip: 0, take: 20, searchTerm: '' },
  ): Observable<PaginatedResult<Factura>> {
    const pagina = Math.floor(pagination.skip / pagination.take) + 1;
    const where = pagination.where ?? {};

    let params = new HttpParams()
      .set('pagina', String(pagina))
      .set('porPagina', String(pagination.take));

    if (where['desde']) params = params.set('desde', where['desde']);
    if (where['hasta']) params = params.set('hasta', where['hasta']);
    if (where['tipo']) params = params.set('tipo', where['tipo']);
    if (where['estado']) params = params.set('estado', where['estado']);
    if (pagination.searchTerm?.trim())
      params = params.set('searchTerm', pagination.searchTerm.trim());

    return this._http
      .get<FacturasResponse>(
        `${environment.apiUrl}${this.controllerPrefix}/mis-facturas`,
        {
          params,
          withCredentials: true,
        },
      )
      .pipe(
        map((res) => ({
          data: res.facturas,
          pagination: {
            skip: pagination.skip,
            take: pagination.take,
            searchTerm: pagination.searchTerm ?? '',
            count: res.total,
          },
        })),
      );
  }

  descargarMiPdf$(id: number): Observable<Blob> {
    return this._http.get(
      `${environment.apiUrl}${this.controllerPrefix}/mis-facturas/${id}/pdf`,
      { responseType: 'blob', withCredentials: true },
    );
  }

  eliminar$(id: number): Observable<EliminarFacturaResult> {
    return this.delete(`/${id}`) as Observable<EliminarFacturaResult>;
  }

  reconciliar$(): Observable<ReconciliacionResult> {
    return this.post('/reconciliar', {}) as Observable<ReconciliacionResult>;
  }

  listarPendientesRevisionFiscal$(): Observable<Factura[]> {
    return this.get('/pendientes-revision-fiscal') as Observable<Factura[]>;
  }

  completarFiscal$(id: number, dto: CompletarFiscalDto): Observable<Factura> {
    return this.post(`/${id}/completar-fiscal`, dto) as Observable<Factura>;
  }

  /**
   * Compara fichas y facturas sin escribir nada. El servidor resuelve el
   * ámbito y devuelve un fingerprint (`version`) para confirmar después.
   */
  previsualizarSincronizacionFiscal$(
    request: SincronizacionFiscalPreviewRequest = {},
  ): Observable<SincronizacionFiscalPreview> {
    const payload: SincronizacionFiscalPreviewRequest = {};
    if (request.usuarioIds?.length) {
      payload.usuarioIds = [...request.usuarioIds];
    }
    if (request.facturaIds?.length) {
      payload.facturaIds = [...request.facturaIds];
    }
    return this.post(
      '/sincronizacion-fiscal/preview',
      payload,
    ) as Observable<SincronizacionFiscalPreview>;
  }

  /**
   * Encola la sincronización del ámbito exacto devuelto por la preview.
   * Un 409 conserva el `HttpErrorResponse` para que la UI exija una nueva
   * comparación sin reintentar a ciegas.
   */
  aplicarSincronizacionFiscal$(
    request: AplicarSincronizacionFiscalRequest,
  ): Observable<AplicarSincronizacionFiscalResponse> {
    return this.postAccionFiscal$<AplicarSincronizacionFiscalResponse>(
      '/sincronizacion-fiscal/aplicar',
      {
        version: request.version,
        usuarioIds: [...request.usuarioIds],
        facturaIds: [...request.facturaIds],
        recuperarFacturas: request.recuperarFacturas,
      },
    );
  }

  /**
   * Reintenta un único registro fiscal mediante la cola. Nunca emite de
   * forma directa: el servidor decide si el registro sigue siendo elegible.
   */
  reprocesarFacturaFiscal$(
    id: number,
  ): Observable<ReprocesarFacturaFiscalResponse> {
    return this.postAccionFiscal$<ReprocesarFacturaFiscalResponse>(
      `/${id}/reprocesar`,
      {},
    );
  }

  private postAccionFiscal$<T>(endpoint: string, body: unknown): Observable<T> {
    return this._http
      .post<T>(
        `${environment.apiUrl}${this.controllerPrefix}${endpoint}`,
        body,
        {
          withCredentials: true,
        },
      )
      .pipe(
        catchError((response: HttpErrorResponse) => {
          if (response.status === 409) {
            return throwError(() => response);
          }
          return this.handleError(response) as Observable<never>;
        }),
      );
  }
}
