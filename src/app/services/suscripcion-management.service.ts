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
}

export interface CambiarSuscripcionDto {
  nuevoSkuProducto: string;
  comentario?: string;
}

export interface ValidacionPlazo {
  valido: boolean;
  diasRestantes: number;
  proximoPago?: Date;
}

export interface ProductoWooCommerce {
  id: number;
  name: string;
  sku: string;
  price: string;
  description: string;
  type: string;
  imageUrl?: string | null;
}

export interface ResultadoCambioSuscripcion {
  mensaje: string;
  detalles: {
    planAnterior: string;
    planNuevo: string;
    precioAnterior: number;
    precioNuevo: number;
    diferencia: number;
    proximaFacturacion: Date;
  };
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
   */
  validarPlazo(): Observable<ValidacionPlazo> {
    return this.get('/validar-plazo') as Observable<ValidacionPlazo>;
  }

  /**
   * Solicita la baja de la suscripción
   */
  solicitarBaja(dto: SolicitarBajaDto): Observable<{ mensaje: string }> {
    return this.post('/solicitar-baja', dto) as Observable<{ mensaje: string }>;
  }

  /**
   * Obtiene los planes disponibles
   */
  obtenerPlanesDisponibles(): Observable<ProductoWooCommerce[]> {
    return this.get('/planes-disponibles') as Observable<ProductoWooCommerce[]>;
  }

  /**
   * Cambia la suscripción del usuario
   */
  cambiarSuscripcion(
    dto: CambiarSuscripcionDto
  ): Observable<ResultadoCambioSuscripcion> {
    return this.post('/cambiar-suscripcion', dto) as Observable<ResultadoCambioSuscripcion>;
  }

  /**
   * Vincula el usuario actual con WordPress/WooCommerce
   */
  linkToWordPress(): Observable<{
    success: boolean;
    message: string;
    woocommerceCustomerId?: string;
  }> {
    return this.post('/link-wordpress', {}) as Observable<{
      success: boolean;
      message: string;
      woocommerceCustomerId?: string;
    }>;
  }
}
