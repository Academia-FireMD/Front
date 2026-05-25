import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ToastrService } from 'ngx-toastr';
import { COMMON_TEST_PROVIDERS } from '../../testing/common-providers';
import { Oposicion } from '../../shared/models/subscription.model';
import { Dificultad } from '../../shared/models/pregunta.model';
import { LeccionFormDialogComponent } from './leccion-form-dialog.component';

describe('LeccionFormDialogComponent', () => {
  let fixture: ComponentFixture<LeccionFormDialogComponent>;
  let component: LeccionFormDialogComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LeccionFormDialogComponent],
      providers: [...COMMON_TEST_PROVIDERS, provideHttpClient()],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();
    fixture = TestBed.createComponent(LeccionFormDialogComponent);
    component = fixture.componentInstance;
  });

  it('debe crearse con tipo VIDEO por defecto', () => {
    expect(component).toBeTruthy();
    expect(component.form.controls.tipo.value).toBe('VIDEO');
  });

  it('cambiar tipo a TEST exige temaId y numPreguntas (validators)', () => {
    component.form.controls.tipo.setValue('TEST');
    component.form.patchValue({ titulo: 'Test 1', orden: 1 });
    expect(component.form.controls.temaId.hasError('required')).toBe(true);
    expect(component.form.invalid).toBe(true);

    component.form.patchValue({ temaId: 5, numPreguntas: 10 });
    expect(component.form.controls.temaId.valid).toBe(true);
    expect(component.form.valid).toBe(true);
  });

  it('cambiar tipo a FLASHCARDS aplica las mismas reglas que TEST', () => {
    component.form.controls.tipo.setValue('FLASHCARDS');
    component.form.patchValue({ titulo: 'F1', orden: 1 });
    expect(component.form.controls.temaId.hasError('required')).toBe(true);
    component.form.patchValue({ temaId: 5, numPreguntas: 10 });
    expect(component.form.valid).toBe(true);
  });

  it('cambiar tipo de TEST→VIDEO limpia los campos de TEST', () => {
    component.form.controls.tipo.setValue('TEST');
    component.form.patchValue({
      titulo: 'Test 1',
      orden: 1,
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

  it('save() emite payload con tipo TipoLeccion correctamente tipado', () => {
    component.form.patchValue({
      titulo: 'V1',
      orden: 0,
      tipo: 'VIDEO',
      bunnyVideoId: 'abc',
      duracionSegundos: 600,
    });
    let received: any = null;
    component.saved.subscribe((result) => {
      received = result;
    });
    component.save();
    expect(received).not.toBeNull();
    expect(received.tipo).toBe('VIDEO');
    expect(received.bunnyVideoId).toBe('abc');
  });

  it('save() en TEST envía temaId, numPreguntas, dificultad y esDeRepaso', () => {
    fixture.detectChanges();
    component.form.controls.tipo.setValue('TEST');
    component.form.patchValue({
      titulo: 'Test 1',
      orden: 0,
      temaId: 9,
      numPreguntas: 25,
      dificultad: Dificultad.INTERMEDIO,
      esDeRepaso: true,
    });
    let received: any = null;
    component.saved.subscribe((result) => {
      received = result;
    });
    // Forzar validation sync por si effect aún no corrió.
    expect(component.form.valid).toBe(true);
    component.save();
    expect(received).not.toBeNull();
    expect(received.tipo).toBe('TEST');
    expect(received.temaId).toBe(9);
    expect(received.numPreguntas).toBe(25);
    expect(received.dificultad).toBe(Dificultad.INTERMEDIO);
    expect(received.esDeRepaso).toBe(true);
  });

  it('save() en TEST con dificultad=null omite el campo (mix de todas)', () => {
    fixture.detectChanges();
    component.form.controls.tipo.setValue('TEST');
    component.form.patchValue({
      titulo: 'Test mix',
      orden: 0,
      temaId: 9,
      numPreguntas: 10,
      dificultad: null,
    });
    let received: any = null;
    component.saved.subscribe((result) => {
      received = result;
    });
    expect(component.form.valid).toBe(true);
    component.save();
    expect(received).not.toBeNull();
    expect(received.dificultad).toBeUndefined();
  });

  it('numPreguntas > 50 marca form invalid (validator UI)', () => {
    component.form.controls.tipo.setValue('TEST');
    component.form.patchValue({
      titulo: 'T',
      orden: 0,
      tipo: 'TEST',
      temaId: 9,
      numPreguntas: 99,
    });
    expect(component.form.controls.numPreguntas.hasError('max')).toBe(true);
    expect(component.form.invalid).toBe(true);
  });

  it('input [oposicion] se propaga al picker de tema', () => {
    fixture.componentRef.setInput('oposicion', Oposicion.MADRID);
    fixture.detectChanges();
    expect(component.oposicion()).toBe(Oposicion.MADRID);
  });

  // BLOCKING-2 (codex review): save() debe bloquear y mostrar toast warning
  // si tipo es TEST/FLASHCARDS pero faltan temaId o numPreguntas.
  describe('BLOCKING-2: save() guards TEST/FLASHCARDS', () => {
    it('TEST sin temaId → save() NO emite + toast warning', () => {
      fixture.detectChanges();
      const toast = TestBed.inject(ToastrService);
      (toast.warning as jest.Mock).mockClear();
      component.form.controls.tipo.setValue('TEST');
      // Forzamos un payload donde el form sería "valid" si los validators
      // fallasen (escenario defensivo). Patcheamos temaId=null directamente.
      component.form.patchValue({
        titulo: 'T1',
        orden: 0,
        temaId: null,
        numPreguntas: 10,
      });
      // Por si el form quedara invalid por los validators, hacemos un
      // patch para que save() siga corriendo y la guard explícita actúe.
      // En este caso temaId=null hace el form invalid, así que primero
      // probamos la guard "directa" sobre form.invalid (early return) y
      // luego forzamos un escenario invalid-bypass para validar el toast.
      component.form.controls.temaId.clearValidators();
      component.form.controls.temaId.updateValueAndValidity();
      expect(component.form.valid).toBe(true);
      const emit = jest.fn();
      component.saved.subscribe(emit);
      component.save();
      expect(emit).not.toHaveBeenCalled();
      expect(toast.warning).toHaveBeenCalledWith(
        expect.stringContaining('tema'),
      );
    });

    it('TEST sin numPreguntas → save() NO emite + toast warning', () => {
      fixture.detectChanges();
      const toast = TestBed.inject(ToastrService);
      (toast.warning as jest.Mock).mockClear();
      component.form.controls.tipo.setValue('TEST');
      component.form.patchValue({
        titulo: 'T1',
        orden: 0,
        temaId: 5,
        numPreguntas: null,
      });
      // Relax validators para llegar a la guard explícita.
      component.form.controls.numPreguntas.clearValidators();
      component.form.controls.numPreguntas.updateValueAndValidity();
      expect(component.form.valid).toBe(true);
      const emit = jest.fn();
      component.saved.subscribe(emit);
      component.save();
      expect(emit).not.toHaveBeenCalled();
      expect(toast.warning).toHaveBeenCalledWith(
        expect.stringContaining('número de preguntas'),
      );
    });

    it('TEST con todos los fields → emite payload completo', () => {
      fixture.detectChanges();
      component.form.controls.tipo.setValue('TEST');
      component.form.patchValue({
        titulo: 'T1',
        orden: 0,
        temaId: 7,
        numPreguntas: 15,
      });
      expect(component.form.valid).toBe(true);
      const emit = jest.fn();
      component.saved.subscribe(emit);
      component.save();
      expect(emit).toHaveBeenCalledWith(
        expect.objectContaining({
          tipo: 'TEST',
          temaId: 7,
          numPreguntas: 15,
        }),
      );
    });

    it('FLASHCARDS sin temaId → save() NO emite + toast warning', () => {
      fixture.detectChanges();
      const toast = TestBed.inject(ToastrService);
      (toast.warning as jest.Mock).mockClear();
      component.form.controls.tipo.setValue('FLASHCARDS');
      component.form.patchValue({
        titulo: 'F1',
        orden: 0,
        temaId: null,
        numPreguntas: 10,
      });
      component.form.controls.temaId.clearValidators();
      component.form.controls.temaId.updateValueAndValidity();
      expect(component.form.valid).toBe(true);
      const emit = jest.fn();
      component.saved.subscribe(emit);
      component.save();
      expect(emit).not.toHaveBeenCalled();
      expect(toast.warning).toHaveBeenCalled();
    });
  });
});
