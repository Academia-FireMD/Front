import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  SimuladorNotaSnapshot,
  SimuladorNotaVersion,
} from '../models/simulador-nota.model';

const ENDPOINT = `${environment.apiUrl}/simulador-nota/mi-estado`;

/** Acceso autenticado al estado privado del simulador; el JWT nunca sale del padre Angular. */
@Injectable({ providedIn: 'root' })
export class SimuladorNotaService {
  private readonly http = inject(HttpClient);

  cargar(): Observable<SimuladorNotaVersion> {
    return this.http.get<SimuladorNotaVersion>(ENDPOINT, {
      withCredentials: true,
    });
  }

  guardar(
    revision: number,
    estado: SimuladorNotaSnapshot,
  ): Observable<SimuladorNotaVersion> {
    return this.http.put<SimuladorNotaVersion>(
      ENDPOINT,
      { revision, estado },
      { withCredentials: true },
    );
  }

  borrar(revision: number): Observable<SimuladorNotaVersion> {
    return this.http.delete<SimuladorNotaVersion>(ENDPOINT, {
      body: { revision },
      withCredentials: true,
    });
  }
}
