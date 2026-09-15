import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { Store } from '@ngrx/store';
import { firstValueFrom, Observable, of } from 'rxjs';
import {
  Oposicion,
  Suscripcion,
  SuscripcionStatus,
} from '../shared/models/subscription.model';
import { Rol, Usuario } from '../shared/models/user.model';
import {
  callejeroAlicanteGuard,
  callejeroValenciaGuard,
} from './callejero-alicante.guard';

describe('callejeroAlicanteGuard', () => {
  const profileTree = {} as UrlTree;

  async function ejecutar(
    guard: typeof callejeroAlicanteGuard,
    user: Partial<Usuario>,
  ): Promise<boolean | UrlTree> {
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
      guard({} as never, {} as never),
    ) as Observable<boolean | UrlTree>;
    return firstValueFrom(result);
  }

  afterEach(() => TestBed.resetTestingModule());

  it('permite al alumno con oposición Alicante CPBA', async () => {
    await expect(
      ejecutar(callejeroAlicanteGuard, {
        rol: Rol.ALUMNO,
        oposiciones: [Oposicion.ALICANTE_CPBA],
      }),
    ).resolves.toBe(true);
  });

  it.each([Rol.ADMIN, Rol.SUPERADMIN])(
    'permite el rol administrativo %s sin oposiciones',
    async (rol) => {
      await expect(
        ejecutar(callejeroAlicanteGuard, { rol, oposiciones: [] }),
      ).resolves.toBe(true);
    },
  );

  it('redirige al perfil si el alumno no tiene Alicante CPBA', async () => {
    await expect(
      ejecutar(callejeroAlicanteGuard, {
        rol: Rol.ALUMNO,
        oposiciones: [Oposicion.VALENCIA_AYUNTAMIENTO],
      }),
    ).resolves.toBe(profileTree);
  });

  it('protege la URL directa de Valencia frente a otra oposición', async () => {
    await expect(
      ejecutar(callejeroValenciaGuard, {
        rol: Rol.ALUMNO,
        oposiciones: [Oposicion.ALICANTE_CPBA],
      }),
    ).resolves.toBe(profileTree);
  });

  it('permite Valencia mediante una suscripción accesible', async () => {
    await expect(
      ejecutar(callejeroValenciaGuard, {
        rol: Rol.ALUMNO,
        suscripciones: [
          {
            oposicion: Oposicion.VALENCIA_AYUNTAMIENTO,
            status: SuscripcionStatus.ACTIVE,
          } as Suscripcion,
        ],
      }),
    ).resolves.toBe(true);
  });
});
