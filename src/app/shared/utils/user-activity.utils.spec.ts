import { getUserActivity } from './user-activity.utils';

describe('getUserActivity', () => {
  const now = new Date('2026-08-10T12:00:00.000Z');

  it('uses accessible subscriptions, including pending cancellation, as active', () => {
    const activity = getUserActivity(
      {
        suscripciones: [{ status: 'PENDING_CANCEL' }, { status: 'CANCELLED' }],
      },
      now,
    );

    expect(activity.estado).toBe('active');
    expect(activity.suscripcionesAccesibles).toEqual([
      { status: 'PENDING_CANCEL' },
    ]);
  });

  it('marks activated consumables or recent updates as partial', () => {
    expect(
      getUserActivity({ consumibles: [{ estado: 'ACTIVADO' }] }, now).estado,
    ).toBe('partial');
    expect(
      getUserActivity({ updatedAt: '2026-07-12T12:00:00.000Z' }, now).estado,
    ).toBe('partial');
  });

  it('marks stale users without access as inactive', () => {
    expect(
      getUserActivity(
        {
          suscripciones: [{ status: 'CANCELLED' }],
          updatedAt: '2026-07-01T00:00:00.000Z',
        },
        now,
      ).estado,
    ).toBe('inactive');
  });

  it('does not treat an expired pending cancellation as accessible', () => {
    const activity = getUserActivity(
      {
        suscripciones: [
          { status: 'PENDING_CANCEL', fechaFin: '2026-08-09T12:00:00.000Z' },
        ],
        updatedAt: '2026-07-01T00:00:00.000Z',
      },
      now,
    );

    expect(activity.estado).toBe('inactive');
    expect(activity.suscripcionesAccesibles).toEqual([]);
  });
});
