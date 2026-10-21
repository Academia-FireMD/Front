import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { CompraFiscalService } from '../compras/compra-fiscal.service';
import { importeConfirmadoEnCentimos } from '../compras/importe-confirmado.util';
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
  importeConfirmado?: number;
}

/** DTO del alta con COF; el precio se revalida frente al producto autoritativo. */
export interface AnadirPlanDto {
  nuevoSku: string;
  importeConfirmado: number;
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

export type AvisoCambioCodigo =
  | 'FUERA_DE_PLAZO'
  | 'COOLDOWN'
  | 'LIMITE_CAMBIOS'
  | 'OPOSICION_DUPLICADA'
  | 'SIN_FECHAS_CICLO'
  | 'PRECIO_NO_DISPONIBLE'
  | 'CAMBIO_NO_DISPONIBLE';

export interface PreviewCambioResponse {
  switchType: SwitchType;
  modo: ModoCambio;
  requiereCobro: boolean;
  /**
   * true = coste autoritativo (sea 0 o >0). false = no se pudo determinar el coste
   * de un upgrade (precio destino NaN/ausente o fechas de ciclo inválidas). NUNCA
   * tratar requiereCobro:false como "gratis": si costeCalculable es false en un
   * UPGRADE, el confirmar DEBE bloquearse.
   */
  costeCalculable: boolean;
  prorrateo?: { importe: number; diasRestantes: number; diasCiclo: number };
  precioActual: number | null;
  precioNuevo: number | null;
  /** ISO date string; presente si modo === 'PROGRAMADO'. */
  fechaAplicacion: string | null;
  metodoPago: { usable: boolean; tarjetaMasked: string | null };
  avisos: Array<{ codigo: AvisoCambioCodigo; mensaje: string }>;
  /** Cross-periodo (crédito→cobertura): crédito no consumido del plan actual (€). undefined si no aplica. */
  credito?: number;
  /** Cross-periodo: fecha ISO hasta la que el crédito cubre el plan nuevo. null si no se pudo calcular. */
  cubiertoHasta?: string | null;
  cambiosRestantes?: number;
  horasRestantesCooldown?: number;
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

/** Respuesta del endpoint POST /suscripcion-management/anadir-plan. */
export interface AnadirPlanResponse {
  success: boolean;
  /** true = el alumno NO tiene COF usable → hay que llevarlo al checkout de WC. */
  requiereCheckout?: boolean;
  /** Id de la `Suscripcion` local creada cuando success && !requiereCheckout. */
  suscripcionId?: number;
  mensaje: string;
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
  constructor(
    private http: HttpClient,
    private compraFiscal: CompraFiscalService,
  ) {
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
    preview?: Pick<
      PreviewCambioResponse,
      'requiereCobro' | 'costeCalculable' | 'prorrateo'
    >,
  ): Observable<CambioSuscripcionResponse> {
    if (!preview?.costeCalculable) {
      return throwError(
        () => new Error('No se puede cambiar el plan sin un coste calculable.'),
      );
    }
    const importe = preview.requiereCobro
      ? importeConfirmadoEnCentimos(preview.prorrateo?.importe)
      : null;
    if (preview.requiereCobro && importe === null) {
      return throwError(
        () => new Error('El importe confirmado del cambio no es válido.'),
      );
    }
    const dto: CambiarPlanDto = {
      suscripcionId,
      nuevoSku,
      comentario,
      ...(importe !== null ? { importeConfirmado: importe } : {}),
    };
    const cambiar = () =>
      this.http.post<CambioSuscripcionResponse>(
        `${environment.apiUrl}${this.controllerPrefix}/cambiar-plan`,
        dto,
        { withCredentials: true },
      );
    return preview.requiereCobro
      ? this.compraFiscal.ejecutarConDatosFiscales(cambiar, suscripcionId)
      : cambiar();
  }

  /** Preview read-only del cambio: importe de prorrateo, tipo, método de pago. */
  previewCambioSuscripcion(
    suscripcionId: number,
    nuevoSku: string,
  ): Observable<PreviewCambioResponse> {
    return this.post('/preview-cambio', {
      suscripcionId,
      nuevoSku,
    }) as Observable<PreviewCambioResponse>;
  }

  /**
   * @deprecated Usar `cambiarSuscripcion`. Se mantiene como alias para no romper
   * llamadas existentes; ahora devuelve la respuesta tipada completa.
   */
  cambiarPlan(
    dto: CambiarPlanDto,
    preview?: Pick<
      PreviewCambioResponse,
      'requiereCobro' | 'costeCalculable' | 'prorrateo'
    >,
  ): Observable<CambioSuscripcionResponse> {
    return this.cambiarSuscripcion(
      dto.suscripcionId,
      dto.nuevoSku,
      dto.comentario,
      preview,
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

  /**
   * Da de alta al alumno en una oposición que aún NO tiene, cobrando la 1ª cuota
   * con su tarjeta guardada (COF Redsys) en 1 clic. Si el alumno no tiene COF usable,
   * el backend responde `{ requiereCheckout: true }` y el front lo lleva al checkout de WC.
   */
  anadirPlan(
    nuevoSku: string,
    importeConfirmado: number,
  ): Observable<AnadirPlanResponse> {
    const importe = importeConfirmadoEnCentimos(importeConfirmado);
    if (importe === null) {
      return throwError(
        () => new Error('El precio visible del plan no es válido.'),
      );
    }
    const dto: AnadirPlanDto = { nuevoSku, importeConfirmado: importe };
    // La reserva de Server permite recuperar el alta pagada antes de comprobar
    // la ficha actual; las compras nuevas conservan la precondición fiscal.
    return this.compraFiscal.ejecutarConDatosFiscales(
      () =>
        this.http.post<AnadirPlanResponse>(
          `${environment.apiUrl}${this.controllerPrefix}/anadir-plan`,
          dto,
          { withCredentials: true },
        ),
      undefined,
      { omitirLecturaInicial: true },
    );
  }

  obtenerDetalleSuscripcion(
    suscripcionId: number,
  ): Observable<DetalleSuscripcion> {
    return this.get(
      `/detalle-suscripcion/${suscripcionId}`,
    ) as Observable<DetalleSuscripcion>;
  }

  linkToWordPress(password: string): Observable<{
    success: boolean;
    message: string;
    woocommerceCustomerId?: number;
  }> {
    return this.post('/link-wordpress', { password }) as Observable<{
      success: boolean;
      message: string;
      woocommerceCustomerId?: number;
    }>;
  }
}
