import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { Store } from '@ngrx/store';
import { firstValueFrom, Observable, of } from 'rxjs';
import { Oposicion } from '../shared/models/subscription.model';
import { Rol, Usuario } from '../shared/models/user.model';
import { callejeroAlicanteGuard } from './callejero-alicante.guard';

describe('callejeroAlicanteGuard', () => {
  const profileTree = {} as UrlTree;

  async function ejecutar(user: Partial<Usuario>): Promise<boolean | UrlTree> {
    TestBed.configureTestingModule({
      providers: [
        { provide: Store, useValue: { select: jest.fn(() => of(user)) } },
        {
          provide: Router,
          useValue: { createUrlTree: jest.fn(() => profileTree) },
        },
      ],
    });

    const result = TestBed.runInInjectionContext(() =>
      callejeroAlicanteGuard({} as never, {} as never),
    ) as Observable<boolean | UrlTree>;
    return firstValueFrom(result);
  }

  afterEach(() => TestBed.resetTestingModule());

  it('permite al alumno con oposición Alicante CPBA', async () => {
    await expect(
      ejecutar({
        rol: Rol.ALUMNO,
        oposiciones: [Oposicion.ALICANTE_CPBA],
      }),
    ).resolves.toBe(true);
  });

  it.each([Rol.ADMIN, Rol.SUPERADMIN])(
    'permite el rol administrativo %s sin oposiciones',
    async (rol) => {
      await expect(ejecutar({ rol, oposiciones: [] })).resolves.toBe(true);
    },
  );

  it('redirige al perfil si el alumno no tiene Alicante CPBA', async () => {
    await expect(
      ejecutar({
        rol: Rol.ALUMNO,
        oposiciones: [Oposicion.VALENCIA_AYUNTAMIENTO],
      }),
    ).resolves.toBe(profileTree);
  });
});
