export enum SuscripcionTipo {
  PREMIUM = 'PREMIUM',     // Plan Premium
  ADVANCED = 'ADVANCED',    // Plan Avanzado
  BASIC = 'BASIC'       // Plan Básico
}

export enum SuscripcionStatus {
  ACTIVE = 'ACTIVE',
  CANCELLED = 'CANCELLED'
}

export interface Suscripcion {
  id: number;
  usuarioId: number;
  tipo: SuscripcionTipo;
  fechaInicio: Date;
  fechaFin?: Date;
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
