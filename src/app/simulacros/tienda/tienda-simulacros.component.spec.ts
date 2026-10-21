import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { AuthService } from '../../services/auth.service';
import { SimulacroCompraIntentoService } from '../../compras/simulacro-compra-intento.service';
import { COMMON_TEST_PROVIDERS } from '../../testing';
import { ExamenesService } from '../../examen/servicios/examen.service';
import {
  ComprarSimulacroCofResponse,
  SimulacroTienda,
} from '../../examen/models/examen.model';
import { TiendaSimulacrosComponent } from './tienda-simulacros.component';

const COMPRABLE: SimulacroTienda = {
  id: 50,
  titulo: 'Simulacro Valencia',
  descripcion: 'desc',
  relevancia: ['VALENCIA_AYUNTAMIENTO'] as any,
  precio: 9.9,
  woocommerceProductId: '1432',
  woocommerceSku: 'VALENCIA-SIMULACRO',
  estado: 'COMPRABLE',
};
const INCLUIDO: SimulacroTienda = { ...COMPRABLE, id: 51, estado: 'INCLUIDO' };

function buildExamenServiceMock() {
  return {
    listarSimulacrosTienda$: jest.fn(
      (): Observable<SimulacroTienda[]> =>
        of([{ ...COMPRABLE }, { ...INCLUIDO }]),
    ),
    comprarSimulacroCof$: jest.fn(
      (
        _id: number,
        _key: string,
        _importeConfirmado: number,
        opciones?: {
          omitirLecturaFiscalInicial?: boolean;
          antesDeEnviar?: () => void;
        },
      ): Observable<ComprarSimulacroCofResponse> => {
        opciones?.antesDeEnviar?.();
        return of({ success: true, consumibleId: 1, mensaje: 'ok' });
      },
    ),
  };
}

describe('TiendaSimulacrosComponent', () => {
  let component: TiendaSimulacrosComponent;
  let fixture: ComponentFixture<TiendaSimulacrosComponent>;
  let examenService: ReturnType<typeof buildExamenServiceMock>;
  let toastr: {
    success: jest.Mock;
    error: jest.Mock;
    warning: jest.Mock;
    info: jest.Mock;
  };
  let router: { navigate: jest.Mock };

  function setup(): void {
    examenService = buildExamenServiceMock();
    toastr = {
      success: jest.fn(),
      error: jest.fn(),
      warning: jest.fn(),
      info: jest.fn(),
    };
    router = { navigate: jest.fn() };

    TestBed.configureTestingModule({
      imports: [TiendaSimulacrosComponent],
      providers: [
        ...COMMON_TEST_PROVIDERS,
        { provide: ExamenesService, useValue: examenService },
        {
          provide: AuthService,
          useValue: { getCurrentUser: () => ({ id: 7 }) },
        },
        SimulacroCompraIntentoService,
        { provide: ToastrService, useValue: toastr },
        { provide: Router, useValue: router },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(TiendaSimulacrosComponent);
    component = fixture.componentInstance;
    // No usamos detectChanges() para no renderizar las plantillas PrimeNG en
    // jsdom; disparamos el ciclo de carga manualmente (tests de lógica).
    component.ngOnInit();
  }

  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
    TestBed.resetTestingModule();
    setup();
  });

  it('carga la lista al iniciar', () => {
    expect(examenService.listarSimulacrosTienda$).toHaveBeenCalledTimes(1);
    expect(component.simulacros().length).toBe(2);
    expect(component.cargando()).toBe(false);
  });

  it('error al cargar → muestra estado de error', () => {
    examenService.listarSimulacrosTienda$.mockReturnValue(
      throwError(() => new Error('500')),
    );
    component.cargar();
    expect(component.error()).toBe(true);
    expect(component.cargando()).toBe(false);
  });

  describe('abrirCompra()', () => {
    it('COMPRABLE → abre confirmación y fija una idempotencyKey', () => {
      component.abrirCompra(COMPRABLE);
      expect(component.confirmVisible()).toBe(true);
      expect(component.seleccionado()?.id).toBe(50);
      expect(component.compraIntento()?.idempotencyKey).toMatch(
        /^simulacro_v2_/,
      );
    });

    it('INCLUIDO/COMPRADO → no abre confirmación (no comprable)', () => {
      component.abrirCompra(INCLUIDO);
      expect(component.confirmVisible()).toBe(false);
    });
  });

  describe('confirmarCompra()', () => {
    beforeEach(() => component.abrirCompra(COMPRABLE));

    it('éxito → marca COMPRADO, cierra y hace toast', () => {
      examenService.comprarSimulacroCof$.mockReturnValue(
        of({ success: true, consumibleId: 9, mensaje: 'Has comprado' }),
      );
      component.confirmarCompra();
      expect(component.confirmVisible()).toBe(false);
      expect(component.simulacros().find((s) => s.id === 50)?.estado).toBe(
        'COMPRADO',
      );
      expect(toastr.success).toHaveBeenCalled();
    });

    it('cobra con el examenId y una idempotencyKey no vacía', () => {
      component.confirmarCompra();
      const [id, key, importe] =
        examenService.comprarSimulacroCof$.mock.calls[0];
      expect(id).toBe(50);
      expect(typeof key).toBe('string');
      expect((key as string).length).toBeGreaterThan(0);
      expect(importe).toBe(COMPRABLE.precio);
    });

    it('requiereCheckout → abre el diálogo de tienda (sin rechazo)', () => {
      examenService.comprarSimulacroCof$.mockReturnValue(
        of({
          success: false,
          requiereCheckout: true,
          wooProductId: '1432',
          mensaje: 'a la tienda',
        }),
      );
      component.confirmarCompra();
      expect(component.checkoutVisible()).toBe(true);
      expect(component.checkoutEsRechazo()).toBe(false);
      expect(component.checkoutWooProductId()).toBe('1432');
    });

    it('PAGO_RECHAZADO → diálogo de tienda marcado como rechazo', () => {
      examenService.comprarSimulacroCof$.mockReturnValue(
        of({
          success: false,
          error: 'PAGO_RECHAZADO',
          wooProductId: '1432',
          mensaje: 'rechazada',
        }),
      );
      component.confirmarCompra();
      expect(component.checkoutVisible()).toBe(true);
      expect(component.checkoutEsRechazo()).toBe(true);
    });

    it('ERROR_TEMPORAL → warning, NO abre tienda y un retry reusa la misma key', () => {
      examenService.comprarSimulacroCof$.mockImplementation(
        (_id, _key, _importe, opciones) => {
          opciones?.antesDeEnviar?.();
          return of({
            success: false,
            error: 'ERROR_TEMPORAL',
            mensaje: 'verificando',
          });
        },
      );
      component.confirmarCompra(); // intento
      component.confirmarCompra(); // retry del mismo intento
      expect(component.checkoutVisible()).toBe(false);
      expect(toastr.warning).toHaveBeenCalled();
      const k1 = examenService.comprarSimulacroCof$.mock.calls[0][1];
      const k2 = examenService.comprarSimulacroCof$.mock.calls[1][1];
      expect(k1).toBe(k2);
    });

    it('al cerrar y reabrir un intento ambiguo conserva la key y el importe', () => {
      examenService.comprarSimulacroCof$.mockImplementation(
        (_id, _key, _importe, opciones) => {
          opciones?.antesDeEnviar?.();
          return of({
            success: false,
            error: 'ERROR_TEMPORAL',
            mensaje: 'verificando',
          });
        },
      );
      component.confirmarCompra();
      const primerIntento = examenService.comprarSimulacroCof$.mock.calls[0];
      component.confirmVisible.set(false);
      component.abrirCompra({ ...COMPRABLE, precio: 12.5 });

      expect(component.compraIntento()?.importeConfirmado).toBe(9.9);
      component.confirmarCompra();

      const reintento = examenService.comprarSimulacroCof$.mock.calls[1];
      expect(reintento[1]).toBe(primerIntento[1]);
      expect(reintento[2]).toBe(9.9);
      expect(reintento[3]?.omitirLecturaFiscalInicial).toBe(true);
    });

    it('error HTTP no clasificado → toast de error y botón re-habilitado', () => {
      examenService.comprarSimulacroCof$.mockReturnValue(
        throwError(() => new Error('500')),
      );
      component.confirmarCompra();
      expect(component.comprando()).toBe(false);
      expect(toastr.error).toHaveBeenCalled();
    });
  });

  describe('completarEnTienda() / realizar()', () => {
    it('completarEnTienda abre la tienda WC con add-to-cart', () => {
      const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
      component.checkoutWooProductId.set('1432');
      component.checkoutVisible.set(true);
      component.completarEnTienda();
      expect(openSpy.mock.calls[0][0]).toContain('add-to-cart=1432');
      expect(component.checkoutVisible()).toBe(false);
      openSpy.mockRestore();
    });

    it('realizar navega a la landing del simulacro', () => {
      component.realizar(INCLUIDO);
      expect(router.navigate).toHaveBeenCalledWith([
        '/simulacros/realizar-simulacro',
        51,
      ]);
    });
  });
});
