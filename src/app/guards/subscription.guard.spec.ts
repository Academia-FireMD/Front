import { of, firstValueFrom } from 'rxjs';
import { SubscriptionGuard } from './subscription.guard';
import { SuscripcionTipo } from '../shared/models/subscription.model';
describe('SubscriptionGuard: vigencia real de membresía', () => {
  const router = { navigate: jest.fn() };
  const toast = { error: jest.fn() };
  const route = {
    data: { allowedSubscriptions: [SuscripcionTipo.BASIC] },
  } as any;
  beforeEach(() => jest.clearAllMocks());
  async function permite(subs: object[], rol = 'ALUMNO') {
    const store = { select: () => of({ rol, suscripciones: subs }) };
    return firstValueFrom(
      new SubscriptionGuard(
        store as any,
        router as any,
        toast as any,
      ).canActivate(route),
    );
  }
  it('un ACTIVE caducado no abre una URL de membresía', async () => {
    expect(
      await permite([
        { tipo: 'BASIC', status: 'ACTIVE', fechaFin: '2000-01-01T00:00:00Z' },
      ]),
    ).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/app/profile']);
  });
  it('una baja programada sigue dando acceso hasta su fin exclusivo', async () => {
    expect(
      await permite([
        {
          tipo: 'BASIC',
          status: 'PENDING_CANCEL',
          fechaFin: '2099-01-01T00:00:00Z',
        },
      ]),
    ).toBe(true);
  });
  it('un producto independiente no concede membresía', async () => {
    expect(await permite([])).toBe(false);
  });
  it('mantiene el acceso administrativo', async () => {
    expect(await permite([], 'SUPERADMIN')).toBe(true);
  });
});
