import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService } from './api-base.service';
import { Oposicion } from '../shared/models/subscription.model';

export interface CambioOposicionResponse {
  success: boolean;
  suscripcion: any;
  mensaje: string;
}

export interface HistorialCambio {
  id: number;
  oposicionAnterior: Oposicion;
  oposicionNueva: Oposicion;
  fecha: string;
  suscripcion: {
    id: number;
    tipo: string;
    sku: string;
  };
}

export interface PuedeRealizarCambioResponse {
  success: boolean;
  puede: boolean;
  razon?: string;
  diasRestantes?: number;
  oposicionesDisponibles?: Oposicion[];
}

@Injectable({
  providedIn: 'root',
})
export class SuscripcionesService extends ApiBaseService {
  constructor(private http: HttpClient) {
    super(http);
    this.controllerPrefix = '/suscripciones';
  }

  /**
   * Cambia la oposición de la suscripción del usuario
   */
  cambiarOposicion(suscripcionId: number, oposicionNueva: Oposicion): Observable<CambioOposicionResponse> {
    return this.post('/cambiar-oposicion', { suscripcionId, oposicionNueva }) as Observable<CambioOposicionResponse>;
  }

  /**
   * Obtiene el historial de cambios de oposición del usuario
   */
  obtenerHistorial(): Observable<{ success: boolean; historial: HistorialCambio[] }> {
    return this.get('/historial-cambios') as Observable<{ success: boolean; historial: HistorialCambio[] }>;
  }

  /**
   * Verifica si el usuario puede cambiar de oposición una suscripción específica
   */
  puedeRealizarCambio(suscripcionId: number): Observable<PuedeRealizarCambioResponse> {
    return this.get(`/puede-cambiar-oposicion/${suscripcionId}`) as Observable<PuedeRealizarCambioResponse>;
  }
}

