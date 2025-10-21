import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ApiBaseService } from '../../services/api-base.service';
import { Adjunto, EntidadTipo, UpdateAdjuntoDto } from '../models/attachment.model';

@Injectable({
  providedIn: 'root',
})
export class AttachmentsService extends ApiBaseService {
  private http = inject(HttpClient);

  constructor() {
    super(inject(HttpClient));
    this.controllerPrefix = '/adjuntos';
  }

  /**
   * Subir un adjunto
   */
  uploadAdjunto$(
    identificador: string,
    entidadTipo: EntidadTipo,
    entidadId: number,
    file: File,
    descripcion?: string
  ): Observable<Adjunto> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('identificador', identificador);
    formData.append('entidadTipo', entidadTipo);
    formData.append('entidadId', entidadId.toString());
    if (descripcion) {
      formData.append('descripcion', descripcion);
    }

    return this.post('/upload', formData) as Observable<Adjunto>;
  }

  /**
   * Obtener adjuntos por entidad
   */
  getAdjuntosByEntidad$(
    entidadTipo: EntidadTipo,
    entidadId: number
  ): Observable<Adjunto[]> {
    return this.get(`/${entidadTipo}/${entidadId}`) as Observable<Adjunto[]>;
  }

  /**
   * Descargar un adjunto
   */
  descargarAdjunto$(id: number): Observable<Blob> {
    return this.http
      .get(`${environment.apiUrl + this.controllerPrefix}/download/${id}`, {
        responseType: 'blob',
        observe: 'response',
      })
      .pipe(
        map((response) => {
          if (!response.body) {
            throw new Error('No se pudo descargar el archivo');
          }
          return response.body;
        })
      );
  }

  /**
   * Eliminar un adjunto
   */
  eliminarAdjunto$(id: number): Observable<void> {
    return this.delete(`/delete/${id}`) as Observable<void>;
  }

  /**
   * Actualizar un adjunto
   */
  updateAdjunto$(payload: UpdateAdjuntoDto): Observable<Adjunto> {
    return this.post('/update', payload) as Observable<Adjunto>;
  }

  /**
   * Formatear el tamaño del archivo
   */
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Obtener icono según el tipo de archivo
   */
  getFileIcon(tipoArchivo: string | undefined): string {
    if (!tipoArchivo) return 'pi pi-file';
    const tipo = tipoArchivo.toLowerCase();
    if (tipo.includes('pdf')) return 'pi pi-file-pdf';
    if (tipo.includes('word') || tipo.includes('doc')) return 'pi pi-file-word';
    if (tipo.includes('excel') || tipo.includes('xls')) return 'pi pi-file-excel';
    if (tipo.includes('image') || tipo.includes('png') || tipo.includes('jpg') || tipo.includes('jpeg')) return 'pi pi-image';
    if (tipo.includes('video')) return 'pi pi-video';
    if (tipo.includes('audio')) return 'pi pi-volume-up';
    if (tipo.includes('zip') || tipo.includes('rar')) return 'pi pi-inbox';
    return 'pi pi-file';
  }
}
