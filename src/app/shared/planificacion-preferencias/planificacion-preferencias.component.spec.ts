import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Oposicion } from '../models/subscription.model';
import {
  PlanificacionPreferenciasComponent,
  PreferenciasPlanificacion,
} from './planificacion-preferencias.component';

describe('PlanificacionPreferenciasComponent', () => {
  let component: PlanificacionPreferenciasComponent;
  let fixture: ComponentFixture<PlanificacionPreferenciasComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlanificacionPreferenciasComponent],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(PlanificacionPreferenciasComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('precarga los valores iniciales', () => {
    component.valoresIniciales = {
      oposicion: Oposicion.VALENCIA_AYUNTAMIENTO,
      nivel: 'AVANZADO',
      franja: 'FRANJA_SEIS_A_OCHO_HORAS',
    };
    component.ngOnChanges();
    fixture.detectChanges();

    expect(component.formGroup.value.oposicion).toBe(
      Oposicion.VALENCIA_AYUNTAMIENTO,
    );
    expect(component.formGroup.value.nivel).toBe('AVANZADO');
    expect(component.formGroup.value.franja).toBe('FRANJA_SEIS_A_OCHO_HORAS');
  });

  it('filtra las oposiciones por oposicionesPermitidas', () => {
    component.oposicionesPermitidas = [
      Oposicion.GENERAL,
      Oposicion.ALICANTE_CPBA,
    ];
    fixture.detectChanges();

    const valores = component.opcionesOposicion.map((o) => o.value);
    expect(valores).toEqual([Oposicion.GENERAL, Oposicion.ALICANTE_CPBA]);
  });

  it('por defecto lista todas las oposiciones del enum', () => {
    const valores = component.opcionesOposicion.map((o) => o.value);
    expect(valores).toHaveLength(4);
  });

  it('emite los cambios al modificar un control (modo simple)', () => {
    let emitido: PreferenciasPlanificacion | undefined;
    component.cambios.subscribe((c) => (emitido = c));

    component.formGroup.patchValue({ oposicion: Oposicion.MADRID });

    expect(emitido?.oposicion).toBe(Oposicion.MADRID);
  });

  it('en modo multiple la oposición se emite como array', () => {
    component.multiple = true;
    component.valoresIniciales = { oposicion: [], nivel: null, franja: null };
    component.ngOnChanges();
    fixture.detectChanges();

    let emitido: PreferenciasPlanificacion | undefined;
    component.cambios.subscribe((c) => (emitido = c));

    component.formGroup.patchValue({
      oposicion: [Oposicion.VALENCIA_AYUNTAMIENTO, Oposicion.ALICANTE_CPBA],
    });

    expect(Array.isArray(emitido?.oposicion)).toBe(true);
    expect(emitido?.oposicion).toEqual([
      Oposicion.VALENCIA_AYUNTAMIENTO,
      Oposicion.ALICANTE_CPBA,
    ]);
  });
});
