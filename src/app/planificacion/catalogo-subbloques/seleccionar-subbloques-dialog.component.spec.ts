import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { PlanificacionesService } from '../../services/planificaciones.service';
import { COMMON_TEST_PROVIDERS } from '../../testing';
import { SeleccionarSubbloquesDialogComponent } from './seleccionar-subbloques-dialog.component';

const filas = [
  { id: 1, codigo: 'T01', nombreCorto: 'Tema uno', activa: true },
  { id: 2, codigo: 'T02', nombreCorto: 'Tema dos', activa: true },
  { id: 3, codigo: 'T03', nombreCorto: 'Inactivo', activa: false },
] as any;

describe('Selector de subbloques', () => {
  let component: SeleccionarSubbloquesDialogComponent;
  const service = {
    listarCatalogoContenido: jest.fn(),
    componerContenidoCatalogo: jest.fn(),
  };
  const toast = { error: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    service.listarCatalogoContenido.mockReturnValue(
      of({ filas, trabajos: [] }),
    );
    service.componerContenidoCatalogo.mockImplementation((codigo: string) =>
      of({
        codigo,
        nombre: codigo,
        comentarios: '**Texto**',
        color: '#aabbcc',
      }),
    );
    await TestBed.configureTestingModule({
      imports: [SeleccionarSubbloquesDialogComponent],
      providers: [
        ...COMMON_TEST_PROVIDERS,
        { provide: PlanificacionesService, useValue: service },
        { provide: ToastrService, useValue: toast },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
    component = TestBed.createComponent(
      SeleccionarSubbloquesDialogComponent,
    ).componentInstance;
  });

  it('muestra solo activos, permite elegir varios y fija duración por copia', async () => {
    component.visible = true;
    await Promise.resolve();
    expect(component.filas.map((fila) => fila.id)).toEqual([1, 2]);
    component.seleccion = [1, 2];
    component.continuar();
    expect(component.paso).toBe(2);
    component.duraciones[1] = 45;
    component.duraciones[2] = 90;
    const emit = jest.spyOn(component.selected, 'emit');
    await component.anadir();
    expect(emit).toHaveBeenCalledWith([
      expect.objectContaining({
        catalogoContenidoId: 1,
        duracion: 45,
        nombre: 'T01',
      }),
      expect.objectContaining({
        catalogoContenidoId: 2,
        duracion: 90,
        nombre: 'T02',
      }),
    ]);
    expect(component.visible).toBe(false);
  });

  it('cancelar no emite copias y la duración inválida impide avanzar', async () => {
    component.visible = true;
    await Promise.resolve();
    component.seleccion = [1];
    component.continuar();
    component.duraciones[1] = 0;
    const emit = jest.spyOn(component.selected, 'emit');
    await component.anadir();
    expect(emit).not.toHaveBeenCalled();
    component.cerrar();
    expect(emit).not.toHaveBeenCalled();
  });

  it('si una ficha se desactiva antes de componer no deja altas parciales', async () => {
    component.visible = true;
    await Promise.resolve();
    component.seleccion = [1, 2];
    component.continuar();
    service.componerContenidoCatalogo.mockImplementation((codigo: string) =>
      codigo === 'T02'
        ? throwError(() => new Error('inactivo'))
        : of({ codigo, nombre: codigo }),
    );
    const emit = jest.spyOn(component.selected, 'emit');
    await component.anadir();
    expect(emit).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
    expect(component.visible).toBe(true);
  });
});
