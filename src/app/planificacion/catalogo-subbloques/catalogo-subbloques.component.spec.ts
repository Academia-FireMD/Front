import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { COMMON_TEST_PROVIDERS } from '../../testing';
import { PlanificacionesService } from '../../services/planificaciones.service';
import { CatalogoSubbloquesComponent } from './catalogo-subbloques.component';

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
      .compileComponents();
  });

  it('lista el mismo catálogo que usa la composición y permite buscar', async () => {
    const fixture = TestBed.createComponent(CatalogoSubbloquesComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const component = fixture.componentInstance;
    expect(component.catalogo().filas[0].codigo).toBe('L01');
    component.pagination.set({ take: 10, skip: 0, searchTerm: 'inexistente' });
    const resultado = await import('rxjs').then(({ firstValueFrom }) =>
      firstValueFrom(component.fetchItems$()),
    );
    expect(resultado?.data).toHaveLength(0);
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
});
