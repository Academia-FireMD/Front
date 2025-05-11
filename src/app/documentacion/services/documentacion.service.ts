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
}
