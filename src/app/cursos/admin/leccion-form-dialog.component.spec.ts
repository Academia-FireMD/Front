import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Leccion } from '../models/curso.model';
import {
  LeccionFormDialogComponent,
  LeccionFormResult,
} from './leccion-form-dialog.component';

// Consolidación 2026-06-11: el diálogo de lección es título-only (el contenido
// se gestiona con el builder de bloques). El spec refleja ese contrato.
describe('LeccionFormDialogComponent', () => {
  let fixture: ComponentFixture<LeccionFormDialogComponent>;
  let component: LeccionFormDialogComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LeccionFormDialogComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();
    fixture = TestBed.createComponent(LeccionFormDialogComponent);
    component = fixture.componentInstance;
  });

  it('arranca con un form de título vacío e inválido', () => {
    expect(component.form.controls.titulo.value).toBe('');
    expect(component.form.valid).toBe(false);
  });

  it('título < 2 chars → inválido; ≥ 2 → válido', () => {
    component.form.patchValue({ titulo: 'A' });
    expect(component.form.valid).toBe(false);
    component.form.patchValue({ titulo: 'Lección 1' });
    expect(component.form.valid).toBe(true);
  });

  it('save() emite { titulo } (sin orden — lo autocalcula el backend)', () => {
    component.form.patchValue({ titulo: 'Introducción' });
    let received: LeccionFormResult | null = null;
    component.saved.subscribe((r) => (received = r));
    component.save();
    expect(received).toEqual({ titulo: 'Introducción' });
  });

  it('save() no emite si el form es inválido', () => {
    const emit = jest.fn();
    component.saved.subscribe(emit);
    component.save();
    expect(emit).not.toHaveBeenCalled();
  });

  it('editar una lección precarga el título', () => {
    fixture.componentRef.setInput('leccion', {
      id: 5,
      titulo: 'Capítulo avanzado',
      orden: 2,
      tipo: 'VIDEO',
      seccionId: 1,
    } as Leccion);
    component.ngOnChanges();
    expect(component.esEdicion()).toBe(true);
    expect(component.form.controls.titulo.value).toBe('Capítulo avanzado');
  });

  it('cerrar el diálogo emite (cancelled)', () => {
    const emit = jest.fn();
    component.cancelled.subscribe(emit);
    component.onVisibleChange(false);
    expect(emit).toHaveBeenCalled();
  });
});
