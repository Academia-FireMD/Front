import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Store } from '@ngrx/store';
import { of } from 'rxjs';
import { Oposicion } from '../../shared/models/subscription.model';
import { Rol, Usuario } from '../../shared/models/user.model';
import {
  CallejeroEntradaComponent,
  resolverDestinoCallejero,
} from './callejero-entrada.component';

describe('resolverDestinoCallejero', () => {
  const user = (
    rol: Rol,
    oposiciones: Oposicion[],
  ): Pick<Usuario, 'rol' | 'oposiciones'> => ({ rol, oposiciones });

  it('envía directamente a Valencia cuando es la única oposición compatible', () => {
    expect(
      resolverDestinoCallejero(
        user(Rol.ALUMNO, [Oposicion.VALENCIA_AYUNTAMIENTO]),
      ),
    ).toBe('valencia');
  });

  it('envía directamente a Alicante cuando es la única oposición compatible', () => {
    expect(
      resolverDestinoCallejero(user(Rol.ALUMNO, [Oposicion.ALICANTE_CPBA])),
    ).toBe('alicante');
  });

  it('muestra selector si el alumno tiene ambas oposiciones', () => {
    expect(
      resolverDestinoCallejero(
        user(Rol.ALUMNO, [
          Oposicion.VALENCIA_AYUNTAMIENTO,
          Oposicion.ALICANTE_CPBA,
        ]),
      ),
    ).toBe('selector');
  });

  it.each([Rol.ADMIN, Rol.SUPERADMIN])(
    'muestra selector al rol %s aunque no tenga oposiciones',
    (rol) => {
      expect(resolverDestinoCallejero(user(rol, []))).toBe('selector');
    },
  );

  it('muestra estado sin acceso si no hay oposición compatible', () => {
    expect(resolverDestinoCallejero(user(Rol.ALUMNO, [Oposicion.MADRID]))).toBe(
      'sin-acceso',
    );
  });
});

describe('CallejeroEntradaComponent', () => {
  async function crear(user: Partial<Usuario>): Promise<{
    fixture: ComponentFixture<CallejeroEntradaComponent>;
    navigate: jest.SpyInstance;
  }> {
    await TestBed.configureTestingModule({
      imports: [CallejeroEntradaComponent],
      providers: [
        { provide: Store, useValue: { select: jest.fn(() => of(user)) } },
        provideRouter([]),
      ],
    }).compileComponents();

    const navigate = jest
      .spyOn(TestBed.inject(Router), 'navigate')
      .mockResolvedValue(true);
    const fixture = TestBed.createComponent(CallejeroEntradaComponent);
    fixture.detectChanges();
    return { fixture, navigate };
  }

  afterEach(() => TestBed.resetTestingModule());

  it('redirige al callejero único reemplazando la entrada del historial', async () => {
    const { navigate } = await crear({
      rol: Rol.ALUMNO,
      oposiciones: [Oposicion.ALICANTE_CPBA],
    });

    expect(navigate).toHaveBeenCalledWith(['/app/callejero', 'alicante'], {
      replaceUrl: true,
    });
  });

  it('renderiza el selector estable cuando hay ambas oposiciones', async () => {
    const { fixture, navigate } = await crear({
      rol: Rol.ALUMNO,
      oposiciones: [Oposicion.VALENCIA_AYUNTAMIENTO, Oposicion.ALICANTE_CPBA],
    });

    expect(navigate).not.toHaveBeenCalled();
    expect(
      fixture.nativeElement.querySelector('[data-testid=callejero-selector]'),
    ).toBeTruthy();
    expect(
      fixture.nativeElement.querySelector(
        '[data-testid=callejero-oposicion-alicante]',
      ),
    ).toBeTruthy();
  });

  it('renderiza una salida al perfil si no hay oposición compatible', async () => {
    const { fixture } = await crear({
      rol: Rol.ALUMNO,
      oposiciones: [Oposicion.MADRID],
    });

    expect(
      fixture.nativeElement.querySelector(
        '[data-testid=callejero-sin-oposicion]',
      ),
    ).toBeTruthy();
  });
});
