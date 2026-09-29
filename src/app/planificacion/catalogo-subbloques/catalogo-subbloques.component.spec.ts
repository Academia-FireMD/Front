import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { COMMON_TEST_PROVIDERS } from '../../testing';
import { PlanificacionesService } from '../../services/planificaciones.service';
import { CatalogoSubbloquesComponent } from './catalogo-subbloques.component';
import { CatalogoSubbloquesListComponent } from './catalogo-subbloques-list.component';
import { CatalogoPreview } from '../models/catalogo-contenido.model';

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
    trabajos: [
      { trabajo: 'ESTUDIO' as const, descripcion: 'Leer el tema', version: 1 },
      {
        trabajo: 'R1' as const,
        descripcion: 'Repasar con tarjetas',
        version: 1,
      },
    ],
  };
  const preview: CatalogoPreview = {
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
    componerContenidoCatalogo: jest.fn(() =>
      of({
        codigo: 'L01',
        nombre: 'Temario',
        color: '#ffffff',
        comentarios: 'Leer el tema',
      }),
    ),
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
    expect(component.indicaciones.map((item) => item.trabajo)).toEqual([
      'ESTUDIO',
      'R1',
      'R2',
      'R3',
      'R4',
      'R5',
    ]);
    expect(component.indicaciones[5].descripcion).toBe('');
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

  it('permite confirmar una edición aislada sin una casilla adicional', async () => {
    const fixture = TestBed.createComponent(CatalogoSubbloquesComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const component = fixture.componentInstance;
    component.abrirEdicion({ ...lista.filas[0], codigo: 'L01.2' });
    await component.revisarEdicion();
    expect(component.confirmado).toBe(false);
    expect(component.puedeAplicar).toBe(true);

    await component.aplicar();

    expect(servicio.guardarCambioCatalogo).toHaveBeenCalledWith(
      preview.previewHash,
      true,
      expect.objectContaining({ codigo: 'L01.2' }),
      undefined,
    );
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

  it('muestra la composición guardada al elegir una indicación en la ficha', async () => {
    const fixture = TestBed.createComponent(CatalogoSubbloquesComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const component = fixture.componentInstance;
    component.abrirEdicion(lista.filas[0]);
    component.vistaTipo = 'R1';
    await component.cargarVistaCompuesta();
    expect(servicio.componerContenidoCatalogo).toHaveBeenCalledWith(
      'L01',
      'R1',
    );
    expect(component.vistaCompuesta?.comentarios).toBe('Leer el tema');
  });

  it('revisa y guarda una indicación global sin editar la ficha del subbloque', async () => {
    const fixture = TestBed.createComponent(CatalogoSubbloquesComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const component = fixture.componentInstance;
    component.abrirIndicaciones();
    component.editarIndicacion(lista.trabajos[1]);
    component.cambiarTextoIndicacion('**Nuevo repaso**');
    servicio.previsualizarCambioCatalogo.mockReturnValueOnce(
      of({
        ...preview,
        cambios: [],
        cambiosTrabajo: [
          {
            trabajo: 'R1',
            anterior: 'Repasar con tarjetas',
            nueva: '**Nuevo repaso**',
          },
        ],
      }),
    );
    await component.revisarIndicacion();
    expect(servicio.previsualizarCambioCatalogo).toHaveBeenCalledWith(
      undefined,
      { R1: '**Nuevo repaso**' },
    );
    expect(component.puedeAplicar).toBe(true);
    await component.aplicar();
    expect(servicio.guardarCambioCatalogo).toHaveBeenCalledWith(
      preview.previewHash,
      true,
      undefined,
      { R1: '**Nuevo repaso**' },
    );
    expect(component.indicacionEditando).toBeNull();
  });

  it('no permite aplicar una indicación si cambia el texto después de previsualizar', async () => {
    const fixture = TestBed.createComponent(CatalogoSubbloquesComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const component = fixture.componentInstance;
    component.abrirIndicaciones();
    component.editarIndicacion(lista.trabajos[0]);
    component.preview = {
      ...preview,
      cambios: [],
      cambiosTrabajo: [
        { trabajo: 'ESTUDIO', anterior: 'Antes', nueva: 'Después' },
      ],
    };
    component.cambiarTextoIndicacion('Otro texto');
    expect(component.puedeAplicar).toBe(false);
    await component.aplicar();
    expect(servicio.guardarCambioCatalogo).not.toHaveBeenCalled();
  });

  it('ignora una previsualización pendiente si se edita el texto mientras llega', async () => {
    const fixture = TestBed.createComponent(CatalogoSubbloquesComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const component = fixture.componentInstance;
    const pendiente = new Subject<CatalogoPreview>();
    servicio.previsualizarCambioCatalogo.mockReturnValueOnce(pendiente);
    component.abrirIndicaciones();
    component.editarIndicacion(lista.trabajos[0]);
    const revision = component.revisarIndicacion();
    component.cambiarTextoIndicacion('Texto posterior');
    pendiente.next(preview);
    pendiente.complete();
    await revision;
    expect(component.preview).toBeNull();
  });

  it('conserva el texto de una indicación ante un conflicto 409', async () => {
    const fixture = TestBed.createComponent(CatalogoSubbloquesComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const component = fixture.componentInstance;
    component.abrirIndicaciones();
    component.editarIndicacion(lista.trabajos[1]);
    component.cambiarTextoIndicacion('Mi borrador **sin guardar**');
    component.preview = {
      ...preview,
      cambios: [],
      cambiosTrabajo: [{ trabajo: 'R1', anterior: 'Antes', nueva: 'Después' }],
    };
    servicio.guardarCambioCatalogo.mockImplementationOnce(() =>
      throwError(() => new HttpErrorResponse({ status: 409 })),
    );
    await component.aplicar();
    expect(component.preview).toBeNull();
    expect(component.indicacionEditando).toBe('R1');
    expect(component.textoIndicacion).toBe('Mi borrador **sin guardar**');
    expect(servicio.listarCatalogoContenido).toHaveBeenCalledTimes(2);
  });

  it('conserva cambios posteriores al inicio del guardado', async () => {
    const fixture = TestBed.createComponent(CatalogoSubbloquesComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const component = fixture.componentInstance;
    component.abrirIndicaciones();
    component.editarIndicacion(lista.trabajos[1]);
    component.preview = {
      ...preview,
      cambios: [],
      cambiosTrabajo: [{ trabajo: 'R1', anterior: 'Antes', nueva: 'Después' }],
    };
    const guardadoPendiente = new Subject<CatalogoPreview>();
    servicio.guardarCambioCatalogo.mockReturnValueOnce(guardadoPendiente);
    const guardado = component.aplicar();
    component.cambiarTextoIndicacion('Cambio posterior');
    guardadoPendiente.next(preview);
    guardadoPendiente.complete();
    await guardado;
    expect(component.textoIndicacion).toBe('Cambio posterior');
    expect(component.indicacionEditando).toBe('R1');
    expect(component.preview).toBeNull();
  });
});
