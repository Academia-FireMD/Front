export enum SuscripcionTipo {
  PREMIUM = 'PREMIUM',
  ADVANCED = 'ADVANCED',
  BASIC = 'BASIC'
}

export enum SuscripcionStatus {
  ACTIVE = 'ACTIVE',
  CANCELLED = 'CANCELLED'
}

export enum Oposicion {
  GENERAL = 'GENERAL',
  VALENCIA_AYUNTAMIENTO = 'VALENCIA_AYUNTAMIENTO',
  ALICANTE_CPBA = 'ALICANTE_CPBA'
}

export const OPOSICION_LABELS: Record<Oposicion, string> = {
  [Oposicion.GENERAL]: 'General',
  [Oposicion.VALENCIA_AYUNTAMIENTO]: 'Valencia Ayuntamiento',
  [Oposicion.ALICANTE_CPBA]: 'CPBA Alicante'
};

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
  return tipo ? (PLAN_LABELS[tipo] || tipo) : '';
}

export function getPlanCssClass(tipo: string | null | undefined): string {
  return tipo ? (PLAN_CSS_CLASS[tipo] || '') : '';
}

export interface Suscripcion {
  id: number;
  usuarioId: number;
  tipo: SuscripcionTipo;
  oposicion: Oposicion;  // A qué oposición pertenece
  fechaInicio: Date;
  fechaFin?: Date;
  cancelacionProgramada?: Date;  // Fecha en la que se cancelará la suscripción (para cancelaciones fuera de plazo)
  woocommerceSubscriptionId?: string;
  sku?: string;
  productId?: string;
  isOfferPlan: boolean;
  offerDuration?: number;
  monthlyPrice?: number;
  status: SuscripcionStatus;
  isGeneric?: boolean;  // Indica si la suscripción es intercambiable entre oposiciones
  examenId?: number;
  createdAt: Date;
  updatedAt: Date;
}
