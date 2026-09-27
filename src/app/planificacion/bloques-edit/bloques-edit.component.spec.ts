import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { COMMON_TEST_PROVIDERS } from '../../testing';
import { of, throwError } from 'rxjs';
import { PlanificacionesService } from '../../services/planificaciones.service';

import { BloquesEditComponent } from './bloques-edit.component';

describe('BloquesEditComponent', () => {
  let component: BloquesEditComponent;
  let fixture: ComponentFixture<BloquesEditComponent>;
  const service = {
    componerContenidoCatalogo: jest.fn(),
    updateBloque$: jest.fn(),
    listarCatalogoContenido: jest.fn(),
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

  it('añade varios usos vinculados con duración y tipo comunes sin persistir', async () => {
    service.componerContenidoCatalogo.mockImplementation((codigo: string) =>
      of({
        codigo,
        nombre: codigo,
        color: '#fff',
        comentarios: '**Markdown**',
      }),
    );
    component.catalogoDisponible = [
      {
        id: 1,
        codigo: 'T01',
        nombreCorto: 'Uno',
        color: '#fff',
        version: 1,
        activa: true,
      },
      {
        id: 2,
        codigo: 'T02',
        nombreCorto: 'Dos',
        color: '#fff',
        version: 1,
        activa: true,
      },
    ];
    component.seleccionCatalogo = [1, 2];
    component.duracionComun = 75;
    component.tipoTrabajoComun = 'R1';
    await component.anadirSeleccionCatalogo();
    expect(service.componerContenidoCatalogo).toHaveBeenCalledTimes(2);
    expect(component.subBloques.length).toBe(2);
    expect(
      component.subBloques.value.map((item: any) => [
        item.catalogoContenidoId,
        item.duracion,
        item.tipoTrabajoPlanificacion,
      ]),
    ).toEqual([
      [1, 75, 'R1'],
      [2, 75, 'R1'],
    ]);
    expect(service.updateBloque$).not.toHaveBeenCalled();
    component.editarSubBloque(0);
    component.savedSubbloqueDialog({ duracion: 90 } as any);
    expect(component.subBloques.at(0).value.duracion).toBe(90);
    expect(component.subBloques.at(1).value.duracion).toBe(75);
  });

  it('un error al componer no deja altas parciales', async () => {
    service.componerContenidoCatalogo.mockImplementation((codigo: string) =>
      codigo === 'T02'
        ? throwError(() => new Error('desactivado'))
        : of({ codigo, nombre: codigo, color: '#fff', comentarios: '' }),
    );
    component.catalogoDisponible = [
      {
        id: 1,
        codigo: 'T01',
        nombreCorto: 'Uno',
        color: '#fff',
        version: 1,
        activa: true,
      },
      {
        id: 2,
        codigo: 'T02',
        nombreCorto: 'Dos',
        color: '#fff',
        version: 1,
        activa: true,
      },
    ];
    component.seleccionCatalogo = [1, 2];
    await component.anadirSeleccionCatalogo();
    expect(component.subBloques.length).toBe(0);
  });

  it('no acepta duraciones decimales para la selección común', async () => {
    component.duracionComun = 60.5;
    component.seleccionCatalogo = [1];
    expect(component.duracionComunValida).toBe(false);
    await component.anadirSeleccionCatalogo();
    expect(service.componerContenidoCatalogo).not.toHaveBeenCalled();
    expect(component.subBloques.length).toBe(0);
  });
});
