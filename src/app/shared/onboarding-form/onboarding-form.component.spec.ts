import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ToastrService } from 'ngx-toastr';
import { of } from 'rxjs';
import { AutoasignacionService } from '../../planificacion/services/autoasignacion.service';
import { NivelOposicion } from '../models/pregunta.model';
import { Oposicion } from '../models/subscription.model';
import type { TipoDePlanificacionDeseada } from '../models/user.model';
import { PlanificacionPreferenciasComponent } from '../planificacion-preferencias/planificacion-preferencias.component';
import { OnboardingFormComponent } from './onboarding-form.component';

describe('OnboardingFormComponent (regresión tras extraer preferencias)', () => {
  let component: OnboardingFormComponent;
  let fixture: ComponentFixture<OnboardingFormComponent>;
  let autoasignacion: { getConfiguracion$: jest.Mock };

  beforeEach(async () => {
    autoasignacion = {
      getConfiguracion$: jest.fn(() =>
        of({
          estado: 'REQUIERE_CONFIGURACION',
          preferenciasPrecargadas: {
            oposicion: null,
            nivel: null,
            franja: null,
          },
          oposicionesPermitidas: [],
          configuracionActiva: null,
          estadoTest: null,
        }),
      ),
    };
    await TestBed.configureTestingModule({
      imports: [OnboardingFormComponent, PlanificacionPreferenciasComponent],
      providers: [
        provideNoopAnimations(),
        { provide: AutoasignacionService, useValue: autoasignacion },
        {
          provide: ToastrService,
          useValue: { error: jest.fn(), warning: jest.fn() },
        },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(OnboardingFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('no muestra ni consulta el test cuando el feature flag está apagado', () => {
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector(
        '[data-testid="onboarding-test-nivel"]',
      ),
    ).toBeNull();
    expect(autoasignacion.getConfiguracion$).not.toHaveBeenCalled();
  });

  it('con el flag activo recupera estadoTest y sincroniza su nivel sobre la configuración activa', () => {
    const estadoTest = {
      evaluacionId: 8,
      completado: true,
      nivelRecomendado: NivelOposicion.AVANZADO,
      nivelElegido: NivelOposicion.INICIACION,
      versionCuestionario: 42,
      aceptadaEn: '2026-09-15T12:00:00.000Z',
    };
    autoasignacion.getConfiguracion$.mockReturnValueOnce(
      of({
        estado: 'ACTIVA',
        preferenciasPrecargadas: {
          oposicion: Oposicion.MADRID,
          nivel: NivelOposicion.INICIACION,
          franja: 'FRANJA_CUATRO_A_SEIS_HORAS',
        },
        oposicionesPermitidas: [Oposicion.MADRID],
        estadoTest,
        configuracionActiva: {
          variante: {
            codigo: 'MADRID-A-68',
            oposicion: Oposicion.MADRID,
            nivel: NivelOposicion.AVANZADO,
            franja: 'FRANJA_SEIS_A_OCHO_HORAS',
          },
          version: 2,
          fechaVigencia: '2026-09-15',
          origen: 'ALUMNO',
          planificacionMensual: null,
        },
      }),
    );
    component.permitirTestNivel = true;
    component.ngOnChanges();
    fixture.detectChanges();

    expect(autoasignacion.getConfiguracion$).toHaveBeenCalled();
    expect(component.estadoTest).toEqual(estadoTest);
    expect(component.formGroup.value).toEqual(
      expect.objectContaining({
        tipoOposicion: [Oposicion.MADRID],
        nivelOposicion: NivelOposicion.INICIACION,
        tipoDePlanificacionDuracionDeseada: 'FRANJA_SEIS_A_OCHO_HORAS',
      }),
    );
    expect(
      fixture.nativeElement.querySelector(
        '[data-testid="onboarding-test-nivel"]',
      ),
    ).toBeTruthy();
  });

  it('sin configuración activa conserva los demás campos y precarga el nivel aceptado', () => {
    component.formGroup.patchValue({
      tipoOposicion: [Oposicion.ALICANTE_CPBA],
      nivelOposicion: NivelOposicion.AVANZADO,
      tipoDePlanificacionDuracionDeseada: 'FRANJA_CUATRO_A_SEIS_HORAS',
    });
    autoasignacion.getConfiguracion$.mockReturnValueOnce(
      of({
        estado: 'REQUIERE_CONFIGURACION',
        preferenciasPrecargadas: {
          oposicion: Oposicion.ALICANTE_CPBA,
          nivel: NivelOposicion.AVANZADO,
          franja: 'FRANJA_CUATRO_A_SEIS_HORAS',
        },
        oposicionesPermitidas: [Oposicion.ALICANTE_CPBA],
        configuracionActiva: null,
        estadoTest: {
          evaluacionId: 9,
          completado: true,
          nivelRecomendado: NivelOposicion.INICIACION,
          nivelElegido: NivelOposicion.INICIACION,
          versionCuestionario: 42,
          aceptadaEn: '2026-09-16T09:00:00.000Z',
        },
      }),
    );

    component.permitirTestNivel = true;
    component.ngOnChanges();

    expect(component.formGroup.value).toEqual(
      expect.objectContaining({
        tipoOposicion: [Oposicion.ALICANTE_CPBA],
        nivelOposicion: NivelOposicion.INICIACION,
        tipoDePlanificacionDuracionDeseada: 'FRANJA_CUATRO_A_SEIS_HORAS',
      }),
    );
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('emite los mismos campos de oposición/nivel/franja al enviar con datos iniciales', () => {
    component.initialData = {
      tipoOposicion: [Oposicion.VALENCIA_AYUNTAMIENTO],
      nivelOposicion: NivelOposicion.AVANZADO,
      tipoDePlanificacionDuracionDeseada:
        'FRANJA_SEIS_A_OCHO_HORAS' as TipoDePlanificacionDeseada,
    };
    component.ngOnChanges();
    fixture.detectChanges();

    let emitido: any;
    component.dataSubmitted.subscribe((data) => (emitido = data));

    component.onSubmit();

    expect(emitido?.tipoOposicion).toEqual([Oposicion.VALENCIA_AYUNTAMIENTO]);
    expect(emitido?.nivelOposicion).toBe(NivelOposicion.AVANZADO);
    expect(emitido?.tipoDePlanificacionDuracionDeseada).toBe(
      'FRANJA_SEIS_A_OCHO_HORAS',
    );
  });

  it('el subcomponente compartido actualiza el formGroup del onboarding', () => {
    const preferencias = fixture.debugElement.query(
      (de) =>
        de.componentInstance instanceof PlanificacionPreferenciasComponent,
    );

    preferencias.componentInstance.formGroup.patchValue({
      oposicion: [Oposicion.ALICANTE_CPBA],
      nivel: NivelOposicion.INICIACION,
      franja: 'FRANJA_CUATRO_A_SEIS_HORAS',
    });

    expect(component.formGroup.value.tipoOposicion).toEqual([
      Oposicion.ALICANTE_CPBA,
    ]);
    expect(component.formGroup.value.nivelOposicion).toBe(
      NivelOposicion.INICIACION,
    );
    expect(component.formGroup.value.tipoDePlanificacionDuracionDeseada).toBe(
      'FRANJA_CUATRO_A_SEIS_HORAS',
    );
  });
});
