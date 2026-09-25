import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ToastrService } from 'ngx-toastr';
import { ConfirmationService } from 'primeng/api';
import { of } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { AutoasignacionService } from '../services/autoasignacion.service';
import { PlanificacionesService } from '../../services/planificaciones.service';
import { NivelOposicion } from '../../shared/models/pregunta.model';
import { Oposicion } from '../../shared/models/subscription.model';
import { TipoDePlanificacionDeseada } from '../../shared/models/user.model';
import type { PlanificacionMensual } from '../../shared/models/planificacion.model';
import { PlanificacionAdminComponent } from './planificacion-admin.component';
import {
  codigoPlantillaImportada,
  identidadVarianteImportada,
} from '../utils/variante-importada.util';

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
  let router: { navigate: jest.Mock };

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
      publicarVariante$: jest.fn(() => of({})),
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
      previewImportacionPlantillas$: jest.fn(() =>
        of({
          fileName: 'madrid.xlsx',
          fileHash: 'a'.repeat(64),
          puedeAplicar: true,
          yaAplicado: false,
          requiereConfirmacionSobrescritura: false,
          sobrescrituras: [],
          totales: {
            hojas: 1,
            semanas: 2,
            bloques: 12,
            entrenamientos: 2,
            errores: 0,
          },
          hojas: [],
        }),
      ),
      applyImportacionPlantillas$: jest.fn(() =>
        of({ yaAplicado: false, version: 3, hojas: [] }),
      ),
      previewCargaSemanas$: jest.fn(),
      applyCargaSemanas$: jest.fn(),
    };
    confirmation = new ConfirmationService();
    router = { navigate: jest.fn() };
    const confirmOriginal = confirmation.confirm.bind(confirmation);
    jest.spyOn(confirmation, 'confirm').mockImplementation((config) => {
      confirmOriginal(config);
      return confirmation;
    });

    await TestBed.configureTestingModule({
      imports: [PlanificacionAdminComponent],
      providers: [
        provideNoopAnimations(),
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
        { provide: Router, useValue: router },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: {
                get: jest.fn(() => null),
                getAll: jest.fn(() => []),
              },
            },
          },
        },
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
      oposicion: Oposicion.GENERAL,
      nivel: NivelOposicion.AVANZADO,
      franja: 'FRANJA_CUATRO_A_SEIS_HORAS',
      planificacionMensualId: null,
      activa: true,
    });
    await component.guardarVariante();

    expect(service.crearVariante$).toHaveBeenCalledWith({
      codigo: 'PGCVA4-6H',
      oposicion: Oposicion.GENERAL,
      nivel: NivelOposicion.AVANZADO,
      franja: 'FRANJA_CUATRO_A_SEIS_HORAS',
      planificacionMensualId: null,
      activa: true,
    });
  });

  it.each([
    [
      Oposicion.GENERAL,
      NivelOposicion.INICIACION,
      'FRANJA_CUATRO_A_SEIS_HORAS',
      'PGCVI4-6H',
    ],
    [
      Oposicion.GENERAL,
      NivelOposicion.INICIACION,
      'FRANJA_SEIS_A_OCHO_HORAS',
      'PGCVI6-8H',
    ],
    [
      Oposicion.GENERAL,
      NivelOposicion.AVANZADO,
      'FRANJA_CUATRO_A_SEIS_HORAS',
      'PGCVA4-6H',
    ],
    [
      Oposicion.GENERAL,
      NivelOposicion.AVANZADO,
      'FRANJA_SEIS_A_OCHO_HORAS',
      'PGCVA6-8H',
    ],
    [
      Oposicion.ALICANTE_CPBA,
      NivelOposicion.INICIACION,
      'FRANJA_CUATRO_A_SEIS_HORAS',
      'PCAI4-6H',
    ],
    [
      Oposicion.ALICANTE_CPBA,
      NivelOposicion.INICIACION,
      'FRANJA_SEIS_A_OCHO_HORAS',
      'PCAI6-8H',
    ],
    [
      Oposicion.ALICANTE_CPBA,
      NivelOposicion.AVANZADO,
      'FRANJA_CUATRO_A_SEIS_HORAS',
      'PCAA4-6H',
    ],
    [
      Oposicion.ALICANTE_CPBA,
      NivelOposicion.AVANZADO,
      'FRANJA_SEIS_A_OCHO_HORAS',
      'PCAA6-8H',
    ],
    [
      Oposicion.VALENCIA_AYUNTAMIENTO,
      NivelOposicion.INICIACION,
      'FRANJA_CUATRO_A_SEIS_HORAS',
      'PAVI4-6H',
    ],
    [
      Oposicion.VALENCIA_AYUNTAMIENTO,
      NivelOposicion.INICIACION,
      'FRANJA_SEIS_A_OCHO_HORAS',
      'PAVI6-8H',
    ],
    [
      Oposicion.VALENCIA_AYUNTAMIENTO,
      NivelOposicion.AVANZADO,
      'FRANJA_CUATRO_A_SEIS_HORAS',
      'PAVA4-6H',
    ],
    [
      Oposicion.VALENCIA_AYUNTAMIENTO,
      NivelOposicion.AVANZADO,
      'FRANJA_SEIS_A_OCHO_HORAS',
      'PAVA6-8H',
    ],
    [
      Oposicion.MADRID,
      NivelOposicion.INICIACION,
      'FRANJA_CUATRO_A_SEIS_HORAS',
      'PCMI4-6H',
    ],
    [
      Oposicion.MADRID,
      NivelOposicion.INICIACION,
      'FRANJA_SEIS_A_OCHO_HORAS',
      'PCMI6-8H',
    ],
    [
      Oposicion.MADRID,
      NivelOposicion.AVANZADO,
      'FRANJA_CUATRO_A_SEIS_HORAS',
      'PCMA4-6H',
    ],
    [
      Oposicion.MADRID,
      NivelOposicion.AVANZADO,
      'FRANJA_SEIS_A_OCHO_HORAS',
      'PCMA6-8H',
    ],
  ])(
    'calcula el código canónico %s/%s/%s',
    (oposicion, nivel, franja, codigo) => {
      component.nuevaVariante();
      component.varianteForm.patchValue({ oposicion, nivel, franja });

      expect(component.varianteForm.controls.codigo.value).toBe(codigo);
    },
  );

  it('muestra el código calculado como solo lectura en el formulario de alta', () => {
    const input = fixture.nativeElement.querySelector(
      '#variante-codigo',
    ) as HTMLInputElement;

    expect(input).toBeTruthy();
    expect(input.readOnly).toBe(true);
    expect(component.varianteForm.controls.codigo.enabled).toBe(true);
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
        estado: 'PUBLICADA',
        version: 1,
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
        estado: 'PUBLICADA',
        version: 1,
      } as PlanificacionMensual,
      {
        id: 2,
        identificador: 'GENERAL-6-8',
        mes: 8,
        ano: 2026,
        tipoDePlanificacion:
          TipoDePlanificacionDeseada.FRANJA_SEIS_A_OCHO_HORAS,
        relevancia: [Oposicion.GENERAL],
        estado: 'PUBLICADA',
        version: 1,
      } as PlanificacionMensual,
      {
        id: 3,
        identificador: 'MADRID-4-6',
        mes: 8,
        ano: 2026,
        tipoDePlanificacion:
          TipoDePlanificacionDeseada.FRANJA_CUATRO_A_SEIS_HORAS,
        relevancia: [Oposicion.MADRID],
        estado: 'PUBLICADA',
        version: 1,
      } as PlanificacionMensual,
    ]);
    component.varianteForm.patchValue({
      oposicion: Oposicion.GENERAL,
      franja: TipoDePlanificacionDeseada.FRANJA_CUATRO_A_SEIS_HORAS,
    });

    expect(component.planificacionOptions).toEqual([
      {
        label: 'GENERAL-4-6 v1 · PUBLICADA (8/2026)',
        value: 1,
        estado: 'PUBLICADA',
      },
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
        estado: 'PUBLICADA',
        version: 1,
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
        estado: 'PUBLICADA',
        version: 1,
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
      {
        label: 'GENERAL-4-6 v1 · PUBLICADA (8/2026)',
        value: 17,
        estado: 'PUBLICADA',
      },
    ]);
  });

  it('publica y asigna un borrador solo tras confirmación explícita', async () => {
    component.planificacionesMensuales.set([
      {
        id: 17,
        identificador: 'MADRID-4-6',
        mes: 9,
        ano: 2026,
        estado: 'BORRADOR',
        version: 2,
        tipoDePlanificacion:
          TipoDePlanificacionDeseada.FRANJA_CUATRO_A_SEIS_HORAS,
        relevancia: [Oposicion.MADRID],
      } as PlanificacionMensual,
    ]);
    component.editarVariante({
      id: 7,
      codigo: 'MI4-6',
      oposicion: Oposicion.MADRID,
      nivel: NivelOposicion.INICIACION,
      franja: TipoDePlanificacionDeseada.FRANJA_CUATRO_A_SEIS_HORAS,
      activa: false,
    });
    component.varianteForm.controls.planificacionMensualId.setValue(17);

    component.publicarPlanSeleccionado();

    expect(service.publicarVariante$).not.toHaveBeenCalled();
    const config = (confirmation.confirm as jest.Mock).mock.calls.at(-1)[0];
    await config.accept();
    expect(service.publicarVariante$).toHaveBeenCalledWith(7, 17);
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

  it('previsualiza el Excel sin aplicar y conserva el hash del servidor', async () => {
    const file = new File(['xlsx'], 'madrid.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    component.seleccionarArchivoImportacion({
      target: { files: [file], value: 'madrid.xlsx' },
    } as unknown as Event);

    await component.previsualizarImportacion();

    expect(service.previewImportacionPlantillas$).toHaveBeenCalledWith(file);
    expect(service.applyImportacionPlantillas$).not.toHaveBeenCalled();
    expect(component.previewImportacion()?.fileHash).toBe('a'.repeat(64));
    expect(component.puedeAplicarImportacion).toBe(true);
  });

  it('bloquea el apply con sobrescrituras hasta confirmar dos veces', async () => {
    const file = new File(['xlsx'], 'madrid.xlsx');
    component.archivoImportacion.set(file);
    component.previewImportacion.set({
      fileName: file.name,
      fileHash: 'a'.repeat(64),
      puedeAplicar: true,
      yaAplicado: false,
      requiereConfirmacionSobrescritura: true,
      sobrescrituras: ['S012026CMI6-8H'],
      totales: {
        hojas: 1,
        semanas: 1,
        bloques: 6,
        entrenamientos: 1,
        errores: 0,
      },
      hojas: [],
    });

    expect(component.puedeAplicarImportacion).toBe(false);
    component.confirmarAplicacionImportacion();
    expect(confirmation.confirm).not.toHaveBeenCalled();

    component.confirmarSobrescritura.set(true);
    component.confirmarAplicacionImportacion();
    expect(service.applyImportacionPlantillas$).not.toHaveBeenCalled();
    const config = (confirmation.confirm as jest.Mock).mock.calls[0][0];
    await config.accept();

    expect(service.applyImportacionPlantillas$).toHaveBeenCalledWith(
      file,
      'a'.repeat(64),
      true,
    );
    expect(component.previewImportacion()?.yaAplicado).toBe(true);
  });

  it('previsualiza el Excel completo y abre el borrador tras una única confirmación', async () => {
    const file = new File(['xlsx'], 'plan.xlsx');
    const variante = {
      codigo: 'PCMI4-6H',
      oposicion: Oposicion.MADRID,
      nivel: NivelOposicion.INICIACION,
      franja: TipoDePlanificacionDeseada.FRANJA_CUATRO_A_SEIS_HORAS,
      publicadaId: 9,
      destino: { tipo: 'COPIAR' as const },
      candidatos: [],
      planificacionId: 17,
      primeraSemana: '2026-10-05',
      semanas: [
        {
          hoja: 'CMI4-6H',
          numero: 40,
          lunes: '2026-10-05',
          creados: 6,
          actualizados: 0,
          eliminados: 0,
          omitidos: 0,
          bloques: [],
        },
      ],
    };
    (service.previewCargaSemanas$ as jest.Mock).mockReturnValue(
      of({
        puedeAplicar: true,
        previewHash: 'a'.repeat(64),
        requiereConfirmacion: false,
        variantes: [variante],
      }),
    );
    (service.applyCargaSemanas$ as jest.Mock).mockReturnValue(
      of({
        puedeAplicar: true,
        previewHash: 'a'.repeat(64),
        requiereConfirmacion: false,
        variantes: [variante],
      }),
    );
    component.archivoImportacion.set(file);
    await component.previsualizarCargaSemanas();
    fixture.detectChanges();
    expect(TestBed.inject(ToastrService).success).not.toHaveBeenCalled();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Previsualización: todavía no se ha guardado nada',
    );
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Guardar semanas en borrador',
    );
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Semana 40',
    );
    await component.guardarCargaSemanas();
    expect(service.applyCargaSemanas$).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledWith(
      ['/app/planificacion/planificacion-mensual', 17],
      { queryParams: { fechaFoco: '2026-10-05' } },
    );
  });

  it('explica el Excel sin semanas con contenido junto a la previsualización', () => {
    component.previewImportacion.set({
      fileName: 'vacio.xlsx',
      fileHash: 'a'.repeat(64),
      puedeAplicar: false,
      yaAplicado: false,
      requiereConfirmacionSobrescritura: false,
      sobrescrituras: [],
      totales: {
        hojas: 1,
        semanas: 1,
        bloques: 0,
        entrenamientos: 0,
        errores: 0,
      },
      hojas: [],
    });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'El Excel no contiene semanas con actividades',
    );
  });

  it('autoselecciona solo un borrador compatible y exige elegir cuando hay varios', () => {
    component.variantes.set([
      {
        codigo: 'MI4-6H',
        oposicion: Oposicion.MADRID,
        nivel: NivelOposicion.INICIACION,
        franja: TipoDePlanificacionDeseada.FRANJA_CUATRO_A_SEIS_HORAS,
        activa: true,
      },
    ]);
    component.codigoImportacionSeleccionado.set('CMI4-6H');
    const compatible = {
      id: 17,
      identificador: 'MADRID-BORRADOR-1',
      mes: 10,
      ano: 2026,
      estado: 'BORRADOR',
      relevancia: [Oposicion.MADRID],
      tipoDePlanificacion:
        TipoDePlanificacionDeseada.FRANJA_CUATRO_A_SEIS_HORAS,
    } as PlanificacionMensual;
    component.planificacionesMensuales.set([
      compatible,
      {
        ...compatible,
        id: 18,
        identificador: 'OTRA-FRANJA',
        tipoDePlanificacion:
          TipoDePlanificacionDeseada.FRANJA_SEIS_A_OCHO_HORAS,
      },
    ]);

    component.seleccionarCodigoImportacion('CMI4-6H');
    expect(
      component.planificacionesBorradorOptions.map((op) => op.value),
    ).toEqual([17]);
    expect(component.planificacionDestinoImportacion()).toBe(17);

    component.planificacionesMensuales.set([
      compatible,
      { ...compatible, id: 19, identificador: 'MADRID-BORRADOR-2' },
    ]);
    component.seleccionarCodigoImportacion('CMI4-6H');
    expect(component.planificacionDestinoImportacion()).toBeNull();

    component.planificacionesMensuales.set([]);
    component.seleccionarCodigoImportacion('CMI4-6H');
    expect(component.planificacionesBorradorOptions).toEqual([]);
    expect(component.planificacionDestinoImportacion()).toBeNull();
  });

  it('explica cada variante y no trata un estado desconocido como borrador', () => {
    component.codigosUltimaImportacion.set(['CMI6-8H', 'CBAA4-6H']);
    expect(component.codigosImportacionOptions()).toEqual([
      {
        label: 'Comunidad de Madrid · Iniciación · 6-8 horas',
        value: 'CMI6-8H',
      },
      {
        label: 'Consorcio de Alicante · Avanzado · 4-6 horas',
        value: 'CBAA4-6H',
      },
    ]);
    component.codigoImportacionSeleccionado.set('CMI6-8H');
    component.variantes.set([
      {
        codigo: 'PCMI6-8H',
        oposicion: Oposicion.MADRID,
        nivel: NivelOposicion.INICIACION,
        franja: TipoDePlanificacionDeseada.FRANJA_SEIS_A_OCHO_HORAS,
        activa: true,
      },
    ]);
    component.planificacionesMensuales.set([
      {
        id: 20,
        identificador: 'SIN-ESTADO',
        relevancia: [Oposicion.MADRID],
        tipoDePlanificacion:
          TipoDePlanificacionDeseada.FRANJA_SEIS_A_OCHO_HORAS,
      } as PlanificacionMensual,
    ]);
    expect(component.planificacionesBorradorOptions).toEqual([]);
  });

  it('abre la creación guiada conservando oposición, franja y contexto', () => {
    component.variantes.set([
      {
        codigo: 'MI4-6H',
        oposicion: Oposicion.MADRID,
        nivel: NivelOposicion.INICIACION,
        franja: TipoDePlanificacionDeseada.FRANJA_CUATRO_A_SEIS_HORAS,
        activa: true,
      },
    ]);
    component.codigosUltimaImportacion.set(['CMI4-6H', 'CMA4-6H']);
    component.codigoImportacionSeleccionado.set('CMI4-6H');

    component.crearBorradorParaImportacion();

    expect(router.navigate).toHaveBeenCalledWith(
      ['/app/planificacion/planificacion-mensual', 'new'],
      {
        queryParams: {
          origen: 'importacion-plantillas',
          codigosHoja: ['CMI4-6H', 'CMA4-6H'],
          codigoActivo: 'CMI4-6H',
          fechaFoco: null,
          oposicion: Oposicion.MADRID,
          franja: TipoDePlanificacionDeseada.FRANJA_CUATRO_A_SEIS_HORAS,
        },
      },
    );
  });

  it('normaliza el código de hoja de Sergio al sufijo de plantilla', async () => {
    const file = new File(['xlsx'], 'sergio.xlsx');
    component.archivoImportacion.set(file);
    component.previewImportacion.set({
      fileName: file.name,
      fileHash: 'c'.repeat(64),
      puedeAplicar: true,
      yaAplicado: false,
      requiereConfirmacionSobrescritura: false,
      sobrescrituras: [],
      totales: {
        hojas: 1,
        semanas: 1,
        bloques: 7,
        entrenamientos: 0,
        errores: 0,
      },
      hojas: [
        {
          hoja: 'GI6-8',
          valida: true,
          totalBloques: 7,
          totalEntrenamientos: 0,
          semanas: [
            {
              numero: 7,
              fechaInicio: '2026-02-09',
              bloques: 7,
              entrenamientos: 0,
              esqueleto: false,
            },
          ],
          errores: [],
          warnings: [],
        },
      ],
    });

    component.confirmarAplicacionImportacion();
    const config = (confirmation.confirm as jest.Mock).mock.calls.at(-1)[0];
    await config.accept();

    expect(component.codigosUltimaImportacion()).toEqual(['GI6-8H']);
  });

  it('separa el prefijo de plantilla del código canónico de variante', async () => {
    const file = new File(['xlsx'], 'madrid.xlsx');
    component.archivoImportacion.set(file);
    component.previewImportacion.set({
      fileName: file.name,
      fileHash: 'e'.repeat(64),
      puedeAplicar: true,
      yaAplicado: false,
      requiereConfirmacionSobrescritura: false,
      sobrescrituras: [],
      totales: {
        hojas: 1,
        semanas: 1,
        bloques: 1,
        entrenamientos: 0,
        errores: 0,
      },
      hojas: [
        {
          hoja: 'CMI6-8',
          valida: true,
          variante: {
            codigo: 'PCMI6-8H',
            oposicion: Oposicion.MADRID,
            nivel: NivelOposicion.INICIACION,
            franja: TipoDePlanificacionDeseada.FRANJA_SEIS_A_OCHO_HORAS,
          },
          totalBloques: 1,
          totalEntrenamientos: 0,
          semanas: [
            {
              numero: 1,
              fechaInicio: '2026-02-09',
              bloques: 1,
              entrenamientos: 0,
              esqueleto: false,
            },
          ],
          errores: [],
          warnings: [],
        },
      ],
    });

    component.confirmarAplicacionImportacion();
    const config = (confirmation.confirm as jest.Mock).mock.calls.at(-1)[0];
    await config.accept();

    expect(component.codigosUltimaImportacion()).toEqual(['CMI6-8H']);
    expect(component.varianteImportacionSeleccionada?.codigo).toBe('PCMI6-8H');
  });

  it('normaliza y deduplica los códigos válidos de hoja antes del volcado', async () => {
    const file = new File(['xlsx'], 'variantes.xlsx');
    component.archivoImportacion.set(file);
    const hoja = (codigo: string) => ({
      hoja: codigo,
      valida: true,
      totalBloques: 1,
      totalEntrenamientos: 0,
      semanas: [
        {
          numero: 1,
          fechaInicio: '2026-02-09',
          bloques: 1,
          entrenamientos: 0,
          esqueleto: false,
        },
      ],
      errores: [],
      warnings: [],
    });
    component.previewImportacion.set({
      fileName: file.name,
      fileHash: 'd'.repeat(64),
      puedeAplicar: true,
      yaAplicado: false,
      requiereConfirmacionSobrescritura: false,
      sobrescrituras: [],
      totales: {
        hojas: 5,
        semanas: 5,
        bloques: 5,
        entrenamientos: 0,
        errores: 0,
      },
      hojas: [
        hoja('GI6-8'),
        hoja('GI6-8H'),
        hoja('H6-8'),
        hoja('14-6'),
        hoja('URG'),
      ],
    });

    component.confirmarAplicacionImportacion();
    const config = (confirmation.confirm as jest.Mock).mock.calls.at(-1)[0];
    await config.accept();

    expect(component.codigosUltimaImportacion()).toEqual([
      'GI6-8H',
      'H6-8',
      '14-6',
      'URG',
    ]);
  });

  it('resuelve la identidad de hoja sin depender del código de variante', () => {
    const identidad = identidadVarianteImportada;

    expect(identidad(' cmi6-8h ')).toEqual({
      oposicion: Oposicion.MADRID,
      nivel: NivelOposicion.INICIACION,
      franja: TipoDePlanificacionDeseada.FRANJA_SEIS_A_OCHO_HORAS,
    });
    expect(identidad('CAI4-6')).toEqual({
      oposicion: Oposicion.ALICANTE_CPBA,
      nivel: NivelOposicion.INICIACION,
      franja: TipoDePlanificacionDeseada.FRANJA_CUATRO_A_SEIS_HORAS,
    });
    expect(identidad('H6-8')).toBeNull();
    expect(identidad(null)).toBeNull();
  });

  it('normaliza aliases de hoja a la identidad real de las plantillas', () => {
    const normalizar = codigoPlantillaImportada;

    expect(normalizar('CAI6-8')).toBe('CBAI6-8H');
    expect(normalizar('AVI4-6H')).toBe('AYVI4-6H');
    expect(normalizar('CMI6-8')).toBe('CMI6-8H');
  });
});
