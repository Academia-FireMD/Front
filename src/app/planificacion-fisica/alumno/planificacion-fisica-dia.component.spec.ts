import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { COMMON_TEST_PROVIDERS } from '../../testing/common-providers';
import { Oposicion } from '../../shared/models/subscription.model';
import {
  DiaDetalle,
  MiPlan,
  PlanificacionFisicaService,
} from '../services/planificacion-fisica.service';
import { PlanificacionFisicaDiaComponent } from './planificacion-fisica-dia.component';

describe('PlanificacionFisicaDiaComponent', () => {
  let fixture: ComponentFixture<PlanificacionFisicaDiaComponent>;
  let component: PlanificacionFisicaDiaComponent;
  let serviceMock: Partial<Record<keyof PlanificacionFisicaService, jest.Mock>>;

  const diaFixture: DiaDetalle = {
    fecha: '2026-07-17',
    comentarioSemana: 'Semana de carga',
    comentarioGeneral: 'Bloque general',
    disciplinas: [
      {
        asignacionId: 501,
        disciplinaId: 1,
        nombre: 'Cuerda',
        grupo: 'CUERDA',
        color: '#9fe2d0',
        contenido: '3x10m',
        comentario: null,
        realizado: false,
      },
      {
        asignacionId: 502,
        disciplinaId: 2,
        nombre: 'Carrera',
        grupo: 'CARRERA',
        color: '#fdeaa8',
        contenido: null,
        comentario: 'suave',
        realizado: true,
      },
    ],
  };

  const miPlanFixture: MiPlan = {
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
        fechaInicio: '2026-07-17',
        intensidad: 20,
        comentarioSemana: null,
        esActual: true,
        esAnterior: false,
        soloLectura: false,
        progreso: { hechas: 1, total: 2 },
        dias: [{ fecha: '2026-07-17', diaSemana: 5, chips: [] }],
      },
    ],
  };

  function setup(fecha = '2026-07-17'): void {
    TestBed.overrideProvider(ActivatedRoute, {
      useValue: {
        snapshot: { paramMap: { get: () => fecha } },
      },
    });
    fixture = TestBed.createComponent(PlanificacionFisicaDiaComponent);
    component = fixture.componentInstance;
  }

  beforeEach(async () => {
    serviceMock = {
      dia: jest.fn().mockReturnValue(of(diaFixture)),
      miPlan: jest.fn().mockReturnValue(of(miPlanFixture)),
      marcarProgreso: jest
        .fn()
        .mockReturnValue(
          of({ realizado: true, realizadoEn: '2026-07-17T10:00:00Z' }),
        ),
    };

    await TestBed.configureTestingModule({
      imports: [PlanificacionFisicaDiaComponent, NoopAnimationsModule],
      providers: [
        ...COMMON_TEST_PROVIDERS,
        { provide: PlanificacionFisicaService, useValue: serviceMock },
      ],
    }).compileComponents();
  });

  it('carga el día y pinta cada disciplina con su contenido', async () => {
    setup();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(serviceMock.dia).toHaveBeenCalledWith('2026-07-17');
    expect(component['detalle']()).toEqual(diaFixture);

    const html = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(html).toContain('3x10m');
    expect(html).toContain('Sin detalle aún.');
  });

  it('marcar progreso llama al servicio y actualiza el estado local', async () => {
    setup();
    fixture.detectChanges();
    await fixture.whenStable();

    await component['toggle'](diaFixture.disciplinas[0]);

    expect(serviceMock.marcarProgreso).toHaveBeenCalledWith(501, true);
    expect(
      component['detalle']()?.disciplinas.find((d) => d.asignacionId === 501)
        ?.realizado,
    ).toBe(true);
  });

  it('deduce soloLectura cruzando con mi-plan y NO permite marcar en la semana anterior', async () => {
    serviceMock.miPlan!.mockReturnValue(
      of({
        ...miPlanFixture,
        semanas: [{ ...miPlanFixture.semanas[0], soloLectura: true }],
      }),
    );
    setup();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component['soloLectura']()).toBe(true);

    await component['toggle'](diaFixture.disciplinas[0]);
    // No debe haber llamado al backend: la UI bloquea el toggle localmente.
    expect(serviceMock.marcarProgreso).not.toHaveBeenCalled();

    const aviso = fixture.debugElement.query(
      By.css('[data-testid="pf-dia-solo-lectura"]'),
    );
    expect(aviso).toBeTruthy();
  });

  it('muestra la píldora de upsell cuando `dia()` responde 403 TIER_TOO_LOW', async () => {
    serviceMock.dia!.mockReturnValue(
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
    setup();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const pill = fixture.debugElement.query(
      By.css('[data-testid="pf-upsell-pill"]'),
    );
    expect(pill).toBeTruthy();
  });

  it('volver navega al calendario', async () => {
    setup();
    fixture.detectChanges();
    await fixture.whenStable();

    component['volver']();

    const router = TestBed.inject(Router);
    expect(router.navigate).toHaveBeenCalledWith(['/app/planificacion-fisica']);
  });
});
