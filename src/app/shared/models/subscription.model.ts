export enum SuscripcionTipo {
  PREMIUM = 'PREMIUM',     // Plan Premium
  ADVANCED = 'ADVANCED',    // Plan Avanzado
  BASIC = 'BASIC'       // Plan Básico
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
  examenId?: number;
  createdAt: Date;
  updatedAt: Date;
}
