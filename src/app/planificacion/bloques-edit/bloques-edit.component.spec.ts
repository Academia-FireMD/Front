import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { COMMON_TEST_PROVIDERS } from '../../testing';
import { PlanificacionesService } from '../../services/planificaciones.service';

import { BloquesEditComponent } from './bloques-edit.component';

describe('BloquesEditComponent', () => {
  let component: BloquesEditComponent;
  let fixture: ComponentFixture<BloquesEditComponent>;
  const service = {
    updateBloque$: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    await TestBed.configureTestingModule({
      declarations: [BloquesEditComponent],
      providers: [
        ...COMMON_TEST_PROVIDERS,
        { provide: PlanificacionesService, useValue: service },
      ],
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

  it('cancelar la creación manual no añade una fila vacía', () => {
    component.crearSubBloqueManual();
    expect(component.isDialogVisible).toBe(true);
    component.isDialogVisible = false;
    expect(component.subBloques.length).toBe(0);
  });

  it('añade copias independientes sin persistir hasta guardar el Bloque', () => {
    component.onSubbloquesSeleccionados([
      {
        catalogoContenidoId: 1,
        nombre: 'Uno',
        duracion: 75,
        comentarios: '**Markdown**',
        tipoTrabajoPlanificacion: 'R1',
      },
      { catalogoContenidoId: 2, nombre: 'Dos', duracion: 60 },
    ] as any);
    expect(component.subBloques.length).toBe(2);
    expect(
      component.subBloques.value.map((item: any) => [
        item.id,
        item.catalogoContenidoId,
        item.duracion,
      ]),
    ).toEqual([
      [null, 1, 75],
      [null, 2, 60],
    ]);
    expect(service.updateBloque$).not.toHaveBeenCalled();
    component.editarSubBloque(0);
    component.savedSubbloqueDialog({ duracion: 90 } as any);
    expect(component.subBloques.at(0).value.duracion).toBe(90);
    expect(component.subBloques.at(1).value.duracion).toBe(60);
  });

  it('permite repetir un código como otro uso con identidad propia', () => {
    const copia = {
      catalogoContenidoId: 1,
      nombre: 'Tema',
      duracion: 60,
    } as any;
    component.onSubbloquesSeleccionados([copia]);
    component.onSubbloquesSeleccionados([copia]);
    expect(component.subBloques.length).toBe(2);
    expect(component.subBloques.at(0).value.controlId).not.toBe(
      component.subBloques.at(1).value.controlId,
    );
  });
});
