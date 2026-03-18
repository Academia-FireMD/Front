import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ApiBaseService } from '../../services/api-base.service';
import { PaginatedResult, PaginationFilter } from '../../shared/models/pagination.model';
import {
  CrearFacturaManualDto,
  CrearRectificativaDto,
  Factura,
  FacturasResponse,
} from '../models/factura.model';

@Injectable({ providedIn: 'root' })
export class FacturacionService extends ApiBaseService {
  constructor(http: HttpClient) {
    super(http);
    this.controllerPrefix = '/admin/facturas';
  }

  listar$(pagination: PaginationFilter = { skip: 0, take: 20, searchTerm: '' }): Observable<PaginatedResult<Factura>> {
    const pagina = Math.floor(pagination.skip / pagination.take) + 1;
    const where = pagination.where ?? {};

    let params = new HttpParams()
      .set('pagina', String(pagina))
      .set('porPagina', String(pagination.take));

    if (where['dateRange'] && Array.isArray(where['dateRange']) && where['dateRange'].length >= 2) {
      const [d0, d1] = where['dateRange'];
      if (d0) params = params.set('desde', d0 instanceof Date ? d0.toISOString().split('T')[0] : String(d0));
      if (d1) params = params.set('hasta', d1 instanceof Date ? d1.toISOString().split('T')[0] : String(d1));
    } else {
      if (where['desde']) params = params.set('desde', where['desde']);
      if (where['hasta']) params = params.set('hasta', where['hasta']);
    }
    if (where['tipo']) params = params.set('tipo', where['tipo']);
    if (where['estado']) params = params.set('estado', where['estado']);
    if (where['usuarioId']) params = params.set('usuarioId', String(where['usuarioId']));
    if (pagination.searchTerm?.trim()) params = params.set('searchTerm', pagination.searchTerm.trim());

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
        }))
      );
  }

  crearManual$(dto: CrearFacturaManualDto): Observable<Factura> {
    return this.post('/manual', dto) as Observable<Factura>;
  }

  crearRectificativa$(id: number, dto: CrearRectificativaDto): Observable<Factura> {
    return this.post(`/${id}/rectificativa`, dto) as Observable<Factura>;
  }

  descargarPdf$(id: number): Observable<Blob> {
    return this._http.get(
      `${environment.apiUrl}${this.controllerPrefix}/${id}/pdf`,
      { responseType: 'blob', withCredentials: true }
    );
  }
}
