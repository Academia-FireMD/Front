import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ApiBaseService } from '../../services/api-base.service';
import { Documento } from '../../shared/models/documentacion.model';
import {
  PaginatedResult,
  PaginationFilter,
} from '../../shared/models/pagination.model';

@Injectable({
  providedIn: 'root',
})
export class DocumentosService extends ApiBaseService {
  constructor(private http: HttpClient) {
    super(http);
    this.controllerPrefix = '/documentos';
  }

  public uploadDocumento$(formData: FormData): Observable<Documento> {
    return this.post('/upload', formData) as Observable<Documento>;
  }

  /**
   * Obtener documentos públicos
   * @param filter Filtro de paginación
   */
  public getDocumentosPublicos$(
    filter: PaginationFilter
  ): Observable<PaginatedResult<Documento>> {
    return this.post('/publicos', filter) as Observable<
      PaginatedResult<Documento>
    >;
  }

  public eliminarDocumento$(id: number): Observable<void> {
    return this.delete(`/${id}`) as Observable<void>;
  }

  public descargarDocumento$(id: number): Observable<Blob> {
    return this.http.get(`${environment.apiUrl + this.controllerPrefix}/download/${id}`, {
      responseType: 'blob',
      observe: 'response'
    }).pipe(
      map(response => {
        if (!response.body) {
          throw new Error('No se pudo descargar el archivo');
        }
        return response.body;
      })
    );
  }

  public updateDocumento$(payload: {
    id: number;
    identificador?: string;
    descripcion?: string;
    temaId?: number | null;
    isLocked?: boolean;
    requireWatermark?: boolean;
  }) {
    return this.post('/update', payload) as Observable<Documento>;
  }

  public getDocumentTree$(at?: string): Observable<any> {
    const params: { [key: string]: string } = {};
    if (at) {
      params['at'] = at;
    }
    return this.http.get(`${environment.apiUrl + this.controllerPrefix}/tree`, { params });
  }

  public markAsSeen$(documentId: number): Observable<{ message: string }> {
    return this.post(`/${documentId}/ack`, {}) as Observable<{ message: string }>;
  }

  public downloadWithWatermark$(id: number): Observable<Blob> {
    return this.http.post(`${environment.apiUrl + this.controllerPrefix}/${id}/download`, {}, {
      responseType: 'blob',
      observe: 'response'
    }).pipe(
      map(response => {
        if (!response.body) {
          throw new Error('No se pudo descargar el archivo');
        }
        return response.body;
      })
    );
  }

  public createOverride$(documentId: number, userId: number, visibility: string): Observable<any> {
    return this.post(`/${documentId}/overrides`, { userId, visibility });
  }

  public deleteOverride$(documentId: number, overrideId: string): Observable<{ message: string }> {
    return this.delete(`/${documentId}/overrides/${overrideId}`) as Observable<{ message: string }>;
  }
}
