import { NO_ERRORS_SCHEMA } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConfirmationService, PrimeNGConfig } from 'primeng/api';
import { Subject, of, throwError } from 'rxjs';
import { UserService } from '../../../services/user.service';
import { COMMON_TEST_PROVIDERS } from '../../../testing';
import { SincronizacionFiscalPreview } from '../../models/factura.model';
import { FacturacionService } from '../../servicios/facturacion.service';
import { FacturacionAdminComponent } from './facturacion-admin.component';

if (!(globalThis as any).ResizeObserver) {
  (globalThis as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

const previewMock: SincronizacionFiscalPreview = {
  version: 'fingerprint-v1',
  usuarioIds: [10, 11],
  facturaIds: [21, 22],
  automatismos: {
    sincronizacionHabilitada: true,
    recuperacionHabilitada: true,
  },
  clientes: [
    {
      usuarioId: 10,
      wooCustomerId: 900,
      estado: 'SINCRONIZABLE',
      faltantes: ['nif', 'provincia'],
      conflictos: [],
      cambios: [
        {
          campo: 'nif',
          origen: 'WOOCOMMERCE',
          destino: 'CONTASIMPLE',
          valorActual: null,
          valorPropuesto: '12345678Z',
        },
      ],
    },
    {
      usuarioId: 11,
      wooCustomerId: 901,
      estado: 'REVISION',
      faltantes: [],
      conflictos: ['direccion'],
      cambios: [],
    },
  ],
  facturas: [
    {
      id: 21,
      woocommerceOrderId: '5501',
      total: 121,
      estado: 'ELEGIBLE',
      motivos: [],
    },
    {
      id: 22,
      woocommerceOrderId: '5502',
      total: 60.5,
      estado: 'REVISION',
      motivos: ['Datos fiscales incompletos'],
    },
  ],
  totales: {
    clientes: 2,
    facturasElegibles: 1,
    importeElegible: 121,
    revisionManual: 1,
  },
};

const respuestaEncolada = {
  trabajosEncolados: 2,
  ids: ['job-1', 'job-2'],
  procesamientoPausado: false,
};

const mockFacturacionService = {
  listar$: jest.fn(() =>
    of({
      data: [],
      pagination: { skip: 0, take: 20, searchTerm: '', count: 0 },
    }),
  ),
  crearManual$: jest.fn(() => of({ id: 1 })),
  completarFiscal$: jest.fn(() => of({ id: 1 })),
  crearRectificativa$: jest.fn(() => of({ id: 2, tipo: 'RECTIFICATIVA' })),
  crearDevolucion$: jest.fn(() =>
    of({
      id: 10,
      estado: 'COMPLETED',
      importeTotal: 20.98,
      baseImponible: 17.34,
      cuotaIva: 3.64,
      tipoIva: 21,
      wooRefundId: '900',
      rectificativaId: 2,
      rectificativaNumero: 'R-2026-0001',
      contasimpleId: 'CS-R-1',
      ultimoError: null,
    }),
  ),
  descargarPdf$: jest.fn(() => of(new Blob(['%PDF']))),
  previsualizarSincronizacionFiscal$: jest.fn(() => of(previewMock)),
  aplicarSincronizacionFiscal$: jest.fn(() => of(respuestaEncolada)),
  reprocesarFacturaFiscal$: jest.fn(() =>
    of({
      trabajosEncolados: 1,
      ids: ['job-1'],
      procesamientoPausado: false,
    }),
  ),
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
    }),
  ),
};

describe('FacturacionAdminComponent', () => {
  let component: FacturacionAdminComponent;
  let fixture: ComponentFixture<FacturacionAdminComponent>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    fixture?.destroy();
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FacturacionAdminComponent, NoopAnimationsModule],
      providers: [
        ...COMMON_TEST_PROVIDERS,
        {
          provide: ConfirmationService,
          useValue: {
            confirm: jest.fn(),
            close: jest.fn(),
            requireConfirmation$: of(null),
          },
        },
        {
          provide: PrimeNGConfig,
          useValue: {
            ripple: false,
            setTranslation: jest.fn(),
            getTranslation: jest.fn(() => ''),
            inputStyle: () => 'outlined',
            translationObserver: of(null),
            translation: {},
            csp: () => ({ nonce: undefined }),
          },
        },
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
    expect(component.getEstadoChipClass('PENDIENTE')).toBe(
      'estado-pendiente-chip',
    );
    expect(component.getEstadoChipClass('ANULADA')).toBe('estado-anulada-chip');
    expect(component.getEstadoChipClass('OMITIDA_PRUEBA')).toBe(
      'estado-omitida-prueba-chip',
    );
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
      }),
    );
  });

  it('onFiltersChanged maneja where undefined', () => {
    const updateSpy = jest.spyOn(component as any, 'updatePaginationSafe');
    component.onFiltersChanged(undefined);

    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ where: {}, skip: 0 }),
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
      expect.objectContaining({
        skip: 0,
        take: 1,
        searchTerm: '',
        where: { id: 10 },
      }),
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
    const factura = {
      id: 5,
      numero: 'TEST-001',
      tipo: 'NORMAL',
      estado: 'EMITIDA',
    } as any;
    component.abrirDialogRectificativa(factura);

    expect(component.facturaSeleccionada()).toEqual(factura);
    expect(component.motivoRectificativa).toBe('');
    expect(component.tipoDevolucion).toBe('PARCIAL');
    expect(component.importeDevolucion).toBeNull();
    expect(component.idempotencyKeyDevolucion).toBeTruthy();
    expect(component.mostrarDialogRectificativa()).toBe(true);
  });

  it('seleccionar devolución total rellena el total absoluto de la factura', () => {
    component.abrirDialogRectificativa({
      id: 5,
      tipo: 'NORMAL',
      estado: 'EMITIDA',
      total: -79.9,
      tipoIva: 21,
    } as any);

    component.seleccionarTipoDevolucion('TOTAL');

    expect(component.tipoDevolucion).toBe('TOTAL');
    expect(component.importeDevolucion).toBe(79.9);
  });

  it('previsualiza base e IVA en céntimos para una devolución parcial', () => {
    component.abrirDialogRectificativa({
      id: 5,
      tipo: 'NORMAL',
      estado: 'EMITIDA',
      total: 79.9,
      tipoIva: 21,
    } as any);
    component.importeDevolucion = 20.98;

    expect(component.desgloseDevolucion).toEqual({ base: 17.34, iva: 3.64 });
  });

  it('envía importe, motivo y la misma clave idempotente al confirmar', async () => {
    component.abrirDialogRectificativa({
      id: 5,
      tipo: 'NORMAL',
      estado: 'EMITIDA',
      total: 79.9,
      tipoIva: 21,
    } as any);
    component.importeDevolucion = 20.98;
    component.motivoRectificativa = 'IVA duplicado';
    const key = component.idempotencyKeyDevolucion;

    await component.guardarRectificativa();

    expect(mockFacturacionService.crearDevolucion$).toHaveBeenCalledWith(5, {
      importeTotal: 20.98,
      motivo: 'IVA duplicado',
      idempotencyKey: key,
    });
    expect(component.mostrarDialogRectificativa()).toBe(false);
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

  it('guardarFacturaManual acepta baseImponible 0', async () => {
    component.formManual = {
      clienteNombre: 'Cliente Test',
      clienteNif: '12345678Z',
      clienteDireccion: 'Calle Test 1',
      clientePoblacion: 'Valencia',
      clienteProvincia: 'Valencia',
      clienteCodigoPostal: '46000',
      clientePais: 'ES',
      concepto: 'Servicio gratuito',
      baseImponible: 0,
      tipoIva: 21,
    } as any;
    component.pasoDialogManual.set('datos');
    mockFacturacionService.crearManual$.mockReturnValueOnce(
      of({ id: 1, numero: 'TEST-001' }),
    );
    const warnSpy = jest.spyOn(component.toast, 'warning');

    await component.guardarFacturaManual();

    expect(warnSpy).not.toHaveBeenCalled();
    expect(mockFacturacionService.crearManual$).toHaveBeenCalled();
  });

  it('crear factura manual valida toda la ficha fiscal antes de llamar al servicio', async () => {
    component.formManual = {
      clienteNombre: 'Cliente Test',
      clienteNif: '12345678Z',
      clienteDireccion: '',
      clientePoblacion: 'Valencia',
      clienteProvincia: 'Valencia',
      clienteCodigoPostal: '46000',
      clientePais: 'ES',
      concepto: 'Servicio',
      baseImponible: 20,
    };
    const warnSpy = jest.spyOn(component.toast, 'warning');

    await component.guardarFacturaManual();

    expect(warnSpy).toHaveBeenCalledWith(
      'La dirección del cliente es obligatoria',
    );
    expect(mockFacturacionService.crearManual$).not.toHaveBeenCalled();
  });

  it.each([
    ['clienteNombre', '', 'El titular o razón social es obligatorio'],
    ['clienteDireccion', '', 'La dirección del cliente es obligatoria'],
    ['clientePoblacion', '', 'La población del cliente es obligatoria'],
    ['clienteCodigoPostal', '', 'El código postal del cliente es obligatorio'],
    ['clientePais', '', 'El país del cliente es obligatorio'],
    ['clienteProvincia', '', 'La provincia es obligatoria'],
  ])(
    'completar factura rechaza una ficha resultante sin %s',
    async (campo, valor, aviso) => {
      const historico = {
        id: 41,
        clienteNif: '12345678Z',
        clienteNombre: 'Ana García',
        clienteDireccion: 'Calle Uno 1',
        clientePoblacion: 'Valencia',
        clienteProvincia: 'Valencia',
        clienteCodigoPostal: '46001',
        clientePais: 'ES',
      } as any;
      component.facturaParaCompletar.set(historico);
      component.formCompletarFiscal = {
        clienteNif: '12345678Z',
        clienteNombre: 'Ana García',
        clienteDireccion: 'Calle Uno 1',
        clientePoblacion: 'Valencia',
        clienteProvincia: 'Valencia',
        clienteCodigoPostal: '46001',
        clientePais: 'ES',
        [campo]: valor,
      };
      if (campo === 'clienteNombre') historico.clienteNombre = '';
      else historico[campo] = '';
      const warnSpy = jest.spyOn(component.toast, 'warning');

      await component.guardarCompletarFiscal();

      expect(warnSpy).toHaveBeenCalledWith(aviso);
      expect(mockFacturacionService.completarFiscal$).not.toHaveBeenCalled();
    },
  );

  it('formatea varios motivos de revisión fiscal con sus campos', () => {
    expect(
      component.motivosRevisionFiscalTexto({
        motivosRevisionFiscal: [
          { codigo: 'IDENTIDAD', campos: ['clienteNif'] },
          { codigo: 'DIRECCION', campos: ['clienteDireccion', 'clientePais'] },
        ],
      } as any),
    ).toBe('IDENTIDAD: clienteNif · DIRECCION: clienteDireccion, clientePais');
  });

  it('guardarFacturaManual muestra warning si falta nombre', async () => {
    component.formManual = {
      clienteNombre: '   ',
      concepto: 'Test',
      baseImponible: 100,
      tipoIva: 21,
    } as any;
    const warnSpy = jest.spyOn(component.toast, 'warning');

    await component.guardarFacturaManual();

    expect(warnSpy).toHaveBeenCalledWith(
      'Nombre del cliente, concepto e importe son obligatorios',
    );
    expect(mockFacturacionService.crearManual$).not.toHaveBeenCalled();
  });

  // ─────────────────────────────────────────────────────────────
  // Sincronización fiscal: preview y aplicación
  // ─────────────────────────────────────────────────────────────
  describe('sincronización fiscal', () => {
    async function cargarPreview(
      preview: SincronizacionFiscalPreview = previewMock,
    ) {
      mockFacturacionService.previsualizarSincronizacionFiscal$.mockReturnValueOnce(
        of(preview),
      );
      await component.cargarPreviewSincronizacionFiscal();
    }

    function evento(): Event {
      return { stopPropagation: jest.fn() } as unknown as Event;
    }

    it('no solicita preview ni aplica nada al construir el panel', () => {
      expect(
        mockFacturacionService.previsualizarSincronizacionFiscal$,
      ).not.toHaveBeenCalled();
      expect(
        mockFacturacionService.aplicarSincronizacionFiscal$,
      ).not.toHaveBeenCalled();
      expect(component.mostrarDialogSincronizacionFiscal()).toBe(false);
    });

    it('abrir la revisión solo carga la comparación y nunca aplica', async () => {
      mockFacturacionService.previsualizarSincronizacionFiscal$.mockReturnValueOnce(
        of(previewMock),
      );

      component.abrirDialogSincronizacionFiscal();
      await Promise.resolve();

      expect(
        mockFacturacionService.previsualizarSincronizacionFiscal$,
      ).toHaveBeenCalledTimes(1);
      expect(
        mockFacturacionService.previsualizarSincronizacionFiscal$,
      ).toHaveBeenCalledWith();
      expect(
        mockFacturacionService.aplicarSincronizacionFiscal$,
      ).not.toHaveBeenCalled();
      expect(component.previewSincronizacion()).toEqual(previewMock);
      expect(component.mostrarDialogSincronizacionFiscal()).toBe(true);
      expect(component.cargandoPreviewSincronizacion()).toBe(false);
    });

    it('aplicar fichas manda el fingerprint y el scope resuelto por el servidor', async () => {
      await cargarPreview();
      const refreshSpy = jest
        .spyOn(component as any, 'refresh')
        .mockImplementation(() => undefined);

      await component.aplicarSincronizacionFiscal(false);

      expect(
        mockFacturacionService.aplicarSincronizacionFiscal$,
      ).toHaveBeenCalledWith({
        version: 'fingerprint-v1',
        usuarioIds: [10, 11],
        facturaIds: [21, 22],
        recuperarFacturas: false,
      });
      expect(component.previewAplicada()).toBe(true);
      expect(component.puedeSincronizarFichas()).toBe(false);
      expect(component.puedeRecuperarFacturas()).toBe(false);
      expect(refreshSpy).toHaveBeenCalled();
    });

    it('aplicar y recuperar envía recuperarFacturas=true y avisa de encolado', async () => {
      await cargarPreview();
      jest
        .spyOn(component as any, 'refresh')
        .mockImplementation(() => undefined);
      const infoSpy = jest.spyOn(component.toast, 'info');

      await component.aplicarSincronizacionFiscal(true);

      expect(
        mockFacturacionService.aplicarSincronizacionFiscal$,
      ).toHaveBeenCalledWith({
        version: 'fingerprint-v1',
        usuarioIds: [10, 11],
        facturaIds: [21, 22],
        recuperarFacturas: true,
      });
      const mensaje = infoSpy.mock.calls.at(-1)?.[0] as string;
      expect(mensaje).toContain('encol');
      expect(mensaje).not.toMatch(/emitid/i);
      expect(component.resultadoSincronizacion()?.tono).toBe('info');
    });

    it('respuesta pausada informa de automatismos pausados sin fingir emisión', async () => {
      await cargarPreview();
      jest
        .spyOn(component as any, 'refresh')
        .mockImplementation(() => undefined);
      mockFacturacionService.aplicarSincronizacionFiscal$.mockReturnValueOnce(
        of({
          trabajosEncolados: 2,
          ids: ['job-1', 'job-2'],
          procesamientoPausado: true,
        }),
      );
      const warningSpy = jest.spyOn(component.toast, 'warning');

      await component.aplicarSincronizacionFiscal(true);

      const mensaje = warningSpy.mock.calls.at(-1)?.[0] as string;
      expect(mensaje).toContain('pausados');
      expect(mensaje).toContain('pendiente');
      expect(mensaje).not.toMatch(/emitid/i);
      expect(component.resultadoSincronizacion()?.tono).toBe('warning');
    });

    it('respuesta sin trabajos encolados no muestra falso éxito', async () => {
      await cargarPreview();
      jest
        .spyOn(component as any, 'refresh')
        .mockImplementation(() => undefined);
      mockFacturacionService.aplicarSincronizacionFiscal$.mockReturnValueOnce(
        of({ trabajosEncolados: 0, ids: [], procesamientoPausado: false }),
      );
      const infoSpy = jest.spyOn(component.toast, 'info');

      await component.aplicarSincronizacionFiscal(false);

      expect(infoSpy).toHaveBeenCalledWith(
        'No se encoló ningún trabajo de sincronización fiscal.',
      );
    });

    it('un 409 marca la preview como obsoleta y no reintenta solo', async () => {
      await cargarPreview();
      mockFacturacionService.aplicarSincronizacionFiscal$.mockReturnValueOnce(
        throwError(
          () => new HttpErrorResponse({ status: 409, statusText: 'Conflict' }),
        ),
      );
      const warningSpy = jest.spyOn(component.toast, 'warning');

      await component.aplicarSincronizacionFiscal(false);

      expect(component.previewObsoleta()).toBe(true);
      expect(component.previewAplicada()).toBe(false);
      expect(component.puedeSincronizarFichas()).toBe(false);
      expect(warningSpy).toHaveBeenCalledWith(
        expect.stringContaining('La comparación ha cambiado'),
      );
      expect(
        mockFacturacionService.aplicarSincronizacionFiscal$,
      ).toHaveBeenCalledTimes(1);
      expect(
        mockFacturacionService.previsualizarSincronizacionFiscal$,
      ).toHaveBeenCalledTimes(1);
    });

    it('actualizar la comparación tras un 409 es una acción explícita', async () => {
      await cargarPreview();
      mockFacturacionService.aplicarSincronizacionFiscal$.mockReturnValueOnce(
        throwError(() => new HttpErrorResponse({ status: 409 })),
      );
      await component.aplicarSincronizacionFiscal(false);

      mockFacturacionService.previsualizarSincronizacionFiscal$.mockReturnValueOnce(
        of(previewMock),
      );
      await component.cargarPreviewSincronizacionFiscal();

      expect(
        mockFacturacionService.previsualizarSincronizacionFiscal$,
      ).toHaveBeenCalledTimes(2);
      expect(component.previewObsoleta()).toBe(false);
      expect(component.puedeSincronizarFichas()).toBe(true);
    });

    it('un error genérico queda en alerta accesible y permite reintentar', async () => {
      await cargarPreview();
      const refreshSpy = jest
        .spyOn(component as any, 'refresh')
        .mockImplementation(() => undefined);
      mockFacturacionService.aplicarSincronizacionFiscal$.mockReturnValueOnce(
        throwError(() => new Error('No se pudo encolar la sincronización')),
      );

      await component.aplicarSincronizacionFiscal(false);

      expect(component.errorOperacionSincronizacion()).toBe(
        'No se pudo encolar la sincronización',
      );
      expect(component.previewAplicada()).toBe(false);
      expect(component.aplicandoSincronizacion()).toBeNull();
      expect(component.puedeSincronizarFichas()).toBe(true);
      expect(refreshSpy).not.toHaveBeenCalled();
    });

    it('un doble clic no duplica la petición y limpia el loading', async () => {
      await cargarPreview();
      jest
        .spyOn(component as any, 'refresh')
        .mockImplementation(() => undefined);
      const sujeto = new Subject<typeof respuestaEncolada>();
      mockFacturacionService.aplicarSincronizacionFiscal$.mockReturnValueOnce(
        sujeto.asObservable(),
      );

      const primera = component.aplicarSincronizacionFiscal(false);
      expect(component.aplicandoSincronizacion()).toBe('fichas');
      const segunda = component.aplicarSincronizacionFiscal(false);
      expect(
        mockFacturacionService.aplicarSincronizacionFiscal$,
      ).toHaveBeenCalledTimes(1);

      sujeto.next(respuestaEncolada);
      sujeto.complete();
      await Promise.all([primera, segunda]);

      expect(component.aplicandoSincronizacion()).toBeNull();
      expect(component.previewAplicada()).toBe(true);
    });

    it('los automatismos pausados avisan pero no bloquean el encolado', async () => {
      await cargarPreview({
        ...previewMock,
        automatismos: {
          sincronizacionHabilitada: false,
          recuperacionHabilitada: false,
        },
      });
      jest
        .spyOn(component as any, 'refresh')
        .mockImplementation(() => undefined);

      expect(component.sincronizacionFiscalPausada()).toBe(true);
      expect(component.recuperacionFiscalPausada()).toBe(true);
      expect(component.puedeSincronizarFichas()).toBe(true);
      expect(component.puedeRecuperarFacturas()).toBe(true);

      await component.aplicarSincronizacionFiscal(true);

      expect(
        mockFacturacionService.aplicarSincronizacionFiscal$,
      ).toHaveBeenCalled();
    });

    it('no habilita sincronizar fichas si ninguna es sincronizable', async () => {
      await cargarPreview({
        ...previewMock,
        clientes: previewMock.clientes.map((cliente) => ({
          ...cliente,
          estado: 'SIN_CAMBIOS' as const,
          cambios: [],
        })),
      });

      expect(component.puedeSincronizarFichas()).toBe(false);
      expect(component.puedeRecuperarFacturas()).toBe(true);
    });

    it('sin fichas ni facturas elegibles deshabilita ambas confirmaciones', async () => {
      await cargarPreview({
        ...previewMock,
        clientes: [],
        facturas: [],
        totales: {
          clientes: 0,
          facturasElegibles: 0,
          importeElegible: 0,
          revisionManual: 0,
        },
      });

      expect(component.puedeSincronizarFichas()).toBe(false);
      expect(component.puedeRecuperarFacturas()).toBe(false);

      await component.aplicarSincronizacionFiscal(false);
      expect(
        mockFacturacionService.aplicarSincronizacionFiscal$,
      ).not.toHaveBeenCalled();
    });

    it('un preview en curso no lanza una segunda comparación', async () => {
      const sujeto = new Subject<SincronizacionFiscalPreview>();
      mockFacturacionService.previsualizarSincronizacionFiscal$.mockReturnValueOnce(
        sujeto.asObservable(),
      );

      const primera = component.cargarPreviewSincronizacionFiscal();
      const segunda = component.cargarPreviewSincronizacionFiscal();
      expect(
        mockFacturacionService.previsualizarSincronizacionFiscal$,
      ).toHaveBeenCalledTimes(1);

      sujeto.next(previewMock);
      sujeto.complete();
      await Promise.all([primera, segunda]);

      expect(component.previewSincronizacion()).toEqual(previewMock);
      expect(component.cargandoPreviewSincronizacion()).toBe(false);
    });

    it('error al cargar la comparación muestra alerta y permite reintentar', async () => {
      mockFacturacionService.previsualizarSincronizacionFiscal$.mockReturnValueOnce(
        throwError(() => new Error('fallo temporal')),
      );

      await component.cargarPreviewSincronizacionFiscal();

      expect(component.previewSincronizacion()).toBeNull();
      expect(component.errorPreviewSincronizacion()).toBe(
        'No se pudo cargar la comparación fiscal. Vuelve a intentarlo.',
      );
      expect(component.cargandoPreviewSincronizacion()).toBe(false);

      await cargarPreview();
      expect(component.previewSincronizacion()).toEqual(previewMock);
      expect(component.errorPreviewSincronizacion()).toBeNull();
    });

    it('previsualizar no ejecuta apply ni completa fiscal', async () => {
      await cargarPreview();

      expect(
        mockFacturacionService.aplicarSincronizacionFiscal$,
      ).not.toHaveBeenCalled();
      expect(mockFacturacionService.completarFiscal$).not.toHaveBeenCalled();
    });

    it('el diálogo muestra totales, campos propuestos y ambas confirmaciones', async () => {
      await cargarPreview();
      component.mostrarDialogSincronizacionFiscal.set(true);
      fixture.detectChanges();

      const texto = fixture.nativeElement.textContent as string;
      expect(texto).toContain('fichas comparadas');
      expect(texto).toContain('facturas elegibles');
      expect(texto).toContain('importe elegible');
      expect(texto).toContain('Campos vacíos');
      expect(texto).toContain('WooCommerce');
      expect(texto).toContain('ContaSimple');
      expect(texto).toContain('Sincronizar fichas');
      expect(texto).toContain('Sincronizar y recuperar 1 factura');
      expect(texto).toContain('no se emitirán');
      expect(texto).not.toContain('Factura emitida');
    });

    it('el diálogo muestra el trabajo encolado sin presentarlo como emitido', async () => {
      await cargarPreview();
      jest
        .spyOn(component as any, 'refresh')
        .mockImplementation(() => undefined);
      component.mostrarDialogSincronizacionFiscal.set(true);

      await component.aplicarSincronizacionFiscal(true);
      fixture.detectChanges();

      const texto = fixture.nativeElement.textContent as string;
      expect(texto).toContain(
        'Se encolaron 2 trabajos de sincronización fiscal',
      );
      expect(texto).toContain('Revisar de nuevo');
      expect(texto).not.toMatch(/factura emitida/i);
    });

    it('el diálogo explica la pausa de automatismos con flags desactivados', async () => {
      await cargarPreview({
        ...previewMock,
        automatismos: {
          sincronizacionHabilitada: false,
          recuperacionHabilitada: false,
        },
      });
      component.mostrarDialogSincronizacionFiscal.set(true);
      fixture.detectChanges();

      const texto = fixture.nativeElement.textContent as string;
      expect(texto).toContain(
        'Los automatismos de sincronización fiscal están pausados',
      );
      expect(texto).toContain(
        'La recuperación automática de facturas está pausada',
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Reintento individual de trabajo fiscal
  // ─────────────────────────────────────────────────────────────
  describe('reprocesar factura fiscal', () => {
    function facturaBase(overrides: Record<string, unknown> = {}) {
      return {
        id: 33,
        numero: 'TEST-0033',
        tipo: 'NORMAL',
        estado: 'PENDIENTE',
        requiereRevisionFiscal: false,
        total: 121,
        baseImponible: 100,
        tipoIva: 21,
        cuotaIva: 21,
        dryRun: false,
        createdAt: '2026-10-01T00:00:00.000Z',
        updatedAt: '2026-10-01T00:00:00.000Z',
        ...overrides,
      } as any;
    }

    it.each([
      'EMITIDA',
      'ANULADA',
      'ELIMINADA_LOCAL',
      'OMITIDA_PRUEBA',
      'ERROR',
    ])(
      'nunca ofrece reprocesar una factura en estado %s aunque requiera revisión',
      (estado) => {
        expect(
          component.puedeReprocesar(
            facturaBase({
              estado,
              requiereRevisionFiscal: true,
              trabajoFiscal: {
                estado: 'PENDIENTE',
                intentos: 1,
                proximoIntento: null,
                ultimoError: null,
              },
            }),
          ),
        ).toBe(false);
      },
    );

    it('nunca ofrece reprocesar un estado desconocido del backend', () => {
      expect(
        component.puedeReprocesar(
          facturaBase({
            estado: 'ESTADO_NUEVO_DESCONOCIDO',
            trabajoFiscal: {
              estado: 'PENDIENTE',
              intentos: 0,
              proximoIntento: null,
              ultimoError: null,
            },
          }),
        ),
      ).toBe(false);
    });

    it('nunca ofrece reprocesar una rectificativa', () => {
      expect(
        component.puedeReprocesar(
          facturaBase({
            tipo: 'RECTIFICATIVA',
            estado: 'PENDIENTE',
            trabajoFiscal: {
              estado: 'PENDIENTE',
              intentos: 0,
              proximoIntento: null,
              ultimoError: null,
            },
          }),
        ),
      ).toBe(false);
    });

    it('no ofrece reprocesar trabajos en curso, completados o en reintento automático', () => {
      for (const estadoTrabajo of [
        'PROCESANDO',
        'REINTENTO',
        'COMPLETADO',
      ] as const) {
        expect(
          component.puedeReprocesar(
            facturaBase({
              requiereRevisionFiscal: true,
              trabajoFiscal: {
                estado: estadoTrabajo,
                intentos: 2,
                proximoIntento: '2026-10-29T12:00:00.000Z',
                ultimoError: null,
              },
            }),
          ),
        ).toBe(false);
      }
    });

    it('ofrece reprocesar un trabajo pendiente o con revisión conocida', () => {
      expect(
        component.puedeReprocesar(
          facturaBase({
            trabajoFiscal: {
              estado: 'PENDIENTE',
              intentos: 0,
              proximoIntento: null,
              ultimoError: null,
            },
          }),
        ),
      ).toBe(true);
      expect(
        component.puedeReprocesar(
          facturaBase({
            trabajoFiscal: {
              estado: 'REVISION',
              intentos: 1,
              proximoIntento: null,
              ultimoError: 'Datos incompletos',
            },
          }),
        ),
      ).toBe(true);
      expect(
        component.puedeReprocesar(
          facturaBase({ requiereRevisionFiscal: true }),
        ),
      ).toBe(true);
    });

    it('es compatible con un backend antiguo sin trabajoFiscal', () => {
      expect(component.puedeReprocesar(facturaBase())).toBe(false);
      expect(component.getEstadoTrabajoFiscalLabel(undefined)).toBe('');
      expect(component.getEstadoTrabajoFiscalChipClass(undefined)).toBe('');
      expect(component.trabajoFiscalTooltip(facturaBase())).toBe('');
      expect(
        component.mostrarChipRevisionFiscal(
          facturaBase({ requiereRevisionFiscal: true }),
        ),
      ).toBe(true);
    });

    it('reprocesar un pendiente encola y no habla de emisión', async () => {
      const factura = facturaBase({
        trabajoFiscal: {
          estado: 'PENDIENTE',
          intentos: 0,
          proximoIntento: null,
          ultimoError: null,
        },
      });
      const refreshSpy = jest
        .spyOn(component as any, 'refresh')
        .mockImplementation(() => undefined);
      const infoSpy = jest.spyOn(component.toast, 'info');
      const evt = {
        stopPropagation: jest.fn(),
      } as unknown as Event;

      await component.reprocesarFacturaFiscal(factura, evt);

      expect(evt.stopPropagation).toHaveBeenCalled();
      expect(
        mockFacturacionService.reprocesarFacturaFiscal$,
      ).toHaveBeenCalledWith(33);
      const mensaje = infoSpy.mock.calls.at(-1)?.[0] as string;
      expect(mensaje).toContain('Se encoló el reintento');
      expect(mensaje).not.toMatch(/emitid/i);
      expect(component.reprocesandoFacturaId()).toBeNull();
      expect(refreshSpy).toHaveBeenCalled();
    });

    it('reprocesar no llama al servicio si la factura no es elegible', async () => {
      const factura = facturaBase({
        estado: 'EMITIDA',
        requiereRevisionFiscal: true,
      });
      const evt = {
        stopPropagation: jest.fn(),
      } as unknown as Event;

      await component.reprocesarFacturaFiscal(factura, evt);

      expect(evt.stopPropagation).toHaveBeenCalled();
      expect(
        mockFacturacionService.reprocesarFacturaFiscal$,
      ).not.toHaveBeenCalled();
      expect(component.reprocesandoFacturaId()).toBeNull();
    });

    it('si el procesamiento está pausado avisa sin fingir emisión', async () => {
      const factura = facturaBase({
        trabajoFiscal: {
          estado: 'PENDIENTE',
          intentos: 0,
          proximoIntento: null,
          ultimoError: null,
        },
      });
      jest
        .spyOn(component as any, 'refresh')
        .mockImplementation(() => undefined);
      mockFacturacionService.reprocesarFacturaFiscal$.mockReturnValueOnce(
        of({
          trabajosEncolados: 1,
          ids: ['job-33'],
          procesamientoPausado: true,
        }),
      );
      const warningSpy = jest.spyOn(component.toast, 'warning');

      await component.reprocesarFacturaFiscal(factura, {
        stopPropagation: jest.fn(),
      } as unknown as Event);

      const mensaje = warningSpy.mock.calls.at(-1)?.[0] as string;
      expect(mensaje).toContain('pausados');
      expect(mensaje).not.toMatch(/emitid/i);
    });

    it('un 409 al reprocesar refresca y no reintenta solo', async () => {
      const factura = facturaBase({
        trabajoFiscal: {
          estado: 'PENDIENTE',
          intentos: 0,
          proximoIntento: null,
          ultimoError: null,
        },
      });
      const refreshSpy = jest
        .spyOn(component as any, 'refresh')
        .mockImplementation(() => undefined);
      mockFacturacionService.reprocesarFacturaFiscal$.mockReturnValueOnce(
        throwError(() => new HttpErrorResponse({ status: 409 })),
      );
      const warningSpy = jest.spyOn(component.toast, 'warning');

      await component.reprocesarFacturaFiscal(factura, {
        stopPropagation: jest.fn(),
      } as unknown as Event);

      expect(
        mockFacturacionService.reprocesarFacturaFiscal$,
      ).toHaveBeenCalledTimes(1);
      expect(refreshSpy).toHaveBeenCalled();
      expect(warningSpy).toHaveBeenCalledWith(
        'El estado de la factura ha cambiado. Actualiza el listado antes de reintentar.',
      );
      expect(component.reprocesandoFacturaId()).toBeNull();
    });

    it('muestra etiquetas de negocio para los estados de trabajo fiscal', () => {
      expect(component.getEstadoTrabajoFiscalLabel('PENDIENTE')).toBe(
        'Pendiente de sincronización',
      );
      expect(component.getEstadoTrabajoFiscalLabel('PROCESANDO')).toBe(
        'Sincronizando',
      );
      expect(component.getEstadoTrabajoFiscalLabel('REINTENTO')).toBe(
        'Reintentando',
      );
      expect(component.getEstadoTrabajoFiscalLabel('REVISION')).toBe(
        'Requiere revisión',
      );
      expect(component.getEstadoTrabajoFiscalLabel('COMPLETADO')).toBe(
        'Sincronización completada',
      );
    });

    it('pluraliza las facturas elegibles y recuperables', () => {
      expect(component.textoFacturasElegibles(1)).toBe('1 factura elegible');
      expect(component.textoFacturasElegibles(2)).toBe('2 facturas elegibles');
      expect(component.textoFacturasParaRecuperar(1)).toBe('1 factura');
      expect(component.textoFacturasParaRecuperar(0)).toBe('0 facturas');
    });

    it('traduce campos y orígenes a lenguaje claro', () => {
      expect(component.etiquetaCampoFiscal('nif')).toBe('NIF');
      expect(component.etiquetaCampoFiscal('clienteProvincia')).toBe(
        'Provincia',
      );
      expect(component.etiquetaCampoFiscal('campoDesconocido')).toBe(
        'Campo Desconocido',
      );
      expect(component.etiquetaOrigenFiscal('WOOCOMMERCE')).toBe('WooCommerce');
      expect(component.etiquetaOrigenFiscal('CONTASIMPLE')).toBe('ContaSimple');
      expect(
        component.valorActualCambioFiscal({
          campo: 'nif',
          origen: 'PLATAFORMA',
          destino: 'CONTASIMPLE',
          valorActual: null,
          valorPropuesto: '12345678Z',
        }),
      ).toBe('Vacío');
    });

    it('etiqueta estados de la comparación de clientes y facturas', () => {
      expect(component.getEstadoSincronizacionClienteLabel('SIN_CAMBIOS')).toBe(
        'Sin cambios',
      );
      expect(
        component.getEstadoSincronizacionClienteLabel('SINCRONIZABLE'),
      ).toBe('Se puede completar');
      expect(component.getEstadoSincronizacionClienteLabel('REVISION')).toBe(
        'Requiere revisión',
      );
      expect(component.getEstadoSincronizacionFacturaLabel('ELEGIBLE')).toBe(
        'Elegible',
      );
      expect(
        component.getEstadoSincronizacionFacturaLabel('FUERA_PERIODO'),
      ).toBe('Fuera del período automático');
      expect(component.getEstadoSincronizacionFacturaLabel('YA_EMITIDA')).toBe(
        'Ya emitida',
      );
    });
  });
});
