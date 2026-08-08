import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { COMMON_TEST_PROVIDERS } from '../../testing/common-providers';
import { Oposicion } from '../../shared/models/subscription.model';
import {
  MiPlan,
  PlanificacionFisicaService,
} from '../services/planificacion-fisica.service';
import { PlanificacionFisicaCalendarioComponent } from './planificacion-fisica-calendario.component';

describe('PlanificacionFisicaCalendarioComponent', () => {
  let fixture: ComponentFixture<PlanificacionFisicaCalendarioComponent>;
  let component: PlanificacionFisicaCalendarioComponent;
  let serviceMock: Partial<Record<keyof PlanificacionFisicaService, jest.Mock>>;

  const planFixture: MiPlan = {
    bloque: {
      id: 1,
      identificador: 'BLOQUE-1',
      comentarioGeneral: null,
      fechaInicioSemana1: '2026-07-01',
      numSemanas: 4,
      relevancia: [Oposicion.VALENCIA_AYUNTAMIENTO],
      estado: 'PUBLICADO',
    },
    hoy: '2026-07-17',
    semanas: [
      {
        id: 10,
        indice: 0,
        numeroAno: 1,
        fechaInicio: '2026-07-08',
        intensidad: 20,
        comentarioSemana: 'Semana suave',
        esActual: false,
        esAnterior: true,
        soloLectura: true,
        progreso: { hechas: 3, total: 10 },
        dias: [
          {
            fecha: '2026-07-08',
            diaSemana: 1,
            chips: [
              {
                disciplinaId: 1,
                nombre: 'Cuerda',
                grupo: 'CUERDA',
                color: '#9fe2d0',
                realizado: true,
              },
            ],
          },
        ],
      },
      {
        id: 11,
        indice: 1,
        numeroAno: 2,
        fechaInicio: '2026-07-15',
        intensidad: 80,
        comentarioSemana: null,
        esActual: true,
        esAnterior: false,
        soloLectura: false,
        progreso: { hechas: 2, total: 10 },
        dias: [
          {
            fecha: '2026-07-17',
            diaSemana: 4,
            chips: [
              {
                disciplinaId: 2,
                nombre: 'Carrera',
                grupo: 'CARRERA',
                color: '#fdeaa8',
                realizado: false,
              },
            ],
          },
        ],
      },
    ],
  };

  beforeEach(async () => {
    serviceMock = {
      miPlan: jest.fn().mockReturnValue(of(planFixture)),
      misBloques: jest.fn().mockReturnValue(of([])),
    };

    await TestBed.configureTestingModule({
      imports: [PlanificacionFisicaCalendarioComponent, NoopAnimationsModule],
      providers: [
        ...COMMON_TEST_PROVIDERS,
        { provide: PlanificacionFisicaService, useValue: serviceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PlanificacionFisicaCalendarioComponent);
    component = fixture.componentInstance;
    (
      TestBed.inject(ActivatedRoute) as any
    ).snapshot.queryParamMap.get.mockReturnValue(null);
  });

  it('carga el plan al iniciar y pinta las semanas del calendario', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(serviceMock.miPlan).toHaveBeenCalled();
    expect(component['miPlan']()).toEqual(planFixture);

    const semana1 = fixture.debugElement.query(
      By.css('[data-testid="pf-semana-10"]'),
    );
    const semana2 = fixture.debugElement.query(
      By.css('[data-testid="pf-semana-11"]'),
    );
    expect(semana1).toBeTruthy();
    expect(semana2).toBeTruthy();
  });

  it('marca visualmente el día de hoy (compara la fecha del día contra `hoy` del plan)', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component['esHoy']('2026-07-17')).toBe(true);
    expect(component['esHoy']('2026-07-08')).toBe(false);

    const diaHoy = fixture.debugElement.query(
      By.css('[data-testid="pf-dia-2026-07-17"]'),
    );
    expect(diaHoy.classes['pf-calendario__dia--hoy']).toBe(true);
  });

  it('atenúa (opacidad) la semana anterior marcada como soloLectura', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const semanaAnterior = fixture.debugElement.query(
      By.css('[data-testid="pf-semana-10"]'),
    );
    expect(semanaAnterior.attributes['data-solo-lectura']).toBe('true');
  });

  it('muestra la píldora de upsell cuando el backend responde 403 TIER_TOO_LOW', async () => {
    serviceMock.miPlan!.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 403,
            error: {
              reason: 'TIER_TOO_LOW',
              requiredTier: 'ADVANCED',
              message: 'Mejora tu suscripción para acceder a este contenido.',
            },
          }),
      ),
    );

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const pill = fixture.debugElement.query(
      By.css('[data-testid="pf-upsell-pill"]'),
    );
    expect(pill).toBeTruthy();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Mejora tu suscripción para acceder a este contenido.',
    );
  });

  it('muestra el mensaje de "sin plan" cuando el backend devuelve null', async () => {
    serviceMock.miPlan!.mockReturnValue(of(null));

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const vacio = fixture.debugElement.query(
      By.css('[data-testid="pf-calendario-sin-plan"]'),
    );
    expect(vacio).toBeTruthy();
  });

  it('muestra un estado de ERROR (no "sin plan") cuando el backend falla con un error genérico (500)', async () => {
    serviceMock.miPlan!.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 500 })),
    );

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const errorEl = fixture.debugElement.query(
      By.css('[data-testid="pf-calendario-error"]'),
    );
    expect(errorEl).toBeTruthy();

    // Regresión: la UI NO debe mentir diciendo "sin plan" cuando en
    // realidad hubo un fallo de backend.
    const vacio = fixture.debugElement.query(
      By.css('[data-testid="pf-calendario-sin-plan"]'),
    );
    expect(vacio).toBeFalsy();
    expect(component['sinPlan']()).toBe(false);
  });

  it('el botón de reintentar del estado de error vuelve a llamar a mi-plan', async () => {
    serviceMock.miPlan!.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 500 })),
    );

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(serviceMock.miPlan).toHaveBeenCalledTimes(1);

    serviceMock.miPlan!.mockReturnValue(of(planFixture));

    const reintentar = fixture.debugElement.query(
      By.css('[data-testid="pf-calendario-reintentar"]'),
    );
    expect(reintentar).toBeTruthy();
    (reintentar.nativeElement as HTMLElement).click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(serviceMock.miPlan).toHaveBeenCalledTimes(2);
    expect(component['error']()).toBe(false);
    expect(component['miPlan']()).toEqual(planFixture);
  });

  it('abrirDia navega a la vista de detalle del día', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    component['abrirDia']('2026-07-17');

    const router = TestBed.inject(Router);
    expect(router.navigate).toHaveBeenCalledWith(
      ['/app/planificacion-fisica', 'dia', '2026-07-17'],
      { queryParams: { bloqueId: 1 } },
    );
  });

  it('irAMarcas navega al histórico de marcas personales', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    component['irAMarcas']();

    const router = TestBed.inject(Router);
    expect(router.navigate).toHaveBeenCalledWith([
      '/app/planificacion-fisica',
      'marcas',
    ]);
  });

  it('no muestra el enlace "Ver bloque completo" (feedback Sergio 2026-07-24)', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const link = fixture.nativeElement.querySelector(
      '[data-testid="pf-calendario-bloque-link"]',
    );
    expect(link).toBeNull();
  });

  describe('switcher multi-oposición (Fase 2)', () => {
    const bloqueValencia = {
      id: 2,
      identificador: 'Bloque Valencia',
      relevancia: [Oposicion.VALENCIA_AYUNTAMIENTO],
      esActivo: true,
    };
    const bloqueMadrid = {
      id: 3,
      identificador: 'Bloque Madrid',
      relevancia: [Oposicion.MADRID],
      esActivo: false,
    };

    it('con más de un bloque aplicable: muestra el selector y cambiar recarga el plan con el bloqueId elegido', async () => {
      serviceMock.misBloques!.mockReturnValue(
        of([bloqueValencia, bloqueMadrid]),
      );

      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const switcher = fixture.debugElement.query(
        By.css('[data-testid="pf-switcher-bloques"]'),
      );
      expect(switcher).toBeTruthy();
      // Preselecciona el bloque esActivo (el más específico) para el
      // selector, aunque la carga inicial de mi-plan va sin bloqueId (el
      // backend ya resuelve al mismo bloque por defecto).
      expect(component['bloqueSeleccionadoId']()).toBe(1);
      expect(serviceMock.miPlan).toHaveBeenCalledWith(undefined);

      component['cambiarBloque'](3);
      expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith([], {
        relativeTo: TestBed.inject(ActivatedRoute),
        queryParams: { bloqueId: 3 },
        queryParamsHandling: 'merge',
      });
    });

    it('rehidrata bloqueId=3 de query aunque Valencia sea el activo por defecto', async () => {
      serviceMock.misBloques!.mockReturnValue(
        of([bloqueValencia, bloqueMadrid]),
      );
      const route = TestBed.inject(ActivatedRoute) as any;
      route.snapshot.queryParamMap.get.mockReturnValue('3');

      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(serviceMock.miPlan).toHaveBeenCalledWith(3);
      expect(component['bloqueSeleccionadoId']()).toBe(1);

      component['abrirDia']('2026-07-17');
      expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(
        ['/app/planificacion-fisica', 'dia', '2026-07-17'],
        { queryParams: { bloqueId: 1 } },
      );
    });

    it('con un solo bloque aplicable (v1): NO muestra el selector', async () => {
      serviceMock.misBloques!.mockReturnValue(of([bloqueValencia]));

      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const switcher = fixture.debugElement.query(
        By.css('[data-testid="pf-switcher-bloques"]'),
      );
      expect(switcher).toBeFalsy();
    });

    it('sin ningún bloque aplicable: NO muestra el selector', async () => {
      serviceMock.misBloques!.mockReturnValue(of([]));

      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const switcher = fixture.debugElement.query(
        By.css('[data-testid="pf-switcher-bloques"]'),
      );
      expect(switcher).toBeFalsy();
    });

    it('fallo de misBloques (red/5xx) no rompe la carga del calendario: cae a miPlan() sin bloqueId', async () => {
      serviceMock.misBloques!.mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 500 })),
      );

      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const switcher = fixture.debugElement.query(
        By.css('[data-testid="pf-switcher-bloques"]'),
      );
      expect(switcher).toBeFalsy();
      expect(serviceMock.miPlan).toHaveBeenCalledWith(undefined);
      expect(component['miPlan']()).toEqual(planFixture);

      const semana1 = fixture.debugElement.query(
        By.css('[data-testid="pf-semana-10"]'),
      );
      expect(semana1).toBeTruthy();
    });

    it('conserva el último selector válido cuando misBloques falla transitoriamente', async () => {
      serviceMock.misBloques!.mockReturnValueOnce(
        of([bloqueValencia, bloqueMadrid]),
      );

      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      serviceMock.misBloques!.mockReturnValueOnce(
        throwError(() => new HttpErrorResponse({ status: 500 })),
      );
      component['reintentar']();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(component['misBloques']()).toEqual([bloqueValencia, bloqueMadrid]);
      expect(component['miPlan']()).toEqual(planFixture);
      expect(
        fixture.debugElement.query(
          By.css('[data-testid="pf-switcher-bloques"]'),
        ),
      ).toBeTruthy();
    });
  });

  describe('progreso diario en la tarjeta de día', () => {
    it('progresoDia deriva hechas/total de los chips (sin llamar al backend)', async () => {
      fixture.detectChanges();
      await fixture.whenStable();

      const diaHecho = planFixture.semanas[0].dias[0]; // 1 chip realizado
      const diaPendiente = planFixture.semanas[1].dias[0]; // 1 chip sin hacer

      expect(component['progresoDia'](diaHecho)).toEqual({
        hechas: 1,
        total: 1,
      });
      expect(component['progresoDia'](diaPendiente)).toEqual({
        hechas: 0,
        total: 1,
      });
    });

    it('DESCANSO se muestra como chip pero no cuenta en el progreso diario', () => {
      const dia = {
        ...planFixture.semanas[0].dias[0],
        chips: [
          ...planFixture.semanas[0].dias[0].chips,
          {
            disciplinaId: 99,
            nombre: 'Descanso',
            grupo: 'DESCANSO' as const,
            color: '#ffffff',
            realizado: false,
          },
        ],
      };

      expect(component['progresoDia'](dia)).toEqual({ hechas: 1, total: 1 });
    });

    it('pinta la mini-barra con "X de Y" bajo cada día con disciplinas', async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const progHecho = fixture.debugElement.query(
        By.css('[data-testid="pf-progreso-dia-2026-07-08"]'),
      );
      expect(progHecho).toBeTruthy();
      expect((progHecho.nativeElement as HTMLElement).textContent).toContain(
        '1 de 1',
      );

      const progPendiente = fixture.debugElement.query(
        By.css('[data-testid="pf-progreso-dia-2026-07-17"]'),
      );
      expect(progPendiente).toBeTruthy();
      expect(
        (progPendiente.nativeElement as HTMLElement).textContent,
      ).toContain('0 de 1');
    });

    it('la mini-barra no pinta color inline: el naranja del bloque lo da el .scss (antes verde al 100%)', async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      // 2026-07-08 está al 100% (1/1): era justo el caso que pintaba
      // `#28a745` — el verde reservado a "Específico SPEIS" en el calendario
      // de estudio, y además incoherente con el detalle de día, ya naranja.
      const barra = fixture.debugElement.query(
        By.css(
          '[data-testid="pf-progreso-dia-2026-07-08"] .pf-calendario__dia-progreso-barra',
        ),
      );
      expect(barra).toBeTruthy();
      const style = (barra.nativeElement as HTMLElement).style;
      expect(style.width).toBe('100%');
      // Sin background-color inline manda `$pf-naranja-barra` de la hoja de
      // estilos, la MISMA variable que usa la barra del detalle de día.
      expect(style.backgroundColor).toBe('');
      // Y la escala semáforo ya no existe en el componente.
      expect(
        (component as unknown as Record<string, unknown>)['colorProgresoDia'],
      ).toBeUndefined();
    });

    it('no pinta la mini-barra en días sin disciplinas', async () => {
      const planSinDisciplinas: MiPlan = {
        ...planFixture,
        semanas: [
          {
            ...planFixture.semanas[1],
            dias: [{ fecha: '2026-07-17', diaSemana: 4, chips: [] }],
          },
        ],
      };
      serviceMock.miPlan!.mockReturnValue(of(planSinDisciplinas));

      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const prog = fixture.debugElement.query(
        By.css('[data-testid="pf-progreso-dia-2026-07-17"]'),
      );
      expect(prog).toBeFalsy();
    });

    it('muestra Descanso sin progreso 0 de 0 cuando el día solo tiene DESCANSO', async () => {
      const planConDescanso: MiPlan = {
        ...planFixture,
        semanas: [
          {
            ...planFixture.semanas[1],
            dias: [
              {
                fecha: '2026-07-17',
                diaSemana: 4,
                chips: [
                  {
                    disciplinaId: 99,
                    nombre: 'Descanso',
                    grupo: 'DESCANSO',
                    color: '#ffffff',
                    realizado: false,
                  },
                ],
              },
            ],
          },
        ],
      };
      serviceMock.miPlan!.mockReturnValue(of(planConDescanso));

      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(
        fixture.debugElement.query(
          By.css('[data-testid="pf-dia-descanso-2026-07-17"]'),
        ),
      ).toBeTruthy();
      expect(
        fixture.debugElement.query(
          By.css('[data-testid="pf-progreso-dia-2026-07-17"]'),
        ),
      ).toBeFalsy();
    });
  });

  it('cancela una carga pendiente al destruirse sin mutar estado ni navegar después', async () => {
    const bloques$ = new Subject<any>();
    const plan$ = new Subject<MiPlan>();
    serviceMock.misBloques!.mockReturnValue(bloques$);
    serviceMock.miPlan!.mockReturnValue(plan$);
    const router = TestBed.inject(Router);
    jest.clearAllMocks();

    fixture.detectChanges();
    fixture.destroy();
    bloques$.next([]);
    bloques$.complete();
    plan$.next(planFixture);
    plan$.complete();
    await Promise.resolve();

    expect(component['miPlan']()).toBeNull();
    expect(component['cargado']()).toBe(false);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it.each(['abc', '0', '-1', '1.5', '9007199254740992'])(
    'ignora bloqueId inválido %s',
    async (bloqueId) => {
      const route = TestBed.inject(ActivatedRoute) as any;
      route.snapshot.queryParamMap.get.mockReturnValue(bloqueId);

      fixture.detectChanges();
      await fixture.whenStable();

      expect(serviceMock.miPlan).toHaveBeenCalledWith(undefined);
    },
  );

  it('la última navegación gana y back/forward carga una vez por query', async () => {
    const params$ = new Subject<ReturnType<typeof convertToParamMap>>();
    const route = TestBed.inject(ActivatedRoute) as any;
    route.snapshot.queryParamMap.get.mockReturnValue(null);
    route.queryParamMap = params$;
    const inicial = new Subject<MiPlan>();
    const primera = new Subject<MiPlan>();
    const segunda = new Subject<MiPlan>();
    serviceMock.misBloques!.mockReturnValue(of([]));
    serviceMock
      .miPlan!.mockReturnValueOnce(inicial)
      .mockReturnValueOnce(primera)
      .mockReturnValueOnce(segunda)
      .mockReturnValue(of(planFixture));
    fixture = TestBed.createComponent(PlanificacionFisicaCalendarioComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    params$.next(convertToParamMap({ bloqueId: '1' }));
    params$.next(convertToParamMap({ bloqueId: '2' }));
    segunda.next({ ...planFixture, bloque: { ...planFixture.bloque, id: 2 } });
    segunda.complete();
    primera.next(planFixture);
    primera.complete();
    inicial.next(planFixture);
    inicial.complete();
    await fixture.whenStable();

    expect(component['miPlan']()?.bloque.id).toBe(2);
    expect(serviceMock.miPlan).toHaveBeenCalledTimes(3);

    params$.next(convertToParamMap({ bloqueId: '1' }));
    await fixture.whenStable();
    expect(serviceMock.miPlan).toHaveBeenCalledTimes(4);
  });

  it('recarga al volver al bloque efectivo tras cancelar la normalización de URL', async () => {
    const params$ = new Subject<ReturnType<typeof convertToParamMap>>();
    const route = TestBed.inject(ActivatedRoute) as any;
    const router = TestBed.inject(Router);
    route.snapshot.queryParamMap.get.mockReturnValue('999');
    route.queryParamMap = params$;
    (router.navigate as jest.Mock).mockResolvedValue(false);
    serviceMock.misBloques!.mockReturnValue(of([]));
    serviceMock.miPlan!.mockImplementation((bloqueId?: number) =>
      of({
        ...planFixture,
        bloque: { ...planFixture.bloque, id: bloqueId === 999 ? 1 : bloqueId! },
      }),
    );
    fixture = TestBed.createComponent(PlanificacionFisicaCalendarioComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();

    expect(serviceMock.miPlan).toHaveBeenCalledWith(999);
    expect(router.navigate).toHaveBeenCalledWith([], {
      relativeTo: route,
      queryParams: { bloqueId: 1 },
      replaceUrl: true,
    });

    params$.next(convertToParamMap({ bloqueId: '2' }));
    await fixture.whenStable();
    params$.next(convertToParamMap({ bloqueId: '1' }));
    await fixture.whenStable();

    expect(
      serviceMock.miPlan!.mock.calls.map(([bloqueId]) => bloqueId),
    ).toEqual([999, 2, 1]);
    expect(component['miPlan']()?.bloque.id).toBe(1);
    expect(component['bloqueSeleccionadoId']()).toBe(1);
  });
});
