import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../environments/environment';

export type PerfilPsico = 'cv' | 'cam';
export interface OperacionEstudio {
  method: 'GET' | 'POST' | 'PUT';
  path: string;
  body?: unknown;
  perfil?: PerfilPsico;
}

@Injectable({ providedIn: 'root' })
export class EstudioApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/psico`;

  html() {
    return this.http.get(`${this.base}/app`, { responseType: 'text' });
  }

  ejecutar(operacion: OperacionEstudio) {
    return this.http.request<unknown>(
      operacion.method,
      `${this.base}${operacion.path}`,
      {
        body: operacion.body,
        params: operacion.perfil ? { p: operacion.perfil } : {},
      },
    );
  }

  admin<T>(path: string, perfil?: PerfilPsico) {
    return this.http.get<T>(`${this.base}/admin/${path}`, {
      params: perfil ? { p: perfil } : {},
    });
  }

  descargarCsv(semana: string, perfil: PerfilPsico) {
    return this.http.get(`${this.base}/admin/week/${semana}.csv`, {
      params: { p: perfil },
      responseType: 'blob',
    });
  }

  borrarAlumno(id: string) {
    return this.http.post(
      `${this.base}/admin/alumno/${encodeURIComponent(id)}/borrar`,
      { confirmar: id },
    );
  }

  revisarReporte(ref: string) {
    return this.http.post(`${this.base}/admin/reports/done`, { ref });
  }
}
