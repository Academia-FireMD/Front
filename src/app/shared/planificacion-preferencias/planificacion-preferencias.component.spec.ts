import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NivelOposicion } from '../models/pregunta.model';
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

  it('marca el nivel como obligatorio', () => {
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Nivel *',
    );
  });

  it('no muestra el acceso al test por defecto', () => {
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain(
      'Hacer test de nivel',
    );
  });

  it('permite habilitar el acceso al test solo en una superficie de alumno', () => {
    const emitSpy = jest.spyOn(component.testNivelSolicitado, 'emit');
    component.permitirTestNivel = true;
    fixture.detectChanges();

    const boton = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
    ).find((element: Element) =>
      element.textContent?.includes('Hacer test de nivel'),
    ) as HTMLButtonElement;

    expect(boton).toBeTruthy();
    boton.click();
    expect(emitSpy).toHaveBeenCalledTimes(1);
  });

  it('puede ocultar por completo el selector de nivel', () => {
    component.mostrarNivel = false;
    component.permitirTestNivel = true;
    fixture.detectChanges();

    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).not.toContain('Nivel *');
    expect(texto).not.toContain('Hacer test de nivel');
  });

  it('muestra la etiqueta y la aclaración de horas de estudio', () => {
    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(texto).toContain('Horas disponibles para el estudio *');
    expect(texto).toContain(
      'Únicamente horas de estudio, no incluye el tiempo dedicado a la preparación física.',
    );
  });

  it('usa los nombres de oposición del contexto de planificación', () => {
    expect(component.planificacionLabelMap[Oposicion.GENERAL]).toBe(
      'General Comunidad Valenciana',
    );
    expect(component.planificacionLabelMap[Oposicion.MADRID]).toBe(
      'Comunidad de Madrid',
    );
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

    const valores = component.opcionesSelector.map((o) => o.value);
    expect(valores).toEqual([Oposicion.GENERAL, Oposicion.ALICANTE_CPBA]);
  });

  it('respeta una lista vacía devuelta por backend sin reintroducir opciones locales', () => {
    component.oposicionesPermitidas = [];
    component.nivelesPermitidos = [];
    component.franjasPermitidas = [];
    fixture.detectChanges();

    expect(component.opcionesSelector).toEqual([]);
    expect(component.opcionesNivel).toEqual([]);
    expect(component.opcionesFranja).toEqual([]);
  });

  it('por defecto lista todas las oposiciones del enum', () => {
    const valores = component.opcionesSelector.map((o) => o.value);
    expect(valores).toHaveLength(4);
  });

  it('conserva las referencias de opciones si el padre recrea arrays equivalentes', () => {
    component.oposicionesPermitidas = [Oposicion.GENERAL];
    component.nivelesPermitidos = [NivelOposicion.INICIACION];
    component.ngOnChanges();
    const selector = component.opcionesSelector;
    const niveles = component.opcionesNivel;

    component.oposicionesPermitidas = [Oposicion.GENERAL];
    component.nivelesPermitidos = [NivelOposicion.INICIACION];
    component.ngOnChanges();

    expect(component.opcionesSelector).toBe(selector);
    expect(component.opcionesNivel).toBe(niveles);
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
