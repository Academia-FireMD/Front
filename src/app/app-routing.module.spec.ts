import { roleGuard } from './guards/auth/role.guard';
import { moduloGuard } from './guards/modulo.guard';
import { SubscriptionGuard } from './guards/subscription.guard';
import { ModuloApp } from './shared/models/modulo-app.enum';
import { routes } from './app-routing.module';

describe('ruta del Simulador de nota', () => {
  it('está bajo /app, protegida por rol y módulo, sin guard de suscripción', () => {
    const appRoute = routes.find((route) => route.path === 'app');
    const route = appRoute?.children?.find(
      (child) => child.path === 'simulador-nota',
    );

    expect(route).toBeDefined();
    expect(route?.canActivate).toEqual([roleGuard, moduloGuard]);
    expect(route?.data).toEqual({
      expectedRole: 'ALUMNO',
      modulo: ModuloApp.SIMULADOR_NOTA,
      title: 'Simulador de nota',
    });
    expect(route?.canActivate).not.toContain(SubscriptionGuard);
  });
});
