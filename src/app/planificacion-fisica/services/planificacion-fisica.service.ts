import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Oposicion } from '../../shared/models/subscription.model';

export interface ErrorImport {
  hoja: string;
  fila: number;
  motivo: string;
}

export interface ResumenImport {
  identificador: string;
  numSemanas: number;
  totalAsignaciones: number;
  totalDetalles: number;
  relevancia: Oposicion[];
}

export interface PreviewImportResponse {
  resumen: ResumenImport | null;
  errores: ErrorImport[];
}

export interface ImportResponse {
  bloqueId: number;
  errores: ErrorImport[];
}

export type EstadoBloque = 'BORRADOR' | 'PUBLICADO';

export interface BloqueEntrenamiento {
  id: number;
  identificador: string;
  comentarioGeneral: string | null;
  fechaInicioSemana1: string;
  numSemanas: number;
  relevancia: Oposicion[];
  estado: EstadoBloque;
  _count: { semanas: number };
}

/**
 * Cuerpo real del error 409 de `DELETE /planificacion-fisica/bloques/:id`
 * cuando el bloque tiene progreso de alumnos registrado. Repetir la
 * petición con `?force=true` para borrar de todas formas.
 */
export interface EliminarBloqueConProgreso {
  message: string;
  progreso: number;
  confirmar: boolean;
}

@Injectable({ providedIn: 'root' })
export class PlanificacionFisicaService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/planificacion-fisica`;

  preview(file: File): Observable<PreviewImportResponse> {
    const fd = new FormData();
    fd.append('file', file);
    return this.http.post<PreviewImportResponse>(`${this.base}/preview`, fd);
  }

  importar(file: File): Observable<ImportResponse> {
    const fd = new FormData();
    fd.append('file', file);
    return this.http.post<ImportResponse>(`${this.base}/import`, fd);
  }

  listarBloques(): Observable<BloqueEntrenamiento[]> {
    return this.http.get<BloqueEntrenamiento[]>(`${this.base}/bloques`);
  }

  publicar(id: number): Observable<BloqueEntrenamiento> {
    return this.http.put<BloqueEntrenamiento>(
      `${this.base}/bloques/${id}/publicar`,
      {},
    );
  }

  eliminar(id: number, force = false): Observable<void> {
    const params = force ? '?force=true' : '';
    return this.http.delete<void>(`${this.base}/bloques/${id}${params}`);
  }

  descargarPlantillaUrl(): string {
    return `${this.base}/plantilla`;
  }
}
