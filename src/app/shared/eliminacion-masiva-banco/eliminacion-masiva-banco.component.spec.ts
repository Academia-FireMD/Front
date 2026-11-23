import { TestBed } from '@angular/core/testing';
import { ToastrService } from 'ngx-toastr';
import { of, throwError } from 'rxjs';
import { EliminacionMasivaBancoComponent } from './eliminacion-masiva-banco.component';

describe('EliminacionMasivaBancoComponent', () => {
  const toast = { success: jest.fn(), warning: jest.fn(), error: jest.fn() };
  let componente: EliminacionMasivaBancoComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [EliminacionMasivaBancoComponent],
      providers: [{ provide: ToastrService, useValue: toast }],
    });
    componente = TestBed.createComponent(
      EliminacionMasivaBancoComponent,
    ).componentInstance;
    componente.habilitado = true;
    componente.banco = 'preguntas';
    componente.filtro = { skip: 0, take: 10, searchTerm: '' };
    componente.resultado = {
      data: [{ id: 1 }],
      pagination: { ...componente.filtro, count: 15 },
    };
  });

  it('conserva las marcas al paginar y descarta eventos de una página que ya no está vigente', () => {
    expect(componente.activo).toBe(false);
    componente.alternarModo();
    componente.cambiarSeleccion([1]);
    componente.filtro = { ...componente.filtro, skip: 10 };
    componente.cambiarSeleccion([1, 2]);
    expect(componente.ids).toEqual([1]);

    componente.resultado = {
      data: [{ id: 12 }],
      pagination: { ...componente.filtro, count: 15 },
    };
    componente.cambiarSeleccion([1, 12]);
    expect(componente.ids).toEqual([1, 12]);
    componente.alternarModo();
    expect(componente.ids).toEqual([]);
    expect(componente.activo).toBe(false);
  });

  it('envía los IDs revisados y recarga el listado si la selección se quedó obsoleta', async () => {
    const revisar = jest.fn(() =>
      of({ tamanoPagina: 25, temas: [], entradas: [] }),
    );
    const borrar = jest.fn(() => throwError(() => ({ status: 409 })));
    const actualizar = jest.fn();
    componente.revisar = revisar;
    componente.borrar = borrar;
    componente.actualizarListado.subscribe(actualizar);
    componente.alternarModo();
    componente.cambiarSeleccion([1]);
    await componente.abrirRevision();
    expect(componente.mostrandoRevision).toBe(true);

    await componente.confirmarEliminacion();
    expect(revisar).toHaveBeenCalledWith([1]);
    expect(borrar).toHaveBeenCalledWith([1]);
    expect(actualizar).toHaveBeenCalledTimes(1);
    expect(componente.mostrandoRevision).toBe(false);
    expect(componente.ids).toEqual([]);
  });
});
