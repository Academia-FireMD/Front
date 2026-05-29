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

export interface CambiarPlanDto {
  suscripcionId: number;
  nuevoSku: string;
  comentario?: string;
}

/** Tipo de cambio calculado por el backend según diferencia de precio/plan. */
export type SwitchType = 'UPGRADE' | 'DOWNGRADE' | 'CROSSGRADE';

/** Modo de aplicación del cambio: inmediato o diferido al próximo ciclo. */
export type ModoCambio = 'INMEDIATO' | 'PROGRAMADO';

/** Respuesta del endpoint POST /cambiar-plan (cambiarSuscripcion). */
export interface CambioSuscripcionResponse {
  mensaje: string;
  switchType: SwitchType;
  modo: ModoCambio;
  /** ISO date string. Presente cuando modo === 'PROGRAMADO'. */
  fechaAplicacion?: string;
}

/** Operación de cambio programada (downgrade diferido) pendiente de aplicar. */
export interface SwitchOperationProgramada {
  id: string;
  skuNuevo: string;
  tipoNuevo: string;
  oposicionNueva: string;
  /** ISO date string en la que el cron aplicará el cambio. */
  fechaProgramada: string;
}

export interface PlanDisponible {
  id: string;
  nombre: string;
  sku: string | null;
  precio: number | null;
  precioRegular: number | null;
  precioOferta: number | null;
  tipo: string | null;
  billingPeriod: 'month' | 'year' | 'week' | 'day';
  billingInterval: number;
}

export interface CuponActivo {
  code: string;
  discountType: string;
  discount: string;
}

export interface DetalleSuscripcion {
  id: number;
  tipo: string;
  oposicion: string;
  status: string;
  sku: string | null;
  monthlyPrice: number | null;
  cuponesActivos: CuponActivo[];
  proximoPago: Date | null;
  diasRestantes: number | null;
  esWooCommerce: boolean;
  // Campos de cambio programado (downgrade diferido). null si no hay cambio pendiente.
  cambioProgramadoSku: string | null;
  cambioProgramadoTipo: string | null;
  cambioProgramadoOposicion: string | null;
  /** ISO date string. */
  cambioProgramadoFecha: string | null;
  switchOperationProgramada: SwitchOperationProgramada | null;
}

@Injectable({
  providedIn: 'root',
})
export class SuscripcionManagementService extends ApiBaseService {
  constructor(private http: HttpClient) {
    super(http);
    this.controllerPrefix = '/suscripcion-management';
  }

  validarPlazo(suscripcionId?: number): Observable<ValidacionPlazo> {
    const params = suscripcionId ? `?suscripcionId=${suscripcionId}` : '';
    return this.get(`/validar-plazo${params}`) as Observable<ValidacionPlazo>;
  }

  solicitarBaja(dto: SolicitarBajaDto): Observable<RespuestaBaja> {
    return this.post('/solicitar-baja', dto) as Observable<RespuestaBaja>;
  }

  cancelarCancelacionProgramada(
    suscripcionId?: number,
  ): Observable<{ mensaje: string }> {
    return this.post('/cancelar-cancelacion-programada', {
      suscripcionId,
    }) as Observable<{ mensaje: string }>;
  }

  /**
   * Cambia la suscripción a un nuevo SKU. El backend devuelve el tipo de cambio
   * (UPGRADE/DOWNGRADE/CROSSGRADE) y el modo (INMEDIATO/PROGRAMADO). La ruta sigue
   * siendo /cambiar-plan aunque el método de negocio se renombró a cambiarSuscripcion.
   */
  cambiarSuscripcion(
    suscripcionId: number,
    nuevoSku: string,
    comentario?: string,
  ): Observable<CambioSuscripcionResponse> {
    const dto: CambiarPlanDto = { suscripcionId, nuevoSku, comentario };
    return this.post(
      '/cambiar-plan',
      dto,
    ) as Observable<CambioSuscripcionResponse>;
  }

  /**
   * @deprecated Usar `cambiarSuscripcion`. Se mantiene como alias para no romper
   * llamadas existentes; ahora devuelve la respuesta tipada completa.
   */
  cambiarPlan(dto: CambiarPlanDto): Observable<CambioSuscripcionResponse> {
    return this.cambiarSuscripcion(
      dto.suscripcionId,
      dto.nuevoSku,
      dto.comentario,
    );
  }

  /** Cancela un cambio programado (downgrade diferido) por id de SwitchOperation. */
  cancelarCambioProgramado(opId: string): Observable<{ mensaje: string }> {
    return this.delete(`/switches/${opId}`) as Observable<{ mensaje: string }>;
  }

  aplicarDescuento(
    suscripcionId: number,
    codigoDescuento: string,
  ): Observable<{ mensaje: string; cuponesActivos: CuponActivo[] }> {
    return this.post('/aplicar-descuento', {
      suscripcionId,
      codigoDescuento,
    }) as Observable<{ mensaje: string; cuponesActivos: CuponActivo[] }>;
  }

  removerDescuento(
    suscripcionId: number,
    codigoDescuento: string,
  ): Observable<{ mensaje: string; cuponesActivos: CuponActivo[] }> {
    return this.post('/remover-descuento', {
      suscripcionId,
      codigoDescuento,
    }) as Observable<{ mensaje: string; cuponesActivos: CuponActivo[] }>;
  }

  obtenerPlanesDisponibles(oposicion?: string): Observable<PlanDisponible[]> {
    const params = oposicion
      ? `?oposicion=${encodeURIComponent(oposicion)}`
      : '';
    return this.get(`/planes-disponibles${params}`) as Observable<
      PlanDisponible[]
    >;
  }

  obtenerDetalleSuscripcion(
    suscripcionId: number,
  ): Observable<DetalleSuscripcion> {
    return this.get(
      `/detalle-suscripcion/${suscripcionId}`,
    ) as Observable<DetalleSuscripcion>;
  }

  linkToWordPress(
    password: string,
  ): Observable<{
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
