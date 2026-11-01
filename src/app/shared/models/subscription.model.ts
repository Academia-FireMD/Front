export enum SuscripcionTipo {
  PREMIUM = 'PREMIUM',
  ADVANCED = 'ADVANCED',
  BASIC = 'BASIC',
}

export enum SuscripcionStatus {
  ACTIVE = 'ACTIVE',
  PENDING_CANCEL = 'PENDING_CANCEL',
  CANCELLED = 'CANCELLED',
  PENDING_PAYMENT = 'PENDING_PAYMENT',
}

/**
 * Quién mantiene el ciclo de cobro de una suscripción.
 *
 * Es independiente de `AuthSource`: un usuario puede autenticarse en local y
 * tener una membresía externa (sin ID de WooCommerce). Para dar de baja toda
 * la membresía externa exigimos que TODAS las suscripciones vigentes sean
 * EXTERNA; una sola WOOCOMMERCE la convierte en una cuenta mixta.
 */
export enum SuscripcionFuenteGestion {
  WOOCOMMERCE = 'WOOCOMMERCE',
  EXTERNA = 'EXTERNA',
}

/** Returns true if the subscription still grants access */
export function isSubscriptionAccessible(
  status: SuscripcionStatus | string,
): boolean {
  return (
    status === SuscripcionStatus.ACTIVE ||
    status === SuscripcionStatus.PENDING_CANCEL
  );
}

/** Texto de UI para el estado de una suscripción. */
export function getSubscriptionStatusLabel(
  status: SuscripcionStatus | string,
): string {
  switch (status) {
    case SuscripcionStatus.ACTIVE:
      return 'Activa';
    case SuscripcionStatus.PENDING_CANCEL:
      return 'Baja programada';
    case SuscripcionStatus.PENDING_PAYMENT:
      return 'Pago pendiente';
    case SuscripcionStatus.CANCELLED:
      return 'Cancelada';
    default:
      return status;
  }
}

export enum Oposicion {
  GENERAL = 'GENERAL',
  VALENCIA_AYUNTAMIENTO = 'VALENCIA_AYUNTAMIENTO',
  ALICANTE_CPBA = 'ALICANTE_CPBA',
  MADRID = 'MADRID',
}

export const OPOSICION_LABELS: Record<Oposicion, string> = {
  [Oposicion.GENERAL]: 'General',
  [Oposicion.VALENCIA_AYUNTAMIENTO]: 'Valencia Ayuntamiento',
  [Oposicion.ALICANTE_CPBA]: 'CPBA Alicante',
  [Oposicion.MADRID]: 'Madrid',
};

/**
 * Etiquetas del selector de catálogo y del perfil.
 *
 * En este contexto GENERAL conserva su semántica histórica de comodín global.
 * No reutilizar estas etiquetas para variantes de planificación, donde GENERAL
 * representa la planificación General Comunidad Valenciana.
 */
export const CATALOGO_OPOSICION_LABELS: Record<Oposicion, string> = {
  [Oposicion.GENERAL]: 'Todas las oposiciones',
  [Oposicion.VALENCIA_AYUNTAMIENTO]: 'Ayuntamiento de Valencia',
  [Oposicion.ALICANTE_CPBA]: 'Consorcio de Alicante',
  [Oposicion.MADRID]: 'Comunidad de Madrid',
};

/**
 * Etiquetas que usa exclusivamente el flujo de planificación.
 *
 * `OPOSICION_LABELS` se conserva porque otros módulos muestran sus nombres
 * históricos. Este mapa permite actualizar el copy solicitado por Sergio sin
 * cambiar esas pantallas ajenas ni los valores del enum/API.
 */
export const PLANIFICACION_OPOSICION_LABELS: Record<Oposicion, string> = {
  [Oposicion.GENERAL]: 'Plan común de Comunidad Valenciana',
  [Oposicion.VALENCIA_AYUNTAMIENTO]: 'Ayuntamiento de Valencia',
  [Oposicion.ALICANTE_CPBA]: 'Consorcio de Alicante',
  [Oposicion.MADRID]: 'Comunidad de Madrid',
};

/** Códigos cortos de oposición usados en la identidad de una variante. */
export const PLANIFICACION_OPOSICION_CODES: Record<Oposicion, string> = {
  [Oposicion.GENERAL]: 'GCV',
  [Oposicion.VALENCIA_AYUNTAMIENTO]: 'AV',
  [Oposicion.ALICANTE_CPBA]: 'CA',
  [Oposicion.MADRID]: 'CM',
};

export function getPlanificacionOposicionLabel(
  oposicion: Oposicion | string | null | undefined,
): string {
  if (!oposicion) return '';
  return PLANIFICACION_OPOSICION_LABELS[oposicion as Oposicion] ?? oposicion;
}

/**
 * Genera el identificador canónico de una variante de planificación.
 * Devuelve cadena vacía mientras falte una dimensión, para que el formulario
 * pueda conservar el estado inválido sin inventar un código parcial.
 */
export function getPlanificacionVarianteCodigo(
  oposicion: Oposicion | string | null | undefined,
  nivel: string | null | undefined,
  franja: string | null | undefined,
): string {
  const oposicionCode = oposicion
    ? PLANIFICACION_OPOSICION_CODES[oposicion as Oposicion]
    : undefined;
  const nivelCode =
    nivel === 'INICIACION' ? 'I' : nivel === 'AVANZADO' ? 'A' : undefined;
  const franjaCode =
    franja === 'FRANJA_CUATRO_A_SEIS_HORAS'
      ? '4-6H'
      : franja === 'FRANJA_SEIS_A_OCHO_HORAS'
        ? '6-8H'
        : undefined;

  if (!oposicionCode || !nivelCode || !franjaCode) return '';
  return `P${oposicionCode}${nivelCode}${franjaCode}`;
}

export const PLAN_LABELS: Record<string, string> = {
  PREMIUM: 'Premium',
  ADVANCED: 'Avanzado',
  BASIC: 'Básico',
};

export const PLAN_CSS_CLASS: Record<string, string> = {
  PREMIUM: 'plan-premium',
  ADVANCED: 'plan-advanced',
  BASIC: 'plan-basic',
};

export const PLAN_SORT_ORDER: Record<string, number> = {
  BASIC: 1,
  ADVANCED: 2,
  PREMIUM: 3,
};

export function getPlanLabel(tipo: string | null | undefined): string {
  return tipo ? PLAN_LABELS[tipo] || tipo : '';
}

export function getPlanCssClass(tipo: string | null | undefined): string {
  return tipo ? PLAN_CSS_CLASS[tipo] || '' : '';
}

export interface Suscripcion {
  id: number;
  usuarioId: number;
  tipo: SuscripcionTipo;
  oposicion: Oposicion; // A qué oposición pertenece
  fechaInicio: Date;
  fechaFin?: Date | null;
  cancelacionProgramada?: Date | null; // Fecha en la que se cancelará la suscripción (para cancelaciones fuera de plazo)
  woocommerceSubscriptionId?: string | null;
  sku?: string | null;
  productId?: string | null;
  isOfferPlan: boolean;
  offerDuration?: number;
  monthlyPrice?: number;
  status: SuscripcionStatus;
  /**
   * Quién mantiene el ciclo de cobro. El backend siempre lo devuelve; queda
   * opcional para no romper fixtures/consumidores antiguos. La baja total de
   * membresía externa solo se ofrece cuando vale EXTERNA.
   */
  fuenteGestion?: SuscripcionFuenteGestion;
  isGeneric?: boolean; // Indica si la suscripción es intercambiable entre oposiciones
  examenId?: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Contrato de la baja TOTAL de una membresía externa (solo ADMIN).
 *
 * El backend cancela todas las suscripciones vigentes de la cuenta y conserva
 * cursos comprados/concedidos, progreso e histórico. La operación es
 * idempotente: si ya no quedaba ninguna vigente, `yaEstabaDeBaja` es true y
 * `totalCanceladas` es 0.
 */
export interface CancelarMembresiaExternaPayload {
  motivo?: string;
}

export interface CancelarMembresiaExternaResultado {
  usuarioId: number;
  canceladas: number[];
  totalCanceladas: number;
  yaEstabaDeBaja: boolean;
  cursosConservados: number;
}

/** 409 estable del backend cuando la cuenta no es exclusivamente externa. */
export const REASON_GESTION_EXTERNA_REQUERIDA = 'GESTION_EXTERNA_REQUERIDA';

/** 403 estable del backend cuando falta la membresía que da acceso. */
export const REASON_SUSCRIPCION_REQUERIDA = 'SUSCRIPCION_REQUERIDA';
