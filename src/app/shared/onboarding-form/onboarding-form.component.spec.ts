import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { OnboardingFormComponent } from './onboarding-form.component';

describe('OnboardingFormComponent — ficha personal sin preferencias duplicadas', () => {
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

  it('no ofrece oposición, nivel u horas como controles editables', () => {
    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).not.toContain('Oposiciones de interés');
    expect(component.formGroup.contains('tipoOposicion')).toBe(false);
    expect(component.formGroup.contains('nivelOposicion')).toBe(false);
    expect(
      component.formGroup.contains('tipoDePlanificacionDuracionDeseada'),
    ).toBe(false);
  });

  it('no envía valores legados de planificación aunque existan en los datos iniciales', () => {
    component.initialData = {
      dni: '12345678Z',
      tipoOposicion: [] as any,
      nivelOposicion: 'AVANZADO' as any,
      tipoDePlanificacionDuracionDeseada: 'FRANJA_SEIS_A_OCHO_HORAS' as any,
    };
    component.ngOnChanges();
    let emitido: any;
    component.dataSubmitted.subscribe((data) => (emitido = data));
    component.onSubmit();
    expect(emitido.dni).toBe('12345678Z');
    expect(emitido.tipoOposicion).toBeUndefined();
    expect(emitido.nivelOposicion).toBeUndefined();
    expect(emitido.tipoDePlanificacionDuracionDeseada).toBeUndefined();
  });
});
