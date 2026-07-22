import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { COMMON_TEST_PROVIDERS } from '../../testing';
import { EditarSubBloqueDialogComponent } from './editar-sub-bloque-dialog.component';

describe('EditarSubBloqueDialogComponent', () => {
  let fixture: ComponentFixture<EditarSubBloqueDialogComponent>;
  let component: EditarSubBloqueDialogComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [EditarSubBloqueDialogComponent],
      imports: [ReactiveFormsModule],
      providers: [...COMMON_TEST_PROVIDERS],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
    fixture = TestBed.createComponent(EditarSubBloqueDialogComponent);
    component = fixture.componentInstance;
  });

  it('expone el texto explicativo del bridge físico', () => {
    expect(component.textoExplicativoFisica).toContain(
      'El alumno verá este bloque',
    );
    expect(component.textoExplicativoFisica).toContain('planificación física');
  });

  it('el checkbox de entrenamiento físico empieza desmarcado', () => {
    expect(component.formGroup.get('esEntrenamientoFisico')?.value).toBe(false);
  });
});
