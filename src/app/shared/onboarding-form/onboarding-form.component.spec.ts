import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { NivelOposicion } from '../models/pregunta.model';
import { Oposicion } from '../models/subscription.model';
import type { TipoDePlanificacionDeseada } from '../models/user.model';
import { OnboardingFormComponent } from './onboarding-form.component';

describe('OnboardingFormComponent', () => {
  let component: OnboardingFormComponent;
  let fixture: ComponentFixture<OnboardingFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OnboardingFormComponent],
      providers: [provideNoopAnimations()],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(OnboardingFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('no duplica oposición, nivel ni franja del gestor en la ficha compartida', () => {
    component.initialData = {
      tipoOposicion: [Oposicion.VALENCIA_AYUNTAMIENTO],
      nivelOposicion: NivelOposicion.AVANZADO,
      tipoDePlanificacionDuracionDeseada:
        'FRANJA_SEIS_A_OCHO_HORAS' as TipoDePlanificacionDeseada,
      dni: '12345678A',
    };
    component.ngOnChanges();
    fixture.detectChanges();

    expect(component.formGroup.contains('tipoOposicion')).toBe(false);
    expect(component.formGroup.contains('nivelOposicion')).toBe(false);
    expect(
      component.formGroup.contains('tipoDePlanificacionDuracionDeseada'),
    ).toBe(false);
    expect(
      fixture.nativeElement.querySelector('app-planificacion-preferencias'),
    ).toBeNull();
  });

  it('permite guardar datos personales sin emitir ni sobrescribir las preferencias de planificación', () => {
    component.initialData = {
      tipoOposicion: [Oposicion.VALENCIA_AYUNTAMIENTO],
      nivelOposicion: NivelOposicion.AVANZADO,
      tipoDePlanificacionDuracionDeseada:
        'FRANJA_SEIS_A_OCHO_HORAS' as TipoDePlanificacionDeseada,
      dni: '12345678A',
    };
    component.ngOnChanges();

    let emitido: any;
    component.dataSubmitted.subscribe((data) => (emitido = data));
    component.formGroup.patchValue({ dni: '87654321B' });
    component.onSubmit();

    expect(emitido).toMatchObject({ dni: '87654321B' });
    expect(emitido).not.toHaveProperty('tipoOposicion');
    expect(emitido).not.toHaveProperty('nivelOposicion');
    expect(emitido).not.toHaveProperty('tipoDePlanificacionDuracionDeseada');
  });
});
