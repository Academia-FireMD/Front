export enum SuscripcionTipo {
  PREMIUM = 'PREMIUM',
  ADVANCED = 'ADVANCED',
  BASIC = 'BASIC',
}

export enum SuscripcionStatus {
  ACTIVE = 'ACTIVE',
  PENDING_CANCEL = 'PENDING_CANCEL',
  CANCELLED = 'CANCELLED',
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
 * Etiquetas que usa el flujo de planificación y el perfil.
 *
 * `OPOSICION_LABELS` se conserva porque otros módulos muestran sus nombres
 * históricos. Este mapa permite actualizar el copy solicitado por Sergio sin
 * cambiar esas pantallas ajenas ni los valores del enum/API.
 */
export const PLANIFICACION_OPOSICION_LABELS: Record<Oposicion, string> = {
  [Oposicion.GENERAL]: 'General Comunidad Valenciana',
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
  fechaFin?: Date;
  cancelacionProgramada?: Date; // Fecha en la que se cancelará la suscripción (para cancelaciones fuera de plazo)
  woocommerceSubscriptionId?: string;
  sku?: string;
  productId?: string;
  isOfferPlan: boolean;
  offerDuration?: number;
  monthlyPrice?: number;
  status: SuscripcionStatus;
  isGeneric?: boolean; // Indica si la suscripción es intercambiable entre oposiciones
  examenId?: number;
  createdAt: Date;
  updatedAt: Date;
}
