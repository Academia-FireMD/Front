import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { NivelOposicion } from '../models/pregunta.model';
import { Oposicion } from '../models/subscription.model';
import type { TipoDePlanificacionDeseada } from '../models/user.model';
import { PlanificacionPreferenciasComponent } from '../planificacion-preferencias/planificacion-preferencias.component';
import { OnboardingFormComponent } from './onboarding-form.component';

describe('OnboardingFormComponent (regresión tras extraer preferencias)', () => {
  let component: OnboardingFormComponent;
  let fixture: ComponentFixture<OnboardingFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OnboardingFormComponent, PlanificacionPreferenciasComponent],
      providers: [provideNoopAnimations()],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(OnboardingFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
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
