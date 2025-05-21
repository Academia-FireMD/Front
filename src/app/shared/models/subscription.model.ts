export enum SuscripcionTipo {
  PRO = 'PRO', // deprecated => PREMIUM
  NORMAL = 'NORMAL', // deprecated => ADVANCED
  INDIVIDUAL = 'INDIVIDUAL', // deprecated => BASIC

  PREMIUM = 'PREMIUM',     // Plan Premium
  ADVANCED = 'ADVANCED',    // Plan Avanzado
  BASIC = 'BASIC'       // Plan Básico
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
  status?: string;
  examenId?: number;
  createdAt: Date;
  updatedAt: Date;
}
