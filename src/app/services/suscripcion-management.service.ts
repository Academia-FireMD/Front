import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService } from './api-base.service';

export enum MotivoBaja {
  APROBADO = 'APROBADO',
  CAMBIO_ACADEMIA = 'CAMBIO_ACADEMIA',
  PREPARACION_PROPIA = 'PREPARACION_PROPIA',
  TRATO_NO_COMODO = 'TRATO_NO_COMODO',
  MATERIAL_INADECUADO = 'MATERIAL_INADECUADO',
  FALTA_TIEMPO = 'FALTA_TIEMPO',
  MOTIVOS_ECONOMICOS = 'MOTIVOS_ECONOMICOS',
  OTROS = 'OTROS',
}

export interface SolicitarBajaDto {
  motivos: MotivoBaja[];
  comentarioAdicional?: string;
  suscripcionId?: number;
  forzarCancelacionProgramada?: boolean;
}

export interface ValidacionPlazo {
  valido: boolean;
  diasRestantes: number;
  proximoPago?: Date;
}

export interface RespuestaBaja {
  mensaje: string;
  cancelacionProgramada?: boolean;
  proximoPago?: Date;
}

@Injectable({
  providedIn: 'root',
})
export class SuscripcionManagementService extends ApiBaseService {
  constructor(private http: HttpClient) {
    super(http);
    this.controllerPrefix = '/suscripcion-management';
  }

  /**
   * Valida si el usuario puede realizar cambios en su suscripción
   * Solo para usuarios "en negro"
   */
  validarPlazo(): Observable<ValidacionPlazo> {
    return this.get('/validar-plazo') as Observable<ValidacionPlazo>;
  }

  /**
   * Solicita la baja de la suscripción (solo usuarios "en negro")
   */
  solicitarBaja(dto: SolicitarBajaDto): Observable<RespuestaBaja> {
    return this.post('/solicitar-baja', dto) as Observable<RespuestaBaja>;
  }

  /**
   * Cancela una cancelación programada
   */
  cancelarCancelacionProgramada(suscripcionId?: number): Observable<{ mensaje: string }> {
    return this.post('/cancelar-cancelacion-programada', { suscripcionId }) as Observable<{ mensaje: string }>;
  }

  /**
   * Vincula el usuario actual con WordPress/WooCommerce
   */
  linkToWordPress(password: string): Observable<{
    success: boolean;
    message: string;
    woocommerceCustomerId?: string;
  }> {
    return this.post('/link-wordpress', { password }) as Observable<{
      success: boolean;
      message: string;
      woocommerceCustomerId?: string;
    }>;
  }
}
