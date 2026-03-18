import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { UserService } from '../../../services/user.service';
import { COMMON_TEST_PROVIDERS } from '../../../testing';
import { FacturacionService } from '../../servicios/facturacion.service';
import { FacturacionAdminComponent } from './facturacion-admin.component';

const mockFacturacionService = {
  listar$: jest.fn(() =>
    of({
      data: [],
      pagination: { skip: 0, take: 20, searchTerm: '', count: 0 },
    })
  ),
  crearManual$: jest.fn(() => of({ id: 1 })),
  crearRectificativa$: jest.fn(() => of({ id: 2, tipo: 'RECTIFICATIVA' })),
  descargarPdf$: jest.fn(() => of(new Blob(['%PDF']))),
};

const mockUserService = {
  getAllUsers$: jest.fn(() =>
    of({
      data: [
        {
          id: 10,
          nombre: 'Juan',
          apellidos: 'García',
          email: 'juan@test.com',
          dni: '12345678A',
          direccionCalle: 'Calle Test 1',
          poblacion: 'Valencia',
          codigoPostal: '46000',
          paisRegion: 'ES',
        },
      ],
      pagination: { skip: 0, take: 1, count: 1 },
    })
  ),
};

describe('FacturacionAdminComponent', () => {
  let component: FacturacionAdminComponent;
  let fixture: ComponentFixture<FacturacionAdminComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FacturacionAdminComponent],
      providers: [
        ...COMMON_TEST_PROVIDERS,
        { provide: FacturacionService, useValue: mockFacturacionService },
        { provide: UserService, useValue: mockUserService },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(FacturacionAdminComponent);
    component = fixture.componentInstance;
  });

  it('debería crearse correctamente', () => {
    expect(component).toBeTruthy();
  });

  it('getEstadoChipClass devuelve la clase correcta por estado', () => {
    expect(component.getEstadoChipClass('EMITIDA')).toBe('estado-emitida-chip');
    expect(component.getEstadoChipClass('PENDIENTE')).toBe('estado-pendiente-chip');
    expect(component.getEstadoChipClass('ANULADA')).toBe('estado-anulada-chip');
    expect(component.getEstadoChipClass('ERROR')).toBe('estado-error-chip');
  });

  it('calcularTotal calcula correctamente base + IVA', () => {
    expect(component.calcularTotal(100, 21)).toBeCloseTo(121);
    expect(component.calcularTotal(100, 0)).toBeCloseTo(100);
    expect(component.calcularTotal(200, 10)).toBeCloseTo(220);
  });

  it('onFiltersChanged llama a updatePaginationSafe con where y skip 0', () => {
    const updateSpy = jest.spyOn(component as any, 'updatePaginationSafe');
    component.onFiltersChanged({ tipo: 'NORMAL', estado: 'EMITIDA' });

    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        where: { tipo: 'NORMAL', estado: 'EMITIDA' },
      })
    );
  });

  it('onFiltersChanged maneja where undefined', () => {
    const updateSpy = jest.spyOn(component as any, 'updatePaginationSafe');
    component.onFiltersChanged(undefined);

    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ where: {}, skip: 0 })
    );
  });

  it('abrirDialogManual resetea formulario, IDs y pone paso seleccionar', () => {
    component.formManual.clienteNombre = 'Previo';
    component.selectedUserIds = [1, 2];
    component.abrirDialogManual();

    expect(component.formManual.clienteNombre).toBe('');
    expect(component.formManual.tipoIva).toBe(21);
    expect(component.formManual.clientePais).toBe('ES');
    expect(component.mostrarDialogManual()).toBe(true);
    expect(component.selectedUserIds).toEqual([]);
    expect(component.pasoDialogManual()).toBe('seleccionar');
  });

  it('onUserSelectionChange actualiza selectedUserIds', () => {
    component.onUserSelectionChange([5]);
    expect(component.selectedUserIds).toEqual([5]);
  });

  it('saltarSeleccionUsuario limpia IDs y pasa al paso datos', () => {
    component.selectedUserIds = [3];
    component.saltarSeleccionUsuario();

    expect(component.selectedUserIds).toEqual([]);
    expect(component.pasoDialogManual()).toBe('datos');
  });

  it('confirmarSeleccionUsuario requiere exactamente 1 usuario', async () => {
    const warnSpy = jest.spyOn(component.toast, 'warning');
    component.selectedUserIds = [];
    await component.confirmarSeleccionUsuario();
    expect(warnSpy).toHaveBeenCalledWith('Selecciona un único usuario');
  });

  it('confirmarSeleccionUsuario carga usuario y rellena formulario', async () => {
    component.selectedUserIds = [10];
    await component.confirmarSeleccionUsuario();

    expect(mockUserService.getAllUsers$).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 1, searchTerm: '', where: { id: 10 } })
    );
    expect(component.formManual.clienteNombre).toBe('Juan García');
    expect(component.formManual.clienteEmail).toBe('juan@test.com');
    expect(component.formManual.clienteNif).toBe('12345678A');
    expect(component.formManual.usuarioId).toBe(10);
    expect(component.pasoDialogManual()).toBe('datos');
  });

  it('rellenarDatosDesdeUsuario auto-rellena el formulario', () => {
    const usuario = {
      id: 10,
      nombre: 'Juan',
      apellidos: 'García',
      email: 'juan@test.com',
      dni: '12345678A',
      direccionCalle: 'Calle Test 1',
      poblacion: 'Valencia',
      codigoPostal: '46000',
      paisRegion: 'ES',
    } as any;

    component.rellenarDatosDesdeUsuario(usuario);

    expect(component.formManual.clienteNombre).toBe('Juan García');
    expect(component.formManual.clienteEmail).toBe('juan@test.com');
    expect(component.formManual.clienteNif).toBe('12345678A');
    expect(component.formManual.clienteDireccion).toBe('Calle Test 1');
    expect(component.formManual.clientePoblacion).toBe('Valencia');
    expect(component.formManual.clienteCodigoPostal).toBe('46000');
    expect(component.formManual.clientePais).toBe('ES');
    expect(component.formManual.usuarioId).toBe(10);
  });

  it('abrirDialogRectificativa guarda la factura seleccionada y abre el dialog', () => {
    const factura = { id: 5, numero: 'TEST-001', tipo: 'NORMAL', estado: 'EMITIDA' } as any;
    component.abrirDialogRectificativa(factura);

    expect(component.facturaSeleccionada()).toEqual(factura);
    expect(component.motivoRectificativa).toBe('');
    expect(component.mostrarDialogRectificativa()).toBe(true);
  });

  it('filters tiene tipo, estado y dateRange', () => {
    expect(component.filters.length).toBe(3);
    expect(component.filters.map((f) => f.key)).toContain('tipo');
    expect(component.filters.map((f) => f.key)).toContain('estado');
    expect(component.filters.map((f) => f.key)).toContain('dateRange');
  });

  it('pagination por defecto es skip=0 take=10', () => {
    const p = component.pagination();
    expect(p.skip).toBe(0);
    expect(p.take).toBe(10);
  });
});
