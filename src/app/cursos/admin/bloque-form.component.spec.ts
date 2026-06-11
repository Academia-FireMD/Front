import { provideHttpClient } from '@angular/common/http';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ToastrService } from 'ngx-toastr';
import { Dificultad } from '../../shared/models/pregunta.model';
import { Oposicion } from '../../shared/models/subscription.model';
import { Bloque } from '../models/curso.model';
import { BloqueFormComponent, BloqueFormResult } from './bloque-form.component';

describe('BloqueFormComponent', () => {
  let fixture: ComponentFixture<BloqueFormComponent>;
  let component: BloqueFormComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BloqueFormComponent],
      providers: [
        provideHttpClient(),
        {
          provide: ToastrService,
          useValue: {
            warning: jest.fn(),
            success: jest.fn(),
            error: jest.fn(),
          },
        },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();
    fixture = TestBed.createComponent(BloqueFormComponent);
    component = fixture.componentInstance;
  });

  it('arranca con tipo VIDEO por defecto', () => {
    expect(component.form.controls.tipo.value).toBe('VIDEO');
  });

  it('CUESTIONARIO no es una opción creable (Fase 2)', () => {
    const tipos = component.tipoOptions.map((o) => o.value);
    expect(tipos).toEqual(['VIDEO', 'TEXTO', 'TEST']);
    expect(tipos).not.toContain('CUESTIONARIO');
  });

  it('cambiar a TEST exige temaId y numPreguntas', () => {
    component.form.controls.tipo.setValue('TEST');
    expect(component.form.controls.temaId.hasError('required')).toBe(true);
    expect(component.form.invalid).toBe(true);
    component.form.patchValue({ temaId: 5, numPreguntas: 10 });
    expect(component.form.valid).toBe(true);
  });

  it('cambiar TEST→VIDEO limpia los campos de TEST', () => {
    component.form.controls.tipo.setValue('TEST');
    component.form.patchValue({
      temaId: 5,
      numPreguntas: 10,
      esDeRepaso: true,
    });
    expect(component.form.value.temaId).toBe(5);
    component.form.controls.tipo.setValue('VIDEO');
    expect(component.form.value.temaId).toBeNull();
    expect(component.form.value.numPreguntas).toBeNull();
    expect(component.form.value.esDeRepaso).toBe(false);
  });

  it('save() VIDEO sin bunnyVideoId NO emite + warning', () => {
    const toast = TestBed.inject(ToastrService);
    const emit = jest.fn();
    component.saved.subscribe(emit);
    component.save();
    expect(emit).not.toHaveBeenCalled();
    expect(toast.warning).toHaveBeenCalled();
  });

  it('save() VIDEO con bunnyVideoId emite payload', () => {
    component.form.patchValue({ bunnyVideoId: 'abc', duracionSegundos: 300 });
    let received: BloqueFormResult | null = null;
    component.saved.subscribe((r) => (received = r));
    component.save();
    expect(received).not.toBeNull();
    expect(received!.tipo).toBe('VIDEO');
    expect(received!.bunnyVideoId).toBe('abc');
    expect(received!.duracionSegundos).toBe(300);
  });

  it('save() TEXTO vacío NO emite + warning', () => {
    const toast = TestBed.inject(ToastrService);
    component.form.controls.tipo.setValue('TEXTO');
    component.form.patchValue({ contenidoMarkdown: '   ' });
    const emit = jest.fn();
    component.saved.subscribe(emit);
    component.save();
    expect(emit).not.toHaveBeenCalled();
    expect(toast.warning).toHaveBeenCalled();
  });

  it('save() TEXTO con contenido emite payload', () => {
    component.form.controls.tipo.setValue('TEXTO');
    component.form.patchValue({ contenidoMarkdown: '# Hola' });
    let received: BloqueFormResult | null = null;
    component.saved.subscribe((r) => (received = r));
    component.save();
    expect(received).not.toBeNull();
    expect(received!.tipo).toBe('TEXTO');
    expect(received!.contenidoMarkdown).toBe('# Hola');
  });

  it('save() TEST emite temaId, numPreguntas, dificultad, esDeRepaso', () => {
    component.form.controls.tipo.setValue('TEST');
    component.form.patchValue({
      temaId: 9,
      numPreguntas: 20,
      dificultad: Dificultad.INTERMEDIO,
      esDeRepaso: true,
    });
    let received: BloqueFormResult | null = null;
    component.saved.subscribe((r) => (received = r));
    component.save();
    expect(received).not.toBeNull();
    expect(received!.tipo).toBe('TEST');
    expect(received!.temaId).toBe(9);
    expect(received!.numPreguntas).toBe(20);
    expect(received!.dificultad).toBe(Dificultad.INTERMEDIO);
    expect(received!.esDeRepaso).toBe(true);
  });

  it('save() TEST con dificultad=null omite el campo', () => {
    component.form.controls.tipo.setValue('TEST');
    component.form.patchValue({
      temaId: 9,
      numPreguntas: 10,
      dificultad: null,
    });
    let received: BloqueFormResult | null = null;
    component.saved.subscribe((r) => (received = r));
    component.save();
    expect(received).not.toBeNull();
    expect(received!.dificultad).toBeUndefined();
  });

  it('editando un bloque deshabilita el cambio de tipo y precarga el form', () => {
    const bloque: Bloque = {
      id: 3,
      leccionId: 1,
      orden: 0,
      tipo: 'TEST',
      temaId: 14,
      numPreguntas: 12,
      esDeRepaso: false,
    };
    fixture.componentRef.setInput('bloque', bloque);
    component.ngOnChanges();
    expect(component.esEdicion()).toBe(true);
    expect(component.form.value.tipo).toBe('TEST');
    expect(component.form.value.temaId).toBe(14);
    expect(component.form.value.numPreguntas).toBe(12);
  });

  it('[oposicion] se propaga', () => {
    fixture.componentRef.setInput('oposicion', Oposicion.MADRID);
    fixture.detectChanges();
    expect(component.oposicion()).toBe(Oposicion.MADRID);
  });
});
