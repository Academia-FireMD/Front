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

  it('CUESTIONARIO es una opción creable (Fase 2)', () => {
    const tipos = component.tipoOptions.map((o) => o.value);
    expect(tipos).toEqual(['VIDEO', 'TEXTO', 'TEST', 'CUESTIONARIO']);
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

  describe('CUESTIONARIO authoring', () => {
    it('al elegir CUESTIONARIO siembra una pregunta con 2 opciones', () => {
      component.form.controls.tipo.setValue('CUESTIONARIO');
      expect(component.preguntas.length).toBe(1);
      expect(component.opcionesDe(component.preguntas.at(0)).length).toBe(2);
    });

    it('addPregunta / removePregunta gestionan el array (mín. 1)', () => {
      component.form.controls.tipo.setValue('CUESTIONARIO');
      component.addPregunta();
      expect(component.preguntas.length).toBe(2);
      component.removePregunta(1);
      expect(component.preguntas.length).toBe(1);
    });

    it('addOpcion / removeOpcion (mín. 2) y reajuste de correcta', () => {
      component.form.controls.tipo.setValue('CUESTIONARIO');
      const p = component.preguntas.at(0);
      component.addOpcion(p); // 3 opciones
      component.marcarCorrecta(p, 2);
      expect(p.controls.respuestaCorrecta.value).toBe(2);
      component.removeOpcion(p, 2); // vuelve a 2 → correcta reajustada a 1
      expect(component.opcionesDe(p).length).toBe(2);
      expect(p.controls.respuestaCorrecta.value).toBe(1);
      component.removeOpcion(p, 0); // no baja de 2
      expect(component.opcionesDe(p).length).toBe(2);
    });

    it('save() emite preguntas válidas (filtra opciones vacías)', () => {
      component.form.controls.tipo.setValue('CUESTIONARIO');
      const p = component.preguntas.at(0);
      p.controls.enunciado.setValue('¿Capital?');
      component.addOpcion(p); // 3ª opción que dejamos vacía → debe filtrarse
      const opciones = component.opcionesDe(p);
      opciones.at(0).setValue('Madrid');
      opciones.at(1).setValue('Lisboa');
      component.marcarCorrecta(p, 0);
      let received: BloqueFormResult | null = null;
      component.saved.subscribe((r) => (received = r));
      component.save();
      expect(received).not.toBeNull();
      expect(received!.tipo).toBe('CUESTIONARIO');
      expect(received!.preguntas).toEqual([
        {
          enunciado: '¿Capital?',
          opciones: ['Madrid', 'Lisboa'],
          respuestaCorrecta: 0,
        },
      ]);
    });

    it('save() con enunciado vacío NO emite + warning', () => {
      const toast = TestBed.inject(ToastrService);
      component.form.controls.tipo.setValue('CUESTIONARIO');
      const p = component.preguntas.at(0);
      component.opcionesDe(p).at(0).setValue('a');
      component.opcionesDe(p).at(1).setValue('b');
      // enunciado vacío
      const emit = jest.fn();
      component.saved.subscribe(emit);
      component.save();
      expect(emit).not.toHaveBeenCalled();
      expect(toast.warning).toHaveBeenCalled();
    });

    it('editar un bloque CUESTIONARIO precarga sus preguntas', () => {
      fixture.componentRef.setInput('bloque', {
        id: 5,
        leccionId: 1,
        orden: 0,
        tipo: 'CUESTIONARIO',
        bloquePreguntas: [
          {
            id: 1,
            bloqueId: 5,
            orden: 0,
            enunciado: 'Q1',
            opciones: ['x', 'y', 'z'],
            respuestaCorrecta: 2,
            explicacion: 'porque z',
          },
        ],
      } as Bloque);
      component.ngOnChanges();
      expect(component.preguntas.length).toBe(1);
      const p = component.preguntas.at(0);
      expect(p.controls.enunciado.value).toBe('Q1');
      expect(component.opcionesDe(p).length).toBe(3);
      expect(p.controls.respuestaCorrecta.value).toBe(2);
      expect(p.controls.explicacion.value).toBe('porque z');
    });

    it('cambiar de CUESTIONARIO a VIDEO limpia las preguntas', () => {
      component.form.controls.tipo.setValue('CUESTIONARIO');
      expect(component.preguntas.length).toBe(1);
      component.form.controls.tipo.setValue('VIDEO');
      expect(component.preguntas.length).toBe(0);
    });
  });
});
