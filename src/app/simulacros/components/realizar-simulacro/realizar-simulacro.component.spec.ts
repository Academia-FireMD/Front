import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { ConfirmationService } from 'primeng/api';
import { COMMON_TEST_PROVIDERS } from '../../../testing';
import { ExamenesService } from '../../../examen/servicios/examen.service';
import {
  ComprarSimulacroCofResponse,
  Examen,
} from '../../../examen/models/examen.model';

import { RealizarSimulacroComponent } from './realizar-simulacro.component';

/**
 * Mocks específicos para el flujo de compra in-app del simulacro (1-clic COF).
 * Sobre-escriben los proveedores del COMMON set (el último gana en Angular DI)
 * para poder inspeccionar/controlar `comprarSimulacroCof$` y los toasts.
 */
function buildExamenServiceMock() {
  return {
    // Lo llama el constructor (loadRouteData). of(null) → statusLoad='not_found'.
    getSimulacroById$: jest.fn(() => of(null)),
    verificarAccesoSimulacro$: jest.fn(
      (
        _examenId: number,
      ): Observable<{ tieneAcceso: boolean; necesitaCodigo: boolean }> =>
        of({ tieneAcceso: false, necesitaCodigo: false }),
    ),
    comprarSimulacroCof$: jest.fn(
      (
        _examenId: number,
        _idempotencyKey: string,
      ): Observable<ComprarSimulacroCofResponse> =>
        of({ success: true, consumibleId: 1, mensaje: 'ok' }),
    ),
    verificarCodigoAcceso$: jest.fn(() => of(true)),
    startSimulacro$: jest.fn(() => of({ id: 99 })),
  };
}

const SIMULACRO_COMPRABLE = {
  id: 50,
  titulo: 'Simulacro de prueba',
  woocommerceProductId: '900',
  precioSimulacro: 9.95,
} as unknown as Examen;

describe('RealizarSimulacroComponent', () => {
  let component: RealizarSimulacroComponent;
  let fixture: ComponentFixture<RealizarSimulacroComponent>;
  let examenService: ReturnType<typeof buildExamenServiceMock>;
  let toastr: {
    success: jest.Mock;
    error: jest.Mock;
    warning: jest.Mock;
    info: jest.Mock;
  };

  function setup(): void {
    examenService = buildExamenServiceMock();
    toastr = {
      success: jest.fn(),
      error: jest.fn(),
      warning: jest.fn(),
      info: jest.fn(),
    };

    TestBed.configureTestingModule({
      declarations: [RealizarSimulacroComponent],
      providers: [
        ...COMMON_TEST_PROVIDERS,
        { provide: ExamenesService, useValue: examenService },
        { provide: ToastrService, useValue: toastr },
        {
          provide: ConfirmationService,
          useValue: { confirm: jest.fn(), close: jest.fn() },
        },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(RealizarSimulacroComponent);
    component = fixture.componentInstance;
    component.lastLoadedExamen.set({ ...SIMULACRO_COMPRABLE });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    TestBed.resetTestingModule();
    setup();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('sin acceso → oferta de compra', () => {
    it('abre el diálogo de compra cuando no hay acceso y el simulacro es comprable (tiene producto WC)', async () => {
      examenService.verificarAccesoSimulacro$.mockReturnValue(
        of({ tieneAcceso: false, necesitaCodigo: false }),
      );

      await (component as any).verificarYProcederConSimulacro();

      expect(component.compraDialogVisible).toBe(true);
      expect(toastr.error).not.toHaveBeenCalled();
    });

    it('muestra error (no abre compra) cuando no hay acceso y el simulacro NO tiene producto WC', async () => {
      component.lastLoadedExamen.set({
        ...SIMULACRO_COMPRABLE,
        woocommerceProductId: undefined,
      } as Examen);
      examenService.verificarAccesoSimulacro$.mockReturnValue(
        of({ tieneAcceso: false, necesitaCodigo: false }),
      );

      await (component as any).verificarYProcederConSimulacro();

      expect(component.compraDialogVisible).toBe(false);
      expect(toastr.error).toHaveBeenCalled();
    });
  });

  describe('comprarSimulacro()', () => {
    it('cobra con un idempotencyKey no vacío y el examenId del simulacro cargado', () => {
      component.comprarSimulacro();

      expect(examenService.comprarSimulacroCof$).toHaveBeenCalledTimes(1);
      const [examenId, key] = examenService.comprarSimulacroCof$.mock.calls[0];
      expect(examenId).toBe(50);
      expect(typeof key).toBe('string');
      expect((key as string).length).toBeGreaterThan(0);
      // Tras una respuesta síncrona (of), el spinner queda re-habilitado.
      expect(component.comprandoSimulacro()).toBe(false);
    });

    it('guarda anti-doble-click: si ya está comprando, no relanza el cobro', () => {
      component.comprandoSimulacro.set(true);
      component.comprarSimulacro();
      expect(examenService.comprarSimulacroCof$).not.toHaveBeenCalled();
    });

    it('éxito → cierra el diálogo, hace toast y re-verifica acceso para continuar', () => {
      component.compraDialogVisible = true;
      examenService.comprarSimulacroCof$.mockReturnValue(
        of({ success: true, consumibleId: 7, mensaje: 'Has comprado' }),
      );
      // En la re-verificación ya tiene acceso → continúa el flujo (no vuelve a comprar).
      examenService.verificarAccesoSimulacro$.mockReturnValue(
        of({ tieneAcceso: true, necesitaCodigo: false }),
      );

      component.comprarSimulacro();

      expect(component.compraDialogVisible).toBe(false);
      expect(toastr.success).toHaveBeenCalled();
      expect(examenService.verificarAccesoSimulacro$).toHaveBeenCalledWith(50);
    });

    it('requiereCheckout → abre el diálogo de tienda (sin rechazo), no toast de error', () => {
      examenService.comprarSimulacroCof$.mockReturnValue(
        of({
          success: false,
          requiereCheckout: true,
          wooProductId: '900',
          mensaje: 'Completa en la tienda',
        }),
      );

      component.comprarSimulacro();

      expect(component.checkoutDialogVisible).toBe(true);
      expect(component.checkoutEsRechazo).toBe(false);
      expect(component.checkoutWooProductId).toBe('900');
      expect(component.compraDialogVisible).toBe(false);
    });

    it('PAGO_RECHAZADO → abre el diálogo de tienda marcado como rechazo', () => {
      examenService.comprarSimulacroCof$.mockReturnValue(
        of({
          success: false,
          error: 'PAGO_RECHAZADO',
          wooProductId: '900',
          mensaje: 'Tarjeta rechazada',
        }),
      );

      component.comprarSimulacro();

      expect(component.checkoutDialogVisible).toBe(true);
      expect(component.checkoutEsRechazo).toBe(true);
      expect(component.checkoutWooProductId).toBe('900');
    });

    it('ERROR_TEMPORAL → toast de aviso y NO abre la tienda (reintentable)', () => {
      examenService.comprarSimulacroCof$.mockReturnValue(
        of({
          success: false,
          error: 'ERROR_TEMPORAL',
          mensaje: 'Verificando pago',
        }),
      );

      component.comprarSimulacro();

      expect(component.checkoutDialogVisible).toBe(false);
      expect(toastr.warning).toHaveBeenCalled();
    });

    it('un retry tras ERROR_TEMPORAL reutiliza la MISMA idempotencyKey (no doble-cobro)', async () => {
      // Abrir la oferta fija la clave del intento.
      examenService.verificarAccesoSimulacro$.mockReturnValue(
        of({ tieneAcceso: false, necesitaCodigo: false }),
      );
      await (component as any).verificarYProcederConSimulacro();

      examenService.comprarSimulacroCof$.mockReturnValue(
        of({ success: false, error: 'ERROR_TEMPORAL', mensaje: 'Verificando' }),
      );
      component.comprarSimulacro(); // intento
      component.comprarSimulacro(); // retry del MISMO intento

      const k1 = examenService.comprarSimulacroCof$.mock.calls[0][1];
      const k2 = examenService.comprarSimulacroCof$.mock.calls[1][1];
      expect(k1).toBe(k2);
    });

    it('una compra NUEVA (tras éxito) usa una idempotencyKey distinta', () => {
      examenService.comprarSimulacroCof$.mockReturnValue(
        of({ success: true, consumibleId: 1, mensaje: 'ok' }),
      );
      examenService.verificarAccesoSimulacro$.mockReturnValue(
        of({ tieneAcceso: true, necesitaCodigo: false }),
      );

      component.comprarSimulacro();
      const k1 = examenService.comprarSimulacroCof$.mock.calls[0][1];
      // Tras el éxito la clave se limpia → la siguiente compra genera otra.
      component.comprarSimulacro();
      const k2 = examenService.comprarSimulacroCof$.mock.calls[1][1];

      expect(k1).not.toBe(k2);
    });

    it('error HTTP no clasificado → re-habilita el botón y toast de error', () => {
      examenService.comprarSimulacroCof$.mockReturnValue(
        throwError(() => new Error('500')),
      );

      component.comprarSimulacro();

      expect(component.comprandoSimulacro()).toBe(false);
      expect(toastr.error).toHaveBeenCalled();
    });
  });

  describe('completarEnTienda()', () => {
    it('abre la tienda WC con el add-to-cart del producto y cierra el diálogo', () => {
      const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
      component.checkoutWooProductId = '900';
      component.checkoutDialogVisible = true;

      component.completarEnTienda();

      expect(openSpy).toHaveBeenCalledTimes(1);
      expect(openSpy.mock.calls[0][0]).toContain('add-to-cart=900');
      expect(component.checkoutDialogVisible).toBe(false);
      openSpy.mockRestore();
    });

    it('no hace nada si no hay producto WC', () => {
      const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
      component.checkoutWooProductId = null;

      component.completarEnTienda();

      expect(openSpy).not.toHaveBeenCalled();
      openSpy.mockRestore();
    });
  });
});
