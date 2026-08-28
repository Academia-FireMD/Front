import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService } from './api-base.service';

export type EstadoCreditoTutoria =
  | 'DISPONIBLE'
  | 'RESERVADO'
  | 'CONSUMIDO'
  | 'EXPIRADO';

export type TipoMovimientoCreditoTutoria =
  | 'EMISION'
  | 'RESERVA'
  | 'LIBERACION'
  | 'CONSUMO'
  | 'EXPIRACION';

export interface CreditoTutoriaHistoryItem {
  id: number;
  ciclo: number;
  estado: EstadoCreditoTutoria;
  validoDesde: string | Date;
  validoHasta: string | Date;
  reservaId: number | null;
  movimientos: Array<{
    tipo: TipoMovimientoCreditoTutoria;
    creadoEn: string | Date;
    reservaId: number | null;
  }>;
}

export interface MadridTutoriaBalance {
  disponibles: number;
  reservados: number;
  consumidos: number;
  expirados: number;
  historial: CreditoTutoriaHistoryItem[];
}

@Injectable({ providedIn: 'root' })
export class MadridTutoriasService extends ApiBaseService {
  constructor(http: HttpClient) {
    super(http);
    this.controllerPrefix = '/madrid-tutorias';
  }

  getCreditBalance(): Observable<MadridTutoriaBalance> {
    return this.get('/creditos') as Observable<MadridTutoriaBalance>;
  }
}
