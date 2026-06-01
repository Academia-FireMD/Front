import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of } from 'rxjs';
import { MessageService } from 'primeng/api';

import { CambioSuscripcionComponent } from './cambio-suscripcion.component';
import {
  PlanDisponible,
  PreviewCambioResponse,
  SuscripcionManagementService,
} from '../../services/suscripcion-management.service';

const PLAN_ADVANCED: PlanDisponible = {
  id: 'adv-1',
  nombre: 'Valencia Avanzado',
  sku: 'VALENCIA-ADVANCED-MONTHLY',
  precio: 49.99,
  precioRegular: 49.99,
  precioOferta: null,
  tipo: 'Avanzado',
  billingPeriod: 'month',
  billingInterval: 1,
};

const UPGRADE_PREVIEW: PreviewCambioResponse = {
  switchType: 'UPGRADE',
  modo: 'INMEDIATO',
  requiereCobro: true,
  costeCalculable: true,
  prorrateo: { importe: 12.5, diasRestantes: 15, diasCiclo: 30 },
  precioActual: 29.99,
  precioNuevo: 49.99,
  fechaAplicacion: null,
  metodoPago: { usable: true, tarjetaMasked: '•••• 0004' },
  avisos: [],
};

describe('CambioSuscripcionComponent', () => {
  let component: CambioSuscripcionComponent;
  let fixture: ComponentFixture<CambioSuscripcionComponent>;
  let previewSvc: jest.Mocked<SuscripcionManagementService>;

  beforeEach(async () => {
    previewSvc = {
      previewCambioSuscripcion: jest.fn(() => of(UPGRADE_PREVIEW)),
      validarPlazo: jest.fn(() =>
        of({
          valido: true,
          diasRestantes: 10,
          proximoPago: new Date('2026-06-15'),
        }),
      ),
      obtenerDetalleSuscripcion: jest.fn(() =>
        of({ switchOperationProgramada: null } as any),
      ),
      obtenerPlanesDisponibles: jest.fn(() => of([])),
      cambiarSuscripcion: jest.fn(() =>
        of({ mensaje: 'ok', switchType: 'UPGRADE', modo: 'INMEDIATO' }),
      ),
      cancelarCambioProgramado: jest.fn(() => of({ mensaje: 'ok' })),
    } as any;

    await TestBed.configureTestingModule({
      imports: [CambioSuscripcionComponent],
      providers: [
        { provide: SuscripcionManagementService, useValue: previewSvc },
        MessageService,
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(CambioSuscripcionComponent);
    component = fixture.componentInstance;
    component.suscripcionId = 1;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // seleccionarPlan dispara previewCambioSuscripcion y guarda la signal preview()
  it('al seleccionar un plan, carga el preview y lo guarda', () => {
    previewSvc.previewCambioSuscripcion.mockReturnValue(of(UPGRADE_PREVIEW));
    component.seleccionarPlan(PLAN_ADVANCED);
    expect(previewSvc.previewCambioSuscripcion).toHaveBeenCalledWith(
      component.suscripcionId,
      PLAN_ADVANCED.sku,
    );
    expect(component.preview()?.switchType).toBe('UPGRADE');
  });

  // gating: upgrade sin tarjeta utilizable → puedeConfirmar()===false
  it('upgrade sin tarjeta utilizable bloquea el confirmar', () => {
    component.preview.set({
      ...UPGRADE_PREVIEW,
      requiereCobro: true,
      metodoPago: { usable: false, tarjetaMasked: null },
    });
    expect(component.puedeConfirmar()).toBe(false);
  });

  // upgrade con tarjeta → puedeConfirmar()===true
  it('upgrade con tarjeta utilizable permite confirmar', () => {
    component.preview.set({
      ...UPGRADE_PREVIEW,
      costeCalculable: true,
      requiereCobro: true,
      metodoPago: { usable: true, tarjetaMasked: '•••• 0004' },
    });
    expect(component.puedeConfirmar()).toBe(true);
  });

  // gating: upgrade con coste NO calculable → puedeConfirmar()===false (aunque requiereCobro sea false)
  it('upgrade con coste no calculable bloquea el confirmar', () => {
    component.preview.set({
      ...UPGRADE_PREVIEW,
      costeCalculable: false,
      requiereCobro: false,
      avisos: [{ codigo: 'PRECIO_NO_DISPONIBLE', mensaje: 'x' }],
    });
    expect(component.puedeConfirmar()).toBe(false);
  });

  // label del botón por tipo
  it('etiqueta del botón: upgrade muestra "Pagar X,XX € y cambiar"', () => {
    component.preview.set({
      ...UPGRADE_PREVIEW,
      requiereCobro: true,
      prorrateo: { importe: 12.5, diasRestantes: 15, diasCiclo: 30 },
      metodoPago: { usable: true, tarjetaMasked: '•••• 0004' },
    });
    expect(component.labelBotonConfirmar()).toContain('Pagar');
    expect(component.labelBotonConfirmar()).toContain('12,50');
  });
});
