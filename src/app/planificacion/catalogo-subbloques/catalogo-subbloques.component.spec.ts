import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { COMMON_TEST_PROVIDERS } from '../../testing';
import { PlanificacionesService } from '../../services/planificaciones.service';
import { CatalogoSubbloquesComponent } from './catalogo-subbloques.component';
import { CatalogoSubbloquesListComponent } from './catalogo-subbloques-list.component';

describe('CatalogoSubbloquesComponent', () => {
  const lista = {
    filas: [
      {
        id: 7,
        codigo: 'L01',
        nombreCorto: 'Temario',
        color: '#ffffff',
        version: 1,
        activa: true,
      },
    ],
    trabajos: [],
  };
  const preview = {
    previewHash: 'a'.repeat(64),
    cambios: [
      {
        codigo: 'L01',
        estado: 'actualizada' as const,
        camposCambiados: ['nombre'],
        anterior: { codigo: 'L01', nombreCorto: 'Antes', color: '#ffffff' },
        nueva: { codigo: 'L01', nombreCorto: 'Temario', color: '#ffffff' },
      },
    ],
    cambiosTrabajo: [],
    requiereConfirmacion: true,
    impacto: {
      usos: 2,
      bloques: 1,
      plantillas: 0,
      borradores: 0,
      publicadas: 1,
    },
    errores: [],
    warnings: [],
  };
  const servicio = {
    listarCatalogoContenido: jest.fn(() => of(lista)),
    previsualizarCatalogo: jest.fn(() => of(preview)),
    aplicarCatalogo: jest.fn(() => of(preview)),
    previsualizarCambioCatalogo: jest.fn(() => of(preview)),
    guardarCambioCatalogo: jest.fn(() => of(preview)),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [CatalogoSubbloquesComponent],
      providers: [
        ...COMMON_TEST_PROVIDERS,
        { provide: PlanificacionesService, useValue: servicio },
      ],
    })
      .overrideComponent(CatalogoSubbloquesComponent, {
        set: { template: '', styles: [] },
      })
      .overrideComponent(CatalogoSubbloquesListComponent, {
        set: { template: '', styles: [] },
      })
      .compileComponents();
  });

  it('lista el mismo catálogo que usa la composición', async () => {
    const fixture = TestBed.createComponent(CatalogoSubbloquesComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const component = fixture.componentInstance;
    expect(component.catalogo().filas[0].codigo).toBe('L01');
  });

  it('la rejilla permite filtros y selección sin alterar la URL del Bloque', async () => {
    const fixture = TestBed.createComponent(CatalogoSubbloquesListComponent);
    const component = fixture.componentInstance;
    component.routeSyncEnabled = false;
    component.mode = 'selection';
    component.items = [
      lista.filas[0],
      { ...lista.filas[0], id: 8, codigo: 'T01', activa: false },
    ];
    fixture.detectChanges();
    const { firstValueFrom } = await import('rxjs');
    const initial = await firstValueFrom(component.fetchItems$());
    expect(initial?.data.map((item) => item.id)).toEqual([7]);
    component.onSearch({
      target: { value: 'inexistente' },
    } as unknown as Event);
    const filtered = await firstValueFrom(component.fetchItems$());
    expect(filtered?.data).toHaveLength(0);
    component.onSearch({ target: { value: '' } } as unknown as Event);
    component.onFiltersChanged({ serie: 'L' });
    const serie = await firstValueFrom(component.fetchItems$());
    expect(serie?.data.map((item) => item.id)).toEqual([7]);
  });

  it('conserva la selección al cambiar de página y solo muestra entradas activas', async () => {
    const fixture = TestBed.createComponent(CatalogoSubbloquesListComponent);
    const component = fixture.componentInstance;
    component.mode = 'selection';
    component.routeSyncEnabled = false;
    component.items = Array.from({ length: 12 }, (_, index) => ({
      ...lista.filas[0],
      id: index + 1,
      codigo: `T${index + 1}`,
      activa: index !== 11,
    }));
    component.selectedIds = [1];
    const { firstValueFrom } = await import('rxjs');
    expect((await firstValueFrom(component.fetchItems$()))?.data).toHaveLength(
      10,
    );
    component.onPageChange({ first: 10, rows: 10, page: 1, pageCount: 2 });
    const paginaDos = await firstValueFrom(component.fetchItems$());
    expect(paginaDos?.data.map((item) => item.id)).toEqual([11]);
    expect(component.selectedIds).toEqual([1]);
  });

  it('filtra por presencia de explicación y puntos sin marcar contenidos como incompletos', async () => {
    const fixture = TestBed.createComponent(CatalogoSubbloquesListComponent);
    const component = fixture.componentInstance;
    component.routeSyncEnabled = false;
    component.items = [
      {
        ...lista.filas[0],
        nombreDescriptivo: 'Detalle',
        puntosImportantes: '',
      },
      {
        ...lista.filas[0],
        id: 8,
        codigo: 'L02',
        nombreDescriptivo: '',
        puntosImportantes: 'Clave',
      },
    ];
    const { firstValueFrom } = await import('rxjs');
    component.onFiltersChanged({ explicacion: 'con', puntos: 'sin' });
    expect(
      (await firstValueFrom(component.fetchItems$()))?.data.map(
        (item) => item.id,
      ),
    ).toEqual([7]);
    component.onFiltersChanged({ explicacion: 'sin', puntos: 'con' });
    expect(
      (await firstValueFrom(component.fetchItems$()))?.data.map(
        (item) => item.id,
      ),
    ).toEqual([8]);
  });

  it('exige confirmar la sustitución publicada antes de importar', async () => {
    const fixture = TestBed.createComponent(CatalogoSubbloquesComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const component = fixture.componentInstance;
    component.abrirImportacion();
    component.archivo = new File(['fixture'], 'catalogo.xlsx');
    await component.revisarExcel();
    expect(component.preview?.impacto?.publicadas).toBe(1);
    expect(component.puedeAplicar).toBe(false);
    component.confirmado = true;
    expect(component.puedeAplicar).toBe(true);
    await component.aplicar();
    expect(servicio.aplicarCatalogo).toHaveBeenCalledWith(
      component.archivo,
      preview.previewHash,
      true,
    );
  });

  it('envía ambos campos Markdown a la revisión, sin guardado directo', async () => {
    const fixture = TestBed.createComponent(CatalogoSubbloquesComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const component = fixture.componentInstance;
    component.abrirEdicion({ ...lista.filas[0], nombreDescriptivo: 'Antes' });
    component.fila!.nombreDescriptivo = '## Explicación\n\n- Paso';
    component.fila!.puntosImportantes = '**Atención**';
    await component.revisarEdicion();
    expect(servicio.previsualizarCambioCatalogo).toHaveBeenCalledWith(
      expect.objectContaining({
        nombreDescriptivo: '## Explicación\n\n- Paso',
        puntosImportantes: '**Atención**',
      }),
      undefined,
    );
    expect(servicio.guardarCambioCatalogo).not.toHaveBeenCalled();
  });

  it('descarta el hash obsoleto y recarga el catálogo tras un 409', async () => {
    const fixture = TestBed.createComponent(CatalogoSubbloquesComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const component = fixture.componentInstance;
    component.abrirEdicion(lista.filas[0]);
    component.preview = preview;
    component.confirmado = true;
    servicio.guardarCambioCatalogo.mockImplementationOnce(() =>
      throwError(() => new HttpErrorResponse({ status: 409 })),
    );
    await component.aplicar();
    expect(component.preview).toBeNull();
    expect(component.dialogoEdicion).toBe(true);
    expect(servicio.listarCatalogoContenido).toHaveBeenCalledTimes(2);
  });
});
