import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of } from 'rxjs';
import { MessageService } from 'primeng/api';

import { GestionarPlanComponent } from './gestionar-plan.component';
import {
  AnadirPlanResponse,
  PlanDisponible,
  PreviewCambioResponse,
  SuscripcionManagementService,
} from '../../services/suscripcion-management.service';
import {
  Oposicion,
  Suscripcion,
  SuscripcionStatus,
  SuscripcionTipo,
} from '../../shared/models/subscription.model';

// ── Fixtures ──────────────────────────────────────────────────────
const PLAN_BASIC_MENSUAL: PlanDisponible = {
  id: 'bas-m',
  nombre: 'Valencia Básico (mensual)',
  sku: 'VALENCIA-BASIC-MONTHLY',
  precio: 29.99,
  precioRegular: 29.99,
  precioOferta: null,
  tipo: 'BASIC',
  billingPeriod: 'month',
  billingInterval: 1,
};

const PLAN_ADVANCED_MENSUAL: PlanDisponible = {
  id: 'adv-m',
  nombre: 'Valencia Avanzado (mensual)',
  sku: 'VALENCIA-ADVANCED-MONTHLY',
  precio: 49.99,
  precioRegular: 49.99,
  precioOferta: null,
  tipo: 'ADVANCED',
  billingPeriod: 'month',
  billingInterval: 1,
};

const PLAN_ADVANCED_ANUAL: PlanDisponible = {
  id: 'adv-y',
  nombre: 'Valencia Avanzado (anual)',
  sku: 'VALENCIA-ADVANCED-YEARLY',
  precio: 499.99,
  precioRegular: 499.99,
  precioOferta: null,
  tipo: 'ADVANCED',
  billingPeriod: 'year',
  billingInterval: 1,
};

const PLANES_VALENCIA: PlanDisponible[] = [
  PLAN_BASIC_MENSUAL,
  PLAN_ADVANCED_MENSUAL,
  PLAN_ADVANCED_ANUAL,
];

const SUSCRIPCION_VALENCIA: Suscripcion = {
  id: 1,
  usuarioId: 10,
  tipo: SuscripcionTipo.BASIC,
  oposicion: Oposicion.VALENCIA_AYUNTAMIENTO,
  fechaInicio: new Date('2026-01-01'),
  isOfferPlan: false,
  monthlyPrice: 29.99,
  status: SuscripcionStatus.ACTIVE,
  sku: 'VALENCIA-BASIC-MONTHLY',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
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

describe('GestionarPlanComponent', () => {
  let component: GestionarPlanComponent;
  let fixture: ComponentFixture<GestionarPlanComponent>;
  let svc: jest.Mocked<SuscripcionManagementService>;

  beforeEach(async () => {
    svc = {
      obtenerPlanesDisponibles: jest.fn(() => of(PLANES_VALENCIA)),
      previewCambioSuscripcion: jest.fn(() => of(UPGRADE_PREVIEW)),
      cambiarSuscripcion: jest.fn(() =>
        of({ mensaje: 'ok', switchType: 'UPGRADE', modo: 'INMEDIATO' }),
      ),
      anadirPlan: jest.fn(() =>
        of({ success: true, mensaje: 'activado' } as AnadirPlanResponse),
      ),
    } as any;

    await TestBed.configureTestingModule({
      imports: [GestionarPlanComponent],
      providers: [
        { provide: SuscripcionManagementService, useValue: svc },
        MessageService,
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(GestionarPlanComponent);
    component = fixture.componentInstance;
  });

  function createAnadir(contratadas: Oposicion[] = []) {
    component.modo = 'anadir';
    component.oposicionesContratadas = contratadas;
    fixture.detectChanges();
  }

  function createCambiar() {
    component.modo = 'cambiar';
    component.suscripcion = SUSCRIPCION_VALENCIA;
    component.oposicionesContratadas = [Oposicion.VALENCIA_AYUNTAMIENTO];
    fixture.detectChanges();
  }

  it('should create', () => {
    createAnadir();
    expect(component).toBeTruthy();
  });

  // ── Chips: excluyen GENERAL siempre ──────────────────────────────
  it('los chips NUNCA incluyen Oposicion.GENERAL', () => {
    createAnadir();
    const values = component.chipsOposicion.map((c) => c.value);
    expect(values).not.toContain(Oposicion.GENERAL);
  });

  // ── Chips: en anadir excluyen las contratadas ────────────────────
  it('modo anadir: los chips excluyen las oposiciones contratadas', () => {
    createAnadir([Oposicion.VALENCIA_AYUNTAMIENTO]);
    const values = component.chipsOposicion.map((c) => c.value);
    expect(values).not.toContain(Oposicion.VALENCIA_AYUNTAMIENTO);
    expect(values).toContain(Oposicion.ALICANTE_CPBA);
    expect(values).toContain(Oposicion.MADRID);
  });

  // ── Chips: en cambiar SOLO la oposición de la sub (crossgrade = acción separada) ──
  it('modo cambiar: solo la oposición de la suscripción (no otras)', () => {
    createCambiar();
    const values = component.chipsOposicion.map((c) => c.value);
    expect(values).toEqual([Oposicion.VALENCIA_AYUNTAMIENTO]);
    expect(values).not.toContain(Oposicion.ALICANTE_CPBA);
    expect(values).not.toContain(Oposicion.MADRID);
    expect(component.oposicionLabel).toBe('Valencia Ayuntamiento');
  });

  // ── Elegir chip carga planes y los agrupa por periodo ────────────
  it('al elegir un chip, carga los planes y los agrupa en Mensual / Anual', () => {
    createAnadir();
    component.seleccionarOposicion(Oposicion.VALENCIA_AYUNTAMIENTO);
    expect(svc.obtenerPlanesDisponibles).toHaveBeenCalledWith(
      Oposicion.VALENCIA_AYUNTAMIENTO,
    );
    const titulos = component.gruposPeriodo.map((g) => g.titulo);
    expect(titulos).toEqual(['Mensual', 'Anual']);
    const mensual = component.gruposPeriodo.find((g) => g.periodo === 'month');
    const anual = component.gruposPeriodo.find((g) => g.periodo === 'year');
    expect(mensual?.planes.length).toBe(2);
    expect(anual?.planes.length).toBe(1);
  });

  // ── Modo cambiar: el plan actual no aparece como destino ─────────
  it('modo cambiar: excluye el SKU del plan actual de los destinos', () => {
    createCambiar(); // ngOnInit preselecciona Valencia y carga planes
    const todosLosSkus = component.gruposPeriodo
      .flatMap((g) => g.planes)
      .map((p) => p.sku);
    expect(todosLosSkus).not.toContain(SUSCRIPCION_VALENCIA.sku);
  });

  // ── Modo anadir: anadirPlan en éxito ─────────────────────────────
  it('modo anadir: activarPlan llama anadirPlan y emite realizado/cerrar en éxito', () => {
    createAnadir();
    component.seleccionarOposicion(Oposicion.VALENCIA_AYUNTAMIENTO);
    component.seleccionarPlan(PLAN_BASIC_MENSUAL);
    const realizado = jest.fn();
    const cerrar = jest.fn();
    component.realizado.subscribe(realizado);
    component.cerrar.subscribe(cerrar);

    component.activarPlan();

    expect(svc.anadirPlan).toHaveBeenCalledWith(PLAN_BASIC_MENSUAL.sku);
    expect(realizado).toHaveBeenCalled();
    expect(cerrar).toHaveBeenCalled();
  });

  // ── Modo anadir: requiereCheckout abre panel "sin tarjeta" ───────
  it('modo anadir: requiereCheckout activa el panel de checkout y completarEnTienda abre WC', () => {
    svc.anadirPlan.mockReturnValue(
      of({ success: false, requiereCheckout: true, mensaje: '' }),
    );
    createAnadir();
    component.seleccionarOposicion(Oposicion.VALENCIA_AYUNTAMIENTO);
    component.seleccionarPlan(PLAN_BASIC_MENSUAL);

    component.activarPlan();
    expect(component.requiereCheckout()).toBe(true);

    const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
    component.completarEnTienda();
    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining(`add-to-cart=${PLAN_BASIC_MENSUAL.id}`),
      '_blank',
    );
    openSpy.mockRestore();
  });

  // ── Modo cambiar: seleccionar plan dispara preview ───────────────
  it('modo cambiar: seleccionar un plan dispara previewCambioSuscripcion', () => {
    createCambiar();
    component.seleccionarPlan(PLAN_ADVANCED_MENSUAL);
    expect(svc.previewCambioSuscripcion).toHaveBeenCalledWith(
      SUSCRIPCION_VALENCIA.id,
      PLAN_ADVANCED_MENSUAL.sku,
    );
    expect(component.preview()?.switchType).toBe('UPGRADE');
  });

  // ── Modo cambiar: gating bloquea con COOLDOWN ────────────────────
  it('modo cambiar: aviso COOLDOWN bloquea el confirmar', () => {
    createCambiar();
    component.preview.set({
      ...UPGRADE_PREVIEW,
      avisos: [{ codigo: 'COOLDOWN', mensaje: 'espera' }],
    });
    expect(component.puedeConfirmar()).toBe(false);
  });

  // ── Modo cambiar: gating bloquea upgrade sin tarjeta usable ──────
  it('modo cambiar: upgrade sin tarjeta utilizable bloquea el confirmar', () => {
    createCambiar();
    component.preview.set({
      ...UPGRADE_PREVIEW,
      requiereCobro: true,
      metodoPago: { usable: false, tarjetaMasked: null },
    });
    expect(component.puedeConfirmar()).toBe(false);
  });

  // ── Modo cambiar: confirma con cambiarSuscripcion ────────────────
  it('modo cambiar: confirmarCambio llama cambiarSuscripcion con la sub y el SKU', () => {
    createCambiar();
    component.seleccionarPlan(PLAN_ADVANCED_MENSUAL);
    component.confirmarCambio();
    expect(svc.cambiarSuscripcion).toHaveBeenCalledWith(
      SUSCRIPCION_VALENCIA.id,
      PLAN_ADVANCED_MENSUAL.sku,
    );
  });

  // ── Label del botón cambiar (lógica money-critical preservada) ───
  it('modo cambiar: label upgrade muestra "Pagar X,XX € y cambiar"', () => {
    createCambiar();
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
