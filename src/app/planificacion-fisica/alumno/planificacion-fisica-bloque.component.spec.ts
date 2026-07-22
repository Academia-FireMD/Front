import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { COMMON_TEST_PROVIDERS } from '../../testing/common-providers';
import { Oposicion } from '../../shared/models/subscription.model';
import {
  MiPlanCompleto,
  PlanificacionFisicaService,
} from '../services/planificacion-fisica.service';
import { PlanificacionFisicaBloqueComponent } from './planificacion-fisica-bloque.component';

describe('PlanificacionFisicaBloqueComponent', () => {
  let fixture: ComponentFixture<PlanificacionFisicaBloqueComponent>;
  let component: PlanificacionFisicaBloqueComponent;
  let serviceMock: Partial<Record<keyof PlanificacionFisicaService, jest.Mock>>;

  const planFixture: MiPlanCompleto = {
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
        enVentana: false,
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
        enVentana: true,
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
      miPlanCompleto: jest.fn().mockReturnValue(of(planFixture)),
      misBloques: jest.fn().mockReturnValue(of([])),
    };

    await TestBed.configureTestingModule({
      imports: [PlanificacionFisicaBloqueComponent, NoopAnimationsModule],
      providers: [
        ...COMMON_TEST_PROVIDERS,
        { provide: PlanificacionFisicaService, useValue: serviceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PlanificacionFisicaBloqueComponent);
    component = fixture.componentInstance;
  });

  it('carga el plan completo y pinta todas las semanas del bloque', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(serviceMock.miPlanCompleto).toHaveBeenCalled();
    expect(component['miPlan']()).toEqual(planFixture);

    const semana1 = fixture.debugElement.query(
      By.css('[data-testid="pf-bloque-semana-10"]'),
    );
    const semana2 = fixture.debugElement.query(
      By.css('[data-testid="pf-bloque-semana-11"]'),
    );
    expect(semana1).not.toBeNull();
    expect(semana2).not.toBeNull();
    expect(semana1.attributes['data-en-ventana']).toBe('false');
    expect(semana2.attributes['data-en-ventana']).toBe('true');
  });

  it('los días fuera de ventana se renderizan disabled', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const diaFuera = fixture.debugElement.query(
      By.css('[data-testid="pf-bloque-dia-2026-07-08"]'),
    );
    const diaDentro = fixture.debugElement.query(
      By.css('[data-testid="pf-bloque-dia-2026-07-17"]'),
    );
    expect(diaFuera.nativeElement.disabled).toBe(true);
    expect(diaDentro.nativeElement.disabled).toBe(false);
  });

  it('abrirDia NO navega cuando la semana está fuera de la ventana', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    const router = TestBed.inject(Router);
    (router.navigate as jest.Mock).mockClear();

    component['abrirDia']('2026-07-08', false);

    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('abrirDia navega al detalle cuando la semana está en la ventana', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    const router = TestBed.inject(Router);
    (router.navigate as jest.Mock).mockClear();

    component['abrirDia']('2026-07-17', true);

    expect(router.navigate).toHaveBeenCalledWith([
      '/app/planificacion-fisica',
      'dia',
      '2026-07-17',
    ]);
  });

  it('volverAlCalendario navega al calendario de 4 semanas', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    const router = TestBed.inject(Router);
    (router.navigate as jest.Mock).mockClear();

    component['volverAlCalendario']();

    expect(router.navigate).toHaveBeenCalledWith(['/app/planificacion-fisica']);
  });

  it('muestra la píldora de upsell cuando el backend responde 403 TIER_TOO_LOW', async () => {
    serviceMock.miPlanCompleto!.mockReturnValue(
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
    expect(pill).not.toBeNull();
  });
});
