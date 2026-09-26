import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { COMMON_TEST_PROVIDERS } from '../../testing';

import { BloquesEditComponent } from './bloques-edit.component';

describe('BloquesEditComponent', () => {
  let component: BloquesEditComponent;
  let fixture: ComponentFixture<BloquesEditComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [BloquesEditComponent],
      providers: [...COMMON_TEST_PROVIDERS],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(BloquesEditComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('clona con identidad de formulario propia y persiste el orden elegido', () => {
    const original = (component as any).getEmptySubBloqueForm();
    original.patchValue({ id: 42, nombre: 'Origen', duracion: 30 });
    component.subBloques.push(original);
    component.clonarSubbloque(original.value as any, 1);
    const [primero, segundo] = component.subBloques.value;
    expect(segundo.id).toBeNull();
    expect(segundo.controlId).not.toBe(primero.controlId);

    component.reordenarSubBloques({ value: [segundo, primero] });
    expect(
      component.subBloques.value.map((item: any) => item.controlId),
    ).toEqual([segundo.controlId, primero.controlId]);
  });
});
