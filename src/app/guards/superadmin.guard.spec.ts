import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { AuthService } from '../services/auth.service';
import { superadminGuard } from './superadmin.guard';

function setup(rol: string | null) {
  const auth = { decodeToken: jest.fn(() => (rol ? { rol } : null)) };
  const router = { navigate: jest.fn() };
  const toast = { error: jest.fn() };
  TestBed.configureTestingModule({
    providers: [
      { provide: AuthService, useValue: auth },
      { provide: Router, useValue: router },
      { provide: ToastrService, useValue: toast },
    ],
  });
  return { auth, router, toast };
}

describe('superadminGuard', () => {
  it('permite SUPERADMIN', () => {
    setup('SUPERADMIN');
    const result = TestBed.runInInjectionContext(() =>
      superadminGuard({} as any, {} as any),
    );
    expect(result).toBe(true);
  });

  it('redirige ADMIN', () => {
    const { router, toast } = setup('ADMIN');
    const result = TestBed.runInInjectionContext(() =>
      superadminGuard({} as any, {} as any),
    );
    expect(result).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/app/profile']);
    expect(toast.error).toHaveBeenCalled();
  });

  it('redirige ALUMNO', () => {
    const { router } = setup('ALUMNO');
    const result = TestBed.runInInjectionContext(() =>
      superadminGuard({} as any, {} as any),
    );
    expect(result).toBe(false);
    expect(router.navigate).toHaveBeenCalled();
  });

  it('redirige sin auth', () => {
    const { router } = setup(null);
    const result = TestBed.runInInjectionContext(() =>
      superadminGuard({} as any, {} as any),
    );
    expect(result).toBe(false);
    expect(router.navigate).toHaveBeenCalled();
  });
});
