import { isSubscriptionAccessible } from '../models/subscription.model';

export type UserActivityStatus = 'active' | 'partial' | 'inactive';

export interface UserActivitySource {
  suscripciones?: ReadonlyArray<{
    status: string;
    fechaFin?: Date | string | null;
  }>;
  consumibles?: ReadonlyArray<{ estado: string }>;
  updatedAt?: Date | string | null;
}

export interface UserActivity<
  T extends UserActivitySource = UserActivitySource,
> {
  estado: UserActivityStatus;
  suscripcionesAccesibles: NonNullable<T['suscripciones']>;
}

/**
 * Administrative activity is shared by the list and detail card. An accessible
 * subscription within its access period is active; an activated consumable or
 * activity within 30 days is partial; everything else is inactive.
 */
export function isSubscriptionCurrent(
  subscription: { status: string; fechaFin?: Date | string | null },
  now = new Date(),
): boolean {
  if (!isSubscriptionAccessible(subscription.status)) return false;
  if (!subscription.fechaFin) return true;
  const fechaFin = new Date(subscription.fechaFin);
  return !Number.isNaN(fechaFin.getTime()) && fechaFin > now;
}

export function getUserActivity<T extends UserActivitySource>(
  user: T,
  now = new Date(),
): UserActivity<T> {
  const suscripcionesAccesibles = (user.suscripciones || []).filter((sub) =>
    isSubscriptionCurrent(sub, now),
  );
  if (suscripcionesAccesibles.length) {
    return { estado: 'active', suscripcionesAccesibles } as UserActivity<T>;
  }

  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const updatedAt = user.updatedAt ? new Date(user.updatedAt) : undefined;
  const hasRecentActivity =
    !!updatedAt &&
    !Number.isNaN(updatedAt.getTime()) &&
    updatedAt > thirtyDaysAgo;
  const hasActivatedConsumable = (user.consumibles || []).some(
    (consumible) => consumible.estado === 'ACTIVADO',
  );

  return {
    estado:
      hasActivatedConsumable || hasRecentActivity ? 'partial' : 'inactive',
    suscripcionesAccesibles,
  } as UserActivity<T>;
}
