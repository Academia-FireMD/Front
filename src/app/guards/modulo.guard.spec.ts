import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { AppConfigService } from '../services/app-config.service';
import { AuthService } from '../services/auth.service';
import { ModuloApp } from '../shared/models/modulo-app.enum';
import { moduloGuard } from './modulo.guard';

function makeRoute(modulo?: ModuloApp): ActivatedRouteSnapshot {
  return { data: modulo ? { modulo } : {} } as any;
}

function setup(rol: string | null, modulosMap: Record<string, boolean>) {
  const auth = { decodeToken: jest.fn(() => (rol ? { rol } : null)) };
  const router = { navigate: jest.fn() };
  const toast = { error: jest.fn() };
  const appConfig = {
    isModuloHabilitado: jest.fn(
      (m: ModuloApp) => modulosMap[m] ?? true,
    ),
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: AuthService, useValue: auth },
      { provide: Router, useValue: router },
      { provide: ToastrService, useValue: toast },
      { provide: AppConfigService, useValue: appConfig },
    ],
  });
  return { auth, router, toast, appConfig };
}

describe('moduloGuard', () => {
  it('sin data.modulo → permite', () => {
    setup('ALUMNO', {});
    const result = TestBed.runInInjectionContext(() =>
      moduloGuard(makeRoute(), {} as any),
    );
    expect(result).toBe(true);
  });

  it('módulo ON → permite', () => {
    setup('ALUMNO', { [ModuloApp.TEST]: true });
    const result = TestBed.runInInjectionContext(() =>
      moduloGuard(makeRoute(ModuloApp.TEST), {} as any),
    );
    expect(result).toBe(true);
  });

  it('módulo OFF, no SUPERADMIN → bloquea y redirige', () => {
    const { router, toast } = setup('ALUMNO', {
      [ModuloApp.TEST]: false,
    });
    const result = TestBed.runInInjectionContext(() =>
      moduloGuard(makeRoute(ModuloApp.TEST), {} as any),
    );
    expect(result).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/app/profile']);
    expect(toast.error).toHaveBeenCalled();
  });

  it('módulo OFF, SUPERADMIN → permite (bypass)', () => {
    const { router } = setup('SUPERADMIN', {
      [ModuloApp.TEST]: false,
    });
    const result = TestBed.runInInjectionContext(() =>
      moduloGuard(makeRoute(ModuloApp.TEST), {} as any),
    );
    expect(result).toBe(true);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('modulo no en map → fail-open (permite)', () => {
    setup('ALUMNO', {});
    const result = TestBed.runInInjectionContext(() =>
      moduloGuard(makeRoute(ModuloApp.HORARIOS), {} as any),
    );
    expect(result).toBe(true);
  });
});
