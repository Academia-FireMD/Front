import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ToastrService } from 'ngx-toastr';
import { ConfirmationService } from 'primeng/api';
import { of } from 'rxjs';
import { AutoasignacionService } from '../services/autoasignacion.service';
import { PlanificacionesService } from '../../services/planificaciones.service';
import { NivelOposicion } from '../../shared/models/pregunta.model';
import { Oposicion } from '../../shared/models/subscription.model';
import { TipoDePlanificacionDeseada } from '../../shared/models/user.model';
import type { PlanificacionMensual } from '../../shared/models/planificacion.model';
import { PlanificacionAdminComponent } from './planificacion-admin.component';

class ResizeObserverMock {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

describe('PlanificacionAdminComponent', () => {
  let component: PlanificacionAdminComponent;
  let fixture: ComponentFixture<PlanificacionAdminComponent>;
  let service: AutoasignacionService;
  let confirmation: ConfirmationService;

  beforeAll(() => {
    // PrimeNG Table/TabView requieren ResizeObserver en el entorno de test.
    (globalThis as any).ResizeObserver = ResizeObserverMock;
  });

  beforeEach(async () => {
    const serviceMock = {
      getVariantes$: jest.fn(() => of([])),
      getReglas$: jest.fn(() => of([])),
      getSinCoincidencia$: jest.fn(() => of([])),
      crearVariante$: jest.fn(() => of({})),
      actualizarVariante$: jest.fn(() => of({})),
      crearRegla$: jest.fn(() => of({})),
      actualizarRegla$: jest.fn(() => of({})),
      reconciliar$: jest.fn(() =>
        of({
          aplicar: false,
          previewHash: 'preview-fixture',
          totalElegibles: 0,
          aplicables: 0,
          aplicados: 0,
          noAplicables: 0,
          casos: [],
        }),
      ),
    };
    confirmation = new ConfirmationService();
    const confirmOriginal = confirmation.confirm.bind(confirmation);
    jest.spyOn(confirmation, 'confirm').mockImplementation((config) => {
      confirmOriginal(config);
      return confirmation;
    });

    await TestBed.configureTestingModule({
      imports: [PlanificacionAdminComponent],
      providers: [
        { provide: AutoasignacionService, useValue: serviceMock },
        {
          provide: PlanificacionesService,
          useValue: {
            getPlanificacionMensual$: jest.fn(() => of({ data: [] })),
          },
        },
        {
          provide: ToastrService,
          useValue: { error: jest.fn(), success: jest.fn() },
        },
        { provide: ConfirmationService, useValue: confirmation },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    service = TestBed.inject(AutoasignacionService);
    fixture = TestBed.createComponent(PlanificacionAdminComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('carga variantes, reglas y sin-coincidencia al iniciar', () => {
    expect(service.getVariantes$).toHaveBeenCalled();
    expect(service.getReglas$).toHaveBeenCalled();
    expect(service.getSinCoincidencia$).toHaveBeenCalled();
  });

  it('crea una variante nueva con el payload correcto', async () => {
    component.varianteForm.patchValue({
      codigo: 'GA4-6',
      oposicion: Oposicion.GENERAL,
      nivel: NivelOposicion.AVANZADO,
      franja: 'FRANJA_CUATRO_A_SEIS_HORAS',
      planificacionMensualId: null,
      activa: true,
    });
    await component.guardarVariante();

    expect(service.crearVariante$).toHaveBeenCalledWith({
      codigo: 'GA4-6',
      oposicion: Oposicion.GENERAL,
      nivel: NivelOposicion.AVANZADO,
      franja: 'FRANJA_CUATRO_A_SEIS_HORAS',
      planificacionMensualId: null,
      activa: true,
    });
  });

  it('actualiza una variante existente con su id', async () => {
    component.editarVariante({
      id: 7,
      codigo: 'GA6-8',
      oposicion: Oposicion.GENERAL,
      nivel: NivelOposicion.AVANZADO,
      franja: 'FRANJA_SEIS_A_OCHO_HORAS' as TipoDePlanificacionDeseada,
      activa: true,
    });
    expect(component.varianteForm.controls.codigo.disabled).toBe(true);
    expect(component.varianteForm.controls.oposicion.disabled).toBe(true);
    expect(component.varianteForm.controls.nivel.disabled).toBe(true);
    expect(component.varianteForm.controls.franja.disabled).toBe(true);
    component.varianteForm.patchValue({ activa: false });
    await component.guardarVariante();

    expect(service.actualizarVariante$).toHaveBeenCalledWith(7, {
      planificacionMensualId: null,
      activa: false,
    });
  });

  it('vuelve a habilitar la identidad al iniciar una variante nueva', () => {
    component.editarVariante({
      id: 7,
      codigo: 'GA6-8',
      oposicion: Oposicion.GENERAL,
      nivel: NivelOposicion.AVANZADO,
      franja: 'FRANJA_SEIS_A_OCHO_HORAS' as TipoDePlanificacionDeseada,
      activa: true,
    });
    component.nuevaVariante();

    expect(component.varianteForm.controls.codigo.enabled).toBe(true);
    expect(component.varianteForm.controls.oposicion.enabled).toBe(true);
    expect(component.varianteForm.controls.nivel.enabled).toBe(true);
    expect(component.varianteForm.controls.franja.enabled).toBe(true);
  });

  it('crea una regla de oposición', async () => {
    component.reglaForm.patchValue({
      oposicionSuscripcion: Oposicion.MADRID,
      oposicionPlanificacion: Oposicion.MADRID,
      activa: true,
    });
    await component.guardarRegla();

    expect(service.crearRegla$).toHaveBeenCalledWith({
      oposicionSuscripcion: Oposicion.MADRID,
      oposicionPlanificacion: Oposicion.MADRID,
      activa: true,
    });
  });

  it('edita una regla con identidad bloqueada y PATCH solo de activa', async () => {
    component.editarRegla({
      id: 5,
      oposicionSuscripcion: Oposicion.MADRID,
      oposicionPlanificacion: Oposicion.GENERAL,
      activa: true,
    });

    expect(component.reglaForm.controls.oposicionSuscripcion.disabled).toBe(
      true,
    );
    expect(component.reglaForm.controls.oposicionPlanificacion.disabled).toBe(
      true,
    );
    component.reglaForm.patchValue({ activa: false });
    await component.guardarRegla();

    expect(service.actualizarRegla$).toHaveBeenCalledWith(5, {
      activa: false,
    });
  });

  it('mapea una planificación mensual canónica al guardar una variante', async () => {
    component.planificacionesMensuales.set([
      {
        id: 17,
        identificador: 'GENERAL-4-6',
        mes: 8,
        ano: 2026,
        tipoDePlanificacion:
          TipoDePlanificacionDeseada.FRANJA_CUATRO_A_SEIS_HORAS,
        relevancia: [Oposicion.GENERAL],
      } as PlanificacionMensual,
    ]);
    component.varianteForm.patchValue({
      codigo: 'GA4-6',
      oposicion: Oposicion.GENERAL,
      nivel: NivelOposicion.AVANZADO,
      franja: 'FRANJA_CUATRO_A_SEIS_HORAS',
      planificacionMensualId: 17,
      activa: true,
    });

    await component.guardarVariante();

    expect(service.crearVariante$).toHaveBeenCalledWith(
      expect.objectContaining({ planificacionMensualId: 17 }),
    );
  });

  it('muestra todos los motivos del diagnóstico backend', () => {
    expect(component.motivoDiagnostico('SIN_CONFIGURACION')).toBe(
      'Sin configuración',
    );
    expect(component.motivoDiagnostico('PREFERENCIAS_INCOMPLETAS')).toBe(
      'Preferencias incompletas',
    );
    expect(component.motivoDiagnostico('SIN_VARIANTE')).toBe(
      'Sin variante compatible',
    );
    expect(component.motivoDiagnostico('VARIANTE_INACTIVA')).toBe(
      'Variante inactiva',
    );
    expect(component.motivoDiagnostico('SIN_PLANIFICACION_PUBLICADA')).toBe(
      'Sin planificación publicada',
    );
    expect(component.motivoDiagnostico('OPOSICION_NO_PERMITIDA')).toBe(
      'Oposición no permitida',
    );
    expect(component.motivoDiagnostico('SIN_ASIGNACION')).toBe(
      'Sin asignación',
    );
    expect(component.motivoDiagnostico('PROGRESO_INCOMPLETO')).toBe(
      'Progreso incompleto',
    );
  });

  it('filtra las planificaciones por franja y relevancia de la variante', () => {
    component.planificacionesMensuales.set([
      {
        id: 1,
        identificador: 'GENERAL-4-6',
        mes: 8,
        ano: 2026,
        tipoDePlanificacion:
          TipoDePlanificacionDeseada.FRANJA_CUATRO_A_SEIS_HORAS,
        relevancia: [Oposicion.GENERAL],
      } as PlanificacionMensual,
      {
        id: 2,
        identificador: 'GENERAL-6-8',
        mes: 8,
        ano: 2026,
        tipoDePlanificacion:
          TipoDePlanificacionDeseada.FRANJA_SEIS_A_OCHO_HORAS,
        relevancia: [Oposicion.GENERAL],
      } as PlanificacionMensual,
      {
        id: 3,
        identificador: 'MADRID-4-6',
        mes: 8,
        ano: 2026,
        tipoDePlanificacion:
          TipoDePlanificacionDeseada.FRANJA_CUATRO_A_SEIS_HORAS,
        relevancia: [Oposicion.MADRID],
      } as PlanificacionMensual,
    ]);
    component.varianteForm.patchValue({
      oposicion: Oposicion.GENERAL,
      franja: TipoDePlanificacionDeseada.FRANJA_CUATRO_A_SEIS_HORAS,
    });

    expect(component.planificacionOptions).toEqual([
      { label: 'GENERAL-4-6 (8/2026)', value: 1 },
    ]);
  });

  it('limpia el plan seleccionado cuando deja de ser compatible', () => {
    component.planificacionesMensuales.set([
      {
        id: 1,
        identificador: 'MADRID-6-8',
        mes: 8,
        ano: 2026,
        tipoDePlanificacion:
          TipoDePlanificacionDeseada.FRANJA_SEIS_A_OCHO_HORAS,
        relevancia: [Oposicion.MADRID],
      } as PlanificacionMensual,
    ]);
    component.varianteForm.patchValue({
      oposicion: Oposicion.MADRID,
      franja: TipoDePlanificacionDeseada.FRANJA_SEIS_A_OCHO_HORAS,
      planificacionMensualId: 1,
    });
    component.varianteForm.patchValue({
      franja: TipoDePlanificacionDeseada.FRANJA_CUATRO_A_SEIS_HORAS,
    });

    expect(component.varianteForm.controls.planificacionMensualId.value).toBe(
      null,
    );
  });

  it('oculta planes ya mapeados y conserva el mapping de la variante editada', () => {
    component.planificacionesMensuales.set([
      {
        id: 17,
        identificador: 'GENERAL-4-6',
        mes: 8,
        ano: 2026,
        tipoDePlanificacion:
          TipoDePlanificacionDeseada.FRANJA_CUATRO_A_SEIS_HORAS,
        relevancia: [Oposicion.GENERAL],
      } as PlanificacionMensual,
    ]);
    component.variantes.set([
      {
        id: 7,
        codigo: 'GA4-6',
        oposicion: Oposicion.GENERAL,
        nivel: NivelOposicion.AVANZADO,
        franja: TipoDePlanificacionDeseada.FRANJA_CUATRO_A_SEIS_HORAS,
        activa: true,
        planificacionMensualId: 17,
      },
    ]);
    component.varianteForm.patchValue({
      id: null,
      oposicion: Oposicion.GENERAL,
      franja: TipoDePlanificacionDeseada.FRANJA_CUATRO_A_SEIS_HORAS,
    });
    expect(component.planificacionOptions).toEqual([]);

    component.editarVariante(component.variantes()[0]);
    expect(component.planificacionOptions).toEqual([
      { label: 'GENERAL-4-6 (8/2026)', value: 17 },
    ]);
  });

  it('ofrece preview y exige confirmación explícita antes de aplicar', async () => {
    const reconcile = service.reconciliar$ as jest.Mock;
    const preview = {
      aplicar: false,
      previewHash: 'preview-1',
      totalElegibles: 3,
      aplicables: 2,
      aplicados: 0,
      noAplicables: 1,
      casos: [],
    };
    reconcile.mockReturnValueOnce(of(preview));

    await component.previsualizarReconciliacion();

    expect(reconcile).toHaveBeenCalledWith(false, null);
    expect(component.reconciliacion()).toEqual(preview);
    expect(component.reconciliacion()?.totalElegibles).toBe(3);

    await component.aplicarReconciliacion();
    expect(confirmation.confirm).toHaveBeenCalledTimes(1);
    const confirmacion = (confirmation.confirm as jest.Mock).mock.calls[0][0];
    confirmacion.reject();
    expect(reconcile).toHaveBeenCalledTimes(1);

    reconcile.mockReturnValueOnce(
      of({ ...preview, aplicar: true, aplicados: 2 }),
    );
    await component.aplicarReconciliacion();
    const segundaConfirmacion = (confirmation.confirm as jest.Mock).mock
      .calls[1][0];
    await segundaConfirmacion.accept();

    expect(reconcile).toHaveBeenLastCalledWith(true, 'preview-1');
    expect(component.reconciliacion()?.aplicados).toBe(2);
    expect(service.getSinCoincidencia$).toHaveBeenCalledTimes(2);
  });

  it('muestra error visible y mantiene el apply bloqueado si el preview cambia', async () => {
    const reconcile = service.reconciliar$ as jest.Mock;
    const preview = {
      aplicar: false,
      previewHash: 'preview-2',
      totalElegibles: 1,
      aplicables: 1,
      aplicados: 0,
      noAplicables: 0,
      casos: [],
    };
    reconcile.mockReturnValueOnce(of(preview));
    await component.previsualizarReconciliacion();
    await component.aplicarReconciliacion();
    const confirmacion = (confirmation.confirm as jest.Mock).mock.calls[0][0];
    reconcile.mockReturnValueOnce(of({ ...preview, aplicar: false }));

    await confirmacion.accept();

    expect(component.error()).toContain('No se pudo aplicar');
    expect(component.reconciliacion()).toBeNull();
  });
});
