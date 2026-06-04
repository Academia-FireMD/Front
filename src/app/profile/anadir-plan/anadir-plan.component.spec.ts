import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of } from 'rxjs';
import { MessageService } from 'primeng/api';

import { AnadirPlanComponent } from './anadir-plan.component';
import {
  AnadirPlanResponse,
  PlanDisponible,
  SuscripcionManagementService,
} from '../../services/suscripcion-management.service';
import { Oposicion } from '../../shared/models/subscription.model';

const PLAN_BASIC: PlanDisponible = {
  id: '1044',
  nombre: 'CPBA Alicante Básico',
  sku: 'CPBA-BASIC-MONTHLY',
  precio: 59.9,
  precioRegular: 59.9,
  precioOferta: null,
  tipo: 'BASIC',
  billingPeriod: 'month',
  billingInterval: 1,
};

const SUCCESS_RESPONSE: AnadirPlanResponse = {
  success: true,
  suscripcionId: 1782,
  mensaje: 'Tu nuevo plan ya está activo.',
};

const CHECKOUT_RESPONSE: AnadirPlanResponse = {
  success: true,
  requiereCheckout: true,
  mensaje: 'No tienes una tarjeta guardada.',
};

describe('AnadirPlanComponent', () => {
  let component: AnadirPlanComponent;
  let fixture: ComponentFixture<AnadirPlanComponent>;
  let svc: jest.Mocked<SuscripcionManagementService>;

  beforeEach(async () => {
    svc = {
      obtenerPlanesDisponibles: jest.fn(() => of([PLAN_BASIC])),
      anadirPlan: jest.fn(() => of(SUCCESS_RESPONSE)),
    } as any;

    await TestBed.configureTestingModule({
      imports: [AnadirPlanComponent],
      providers: [
        { provide: SuscripcionManagementService, useValue: svc },
        MessageService,
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(AnadirPlanComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // (1) La lista de oposiciones excluye las contratadas.
  it('oposicionesDisponibles excluye las oposiciones ya contratadas', () => {
    component.oposicionesContratadas = [Oposicion.VALENCIA_AYUNTAMIENTO];
    const valores = component.oposicionesDisponibles.map((o) => o.value);
    expect(valores).not.toContain(Oposicion.VALENCIA_AYUNTAMIENTO);
    expect(valores).toContain(Oposicion.ALICANTE_CPBA);
    expect(valores).toContain(Oposicion.MADRID);
    expect(valores).toContain(Oposicion.GENERAL);
  });

  // (2) Elegir oposición llama a obtenerPlanesDisponibles.
  it('al elegir oposición llama a obtenerPlanesDisponibles y guarda los planes', () => {
    component.oposicionSeleccionada = Oposicion.ALICANTE_CPBA;
    component.onOposicionChange();
    expect(svc.obtenerPlanesDisponibles).toHaveBeenCalledWith(
      Oposicion.ALICANTE_CPBA,
    );
    expect(component.planes).toEqual([PLAN_BASIC]);
  });

  // (2b) Oposición sin planes → sinPlanes === true.
  it('si obtenerPlanesDisponibles devuelve vacío, sinPlanes es true', () => {
    svc.obtenerPlanesDisponibles.mockReturnValue(of([]));
    component.oposicionSeleccionada = Oposicion.MADRID;
    component.onOposicionChange();
    expect(component.planes).toEqual([]);
    expect(component.sinPlanes).toBe(true);
  });

  // (3) "Activar" llama a service.anadirPlan con el sku del tier.
  it('activarPlan llama a anadirPlan con el sku del tier y emite planAnadido', () => {
    const planAnadidoSpy = jest.fn();
    const cerrarSpy = jest.fn();
    component.planAnadido.subscribe(planAnadidoSpy);
    component.cerrar.subscribe(cerrarSpy);

    component.tierSeleccionado = PLAN_BASIC;
    component.activarPlan();

    expect(svc.anadirPlan).toHaveBeenCalledWith(PLAN_BASIC.sku);
    expect(planAnadidoSpy).toHaveBeenCalled();
    expect(cerrarSpy).toHaveBeenCalled();
    expect(component.requiereCheckout()).toBe(false);
  });

  // (4) requiereCheckout → abre el checkout de WC en pestaña nueva.
  it('requiereCheckout muestra el panel y "Completar en la tienda" abre WC', () => {
    svc.anadirPlan.mockReturnValue(of(CHECKOUT_RESPONSE));
    const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);

    component.tierSeleccionado = PLAN_BASIC;
    component.activarPlan();
    expect(component.requiereCheckout()).toBe(true);

    component.completarEnTienda();
    expect(openSpy).toHaveBeenCalledTimes(1);
    const url = openSpy.mock.calls[0][0] as string;
    expect(url).toContain(`add-to-cart=${PLAN_BASIC.id}`);
    expect(openSpy.mock.calls[0][1]).toBe('_blank');

    openSpy.mockRestore();
  });

  // labelBotonActivar refleja el precio del tier elegido.
  it('labelBotonActivar muestra el precio del tier seleccionado', () => {
    component.tierSeleccionado = PLAN_BASIC;
    expect(component.labelBotonActivar()).toContain('59,90');
  });
});
