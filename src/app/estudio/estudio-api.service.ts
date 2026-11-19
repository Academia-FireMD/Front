import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../environments/environment';

export type PerfilPsico = 'cv' | 'cam';
export interface LibrilloCatalogado {
  edicion: string;
  titulo: string;
}

export interface Librillo extends LibrilloCatalogado {
  documentoId: number;
}

export type RecursoEstudio =
  | { tipo: 'psico' }
  | { tipo: 'librillo'; documentoId: number };

export interface OperacionEstudio {
  method: 'GET' | 'POST' | 'PUT';
  path: string;
  body?: unknown;
  perfil?: PerfilPsico;
}

@Injectable({ providedIn: 'root' })
export class EstudioApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  html(recurso: RecursoEstudio, edicion?: string) {
    return this.http.get(`${this.recursoUrl(recurso)}/app`, {
      responseType: 'text',
      params: edicion ? { edicion } : {},
    });
  }

  librillo(documentoId: number) {
    return this.http.get<Librillo>(
      `${this.base}/documentos/${documentoId}/librillo`,
    );
  }

  ejecutar(
    recurso: RecursoEstudio,
    operacion: OperacionEstudio,
    edicion?: string,
  ) {
    const params: Record<string, string> = edicion
      ? { edicion }
      : operacion.perfil
        ? { p: operacion.perfil }
        : {};
    return this.http.request<unknown>(
      operacion.method,
      `${this.recursoUrl(recurso)}${operacion.path}`,
      {
        body: operacion.body,
        params,
      },
    );
  }

  admin<T>(path: string, perfil?: PerfilPsico) {
    return this.http.get<T>(`${this.base}/psico/admin/${path}`, {
      params: perfil ? { p: perfil } : {},
    });
  }

  descargarCsv(semana: string, perfil: PerfilPsico) {
    return this.http.get(`${this.base}/psico/admin/week/${semana}.csv`, {
      params: { p: perfil },
      responseType: 'blob',
    });
  }

  borrarAlumno(id: string) {
    return this.http.post(
      `${this.base}/psico/admin/alumno/${encodeURIComponent(id)}/borrar`,
      { confirmar: id },
    );
  }

  revisarReporte(ref: string) {
    return this.http.post(`${this.base}/psico/admin/reports/done`, { ref });
  }

  private recursoUrl(recurso: RecursoEstudio): string {
    return recurso.tipo === 'psico'
      ? `${this.base}/psico`
      : `${this.base}/documentos/${recurso.documentoId}/librillo`;
  }
}
