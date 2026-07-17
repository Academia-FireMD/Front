import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
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
    expect(router.navigate).toHaveBeenCalledWith([
      '/app/planificacion-fisica',
      'dia',
      '2026-07-17',
    ]);
  });
});
