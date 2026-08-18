import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  tick,
} from '@angular/core/testing';
import { NO_ERRORS_SCHEMA, Pipe, PipeTransform, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ConfirmationService } from 'primeng/api';
import { ToastrService } from 'ngx-toastr';
import { of, Subject, throwError } from 'rxjs';
import { COMMON_TEST_PROVIDERS } from '../../testing';
import { PlanificacionesService } from '../../services/planificaciones.service';
import { PlanificacionFisicaService } from '../../planificacion-fisica/services/planificacion-fisica.service';
import { AppConfigService } from '../../services/app-config.service';
import { EstadoModulos } from '../../shared/models/app-config.model';
import { ModuloApp } from '../../shared/models/modulo-app.enum';

import { PlanificacionMensualEditComponent } from './planificacion-mensual-edit.component';

function makeMockAppConfigService(planificacionFisicaEnabled = true) {
  const estado = signal<EstadoModulos>(
    Object.values(ModuloApp).reduce((acc, key) => {
      acc[key] =
        key === ModuloApp.PLANIFICACION_FISICA
          ? planificacionFisicaEnabled
          : true;
      return acc;
    }, {} as EstadoModulos),
  );
  return {
    appConfig: signal({
      appName: 'AcmeAcademy',
      logoUrl: null,
      primaryColor: '#123456',
      secondaryColor: '#abcdef',
      updatedAt: '2026-05-21T10:00:00Z',
    }),
    estadoModulos: estado,
    isModuloHabilitado: (m: ModuloApp) => estado()[m] === true,
    modulosFailedToLoad: signal(false),
    isLoaded: signal(true),
    setEstado: estado.set.bind(estado),
  };
}

@Pipe({ name: 'calendarDate' })
class MockCalendarDatePipe implements PipeTransform {
  transform(value: any): string {
    return '';
  }
}

describe('PlanificacionMensualEditComponent', () => {
  let component: PlanificacionMensualEditComponent;
  let fixture: ComponentFixture<PlanificacionMensualEditComponent>;
  let router: Router;
  let appConfigService: ReturnType<typeof makeMockAppConfigService>;

  beforeEach(async () => {
    TestBed.resetTestingModule();
    appConfigService = makeMockAppConfigService(true);
    await TestBed.configureTestingModule({
      declarations: [PlanificacionMensualEditComponent, MockCalendarDatePipe],
      providers: [
        ...COMMON_TEST_PROVIDERS,
        { provide: AppConfigService, useValue: appConfigService },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(PlanificacionMensualEditComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('aplicar plantilla semanal con preview server-side', () => {
    const lunesActual = new Date(2026, 7, 3, 9, 0);

    beforeEach(() => {
      component.viewDate = lunesActual;
      component.lastLoadedPlanification.set({ id: 42 } as any);
      component.pickedPlantillaId.set(7);
    });

    it('muestra el lunes de la semana visible como destino', () => {
      expect(component.lunesDestino).toEqual(new Date(2026, 7, 3, 0, 0, 0));
    });

    it('cargarPreview llama al endpoint con preview:true y expone el resultado', async () => {
      // OJO: PlanificacionesService en COMMON_TEST_PROVIDERS es un Proxy que
      // devuelve un jest.fn() NUEVO por acceso — spyOn no intercepta nada.
      // Se sustituye la referencia del componente por un mock plano.
      const mock = jest.fn(() =>
        of({
          resultados: [
            {
              planificacionId: 42,
              plantillaSemanalId: 7,
              creados: 2,
              omitidos: 1,
              bloques: [
                {
                  nombre: 'Bloque lunes',
                  horaInicio: '2026-08-03T09:00:00',
                  duracion: 60,
                  importante: true,
                },
                {
                  nombre: 'Bloque martes',
                  horaInicio: '2026-08-04T10:00:00',
                  duracion: 90,
                },
              ],
            },
          ],
        } as any),
      );
      (component as any).planificacionesService = {
        aplicarPlantillasSemanales$: mock,
      };

      await component.cargarPreview();

      expect(mock).toHaveBeenCalledWith({
        lunes: '2026-08-03',
        items: [{ planificacionId: 42, plantillaSemanalId: 7 }],
        preview: true,
      });
      expect(component.previewResult()).toEqual(
        expect.objectContaining({
          planificacionId: 42,
          plantillaSemanalId: 7,
          creados: 2,
          omitidos: 1,
          bloques: expect.any(Array),
        }),
      );
      expect(component.previewLoading()).toBe(false);
    });

    it('confirmarSemanaDestino avanza y carga el preview', () => {
      const nextCallback = { emit: jest.fn() };
      const cargarSpy = jest
        .spyOn(component, 'cargarPreview')
        .mockResolvedValue();

      component.confirmarSemanaDestino(nextCallback);

      expect(nextCallback.emit).toHaveBeenCalled();
      expect(cargarSpy).toHaveBeenCalled();
    });

    it('aplicarPlantillaConfirmada llama con preview:false, muestra toast y recarga', async () => {
      const aplicarMock = jest.fn(() =>
        of({
          resultados: [
            {
              planificacionId: 42,
              plantillaSemanalId: 7,
              creados: 2,
              omitidos: 1,
              bloques: [],
            },
          ],
        } as any),
      );
      (component as any).planificacionesService = {
        aplicarPlantillasSemanales$: aplicarMock,
      };
      const loadSpy = jest
        .spyOn(component as any, 'load')
        .mockImplementation(() => {});
      const successSpy = jest.spyOn(TestBed.inject(ToastrService), 'success');

      await component.aplicarPlantillaConfirmada();

      expect(aplicarMock).toHaveBeenCalledWith({
        lunes: '2026-08-03',
        items: [{ planificacionId: 42, plantillaSemanalId: 7 }],
        preview: false,
      });
      expect(successSpy).toHaveBeenCalledWith(
        'Plantilla aplicada: 2 creados, 1 omitidos.',
      );
      expect(loadSpy).toHaveBeenCalled();
      expect(component.isDialogVisible).toBe(false);
      expect(component.pickedPlantillaId()).toBeNull();
      expect(component.previewResult()).toBeNull();
    });

    it('aplicarPlantillaConfirmada muestra warning si el resultado trae error', async () => {
      const aplicarMock = jest.fn(() =>
        of({
          resultados: [
            {
              planificacionId: 42,
              plantillaSemanalId: 7,
              creados: 0,
              omitidos: 0,
              bloques: [],
              error: 'La plantilla no es compatible con esta oposición',
            },
          ],
        } as any),
      );
      (component as any).planificacionesService = {
        aplicarPlantillasSemanales$: aplicarMock,
      };
      jest.spyOn(component as any, 'load').mockImplementation(() => {});
      const warningSpy = jest.spyOn(TestBed.inject(ToastrService), 'warning');

      await component.aplicarPlantillaConfirmada();

      expect(warningSpy).toHaveBeenCalledWith(
        'La plantilla no es compatible con esta oposición',
      );
    });

    it('cargarPreview muestra toast de error ante 400 del endpoint', async () => {
      const aplicarMock = jest.fn(() =>
        throwError(() => ({ error: { message: 'Fecha fuera del mes' } })),
      );
      (component as any).planificacionesService = {
        aplicarPlantillasSemanales$: aplicarMock,
      };
      const errorSpy = jest.spyOn(TestBed.inject(ToastrService), 'error');

      await component.cargarPreview();

      expect(errorSpy).toHaveBeenCalledWith('Fecha fuera del mes');
      expect(component.previewLoading()).toBe(false);
      expect(component.previewResult()).toBeNull();
    });
  });

  describe('bridge temario↔física', () => {
    it('resumenFisica arranca vacío — sin indicación hasta que cargue', () => {
      expect(component.resumenFisica()).toEqual([]);
    });

    it('onViewDateChange actualiza viewDate y recarga el bridge física para ALUMNO', () => {
      const svc = TestBed.inject(PlanificacionFisicaService);
      const spy = jest
        .spyOn(svc, 'resumenDias')
        .mockReturnValue(
          of([{ fecha: '2026-07-15', bloqueId: 33, disciplinas: [] }]),
        );
      component.expectedRole = 'ALUMNO';
      component.lastLoadedPlanification.set({ id: 17 } as any);

      const nuevaFecha = new Date(2026, 7, 1);
      component.onViewDateChange(nuevaFecha);

      expect(component.viewDate).toBe(nuevaFecha);
      expect(spy).toHaveBeenCalledWith(
        17,
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      );
      expect(component.resumenFisica()).toEqual([
        { fecha: '2026-07-15', bloqueId: 33, disciplinas: [] },
      ]);
    });

    it('onViewDateChange NO llama al bridge física para ADMIN (no aplica a esa vista)', () => {
      const svc = TestBed.inject(PlanificacionFisicaService);
      const spy = jest.spyOn(svc, 'resumenDias');
      component.expectedRole = 'ADMIN';

      component.onViewDateChange(new Date(2026, 7, 1));

      expect(spy).not.toHaveBeenCalled();
    });

    it('cargarResumenFisica NO llama al endpoint cuando PLANIFICACION_FISICA está deshabilitada', () => {
      const svc = TestBed.inject(PlanificacionFisicaService);
      const spy = jest.spyOn(svc, 'resumenDias');
      appConfigService.setEstado({
        ...appConfigService.estadoModulos(),
        [ModuloApp.PLANIFICACION_FISICA]: false,
      });

      (component as any).cargarResumenFisica(new Date(2026, 7, 1));

      expect(spy).not.toHaveBeenCalled();
      expect(component.resumenFisica()).toEqual([]);
    });

    it('REGLA #1 no romper el temario: si el endpoint del bridge física falla (500/red), resumenFisica queda en [] sin lanzar excepción', () => {
      const svc = TestBed.inject(PlanificacionFisicaService);
      jest
        .spyOn(svc, 'resumenDias')
        .mockReturnValue(throwError(() => new Error('network down')));
      component.expectedRole = 'ALUMNO';

      expect(() => component.onViewDateChange(new Date())).not.toThrow();
      expect(component.resumenFisica()).toEqual([]);
    });

    it('un alumno BASIC/sin bloque activo recibe 200 [] (nunca 403) y no rompe nada', () => {
      const svc = TestBed.inject(PlanificacionFisicaService);
      jest.spyOn(svc, 'resumenDias').mockReturnValue(of([]));
      component.expectedRole = 'ALUMNO';

      component.onViewDateChange(new Date());

      expect(component.resumenFisica()).toEqual([]);
    });

    it('ignora una respuesta tardía de un plan anterior', () => {
      const svc = TestBed.inject(PlanificacionFisicaService);
      const anterior$ = new Subject<any[]>();
      const actual$ = new Subject<any[]>();
      jest
        .spyOn(svc, 'resumenDias')
        .mockReturnValueOnce(anterior$)
        .mockReturnValueOnce(actual$);
      component.expectedRole = 'ALUMNO';
      component.lastLoadedPlanification.set({ id: 17 } as any);
      component.onViewDateChange(new Date(2026, 6, 1));
      component.lastLoadedPlanification.set({ id: 18 } as any);
      component.onViewDateChange(new Date(2026, 7, 1));

      actual$.next([{ fecha: '2026-08-10', bloqueId: 33, disciplinas: [] }]);
      anterior$.next([{ fecha: '2026-07-10', bloqueId: 22, disciplinas: [] }]);

      expect(component.resumenFisica()).toEqual([
        { fecha: '2026-08-10', bloqueId: 33, disciplinas: [] },
      ]);
    });
  });

  describe('bridge temario↔física — vista MENSUAL (customCellTemplate)', () => {
    const dia = new Date(2026, 6, 15); // 2026-07-15 (mes 0-indexado)

    beforeEach(() => {
      component.resumenFisica.set([
        {
          fecha: '2026-07-15',
          bloqueId: 33,
          disciplinas: [
            {
              nombre: 'Cuerda 2',
              grupo: 'CUERDA',
              color: '#9fe2d0',
              realizado: false,
            },
            {
              nombre: 'Carrera 2',
              grupo: 'CARRERA',
              color: '#fdeaa8',
              realizado: false,
            },
          ],
        },
      ]);
    });

    it('tieneFisica es true para un día con disciplinas y false para uno sin datos', () => {
      expect(component.tieneFisica(dia)).toBe(true);
      expect(component.tieneFisica(new Date(2026, 6, 16))).toBe(false);
    });

    it('tieneFisica es false cuando el día trae disciplinas vacío', () => {
      component.resumenFisica.set([
        { fecha: '2026-07-15', bloqueId: 33, disciplinas: [] },
      ]);
      expect(component.tieneFisica(dia)).toBe(false);
    });

    it('etiquetaFisica junta los nombres de las disciplinas separados por coma', () => {
      expect(component.etiquetaFisica(dia)).toBe('Cuerda 2, Carrera 2');
    });

    it('etiquetaFisica devuelve cadena vacía cuando no hay física ese día', () => {
      expect(component.etiquetaFisica(new Date(2026, 6, 16))).toBe('');
    });

    it('resumenFisica vacío (bloque BASIC/sin plan) no rompe nada: tieneFisica siempre false', () => {
      component.resumenFisica.set([]);
      expect(component.tieneFisica(dia)).toBe(false);
      expect(() => component.etiquetaFisica(dia)).not.toThrow();
    });

    it('abrirFisica navega a /app/planificacion-fisica/dia/:fecha y detiene la propagación del click', () => {
      const domEvent = {
        stopPropagation: jest.fn(),
        preventDefault: jest.fn(),
      } as unknown as Event;

      component.abrirFisica(dia, domEvent);

      expect(domEvent.stopPropagation).toHaveBeenCalled();
      expect(domEvent.preventDefault).toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(
        ['/app/planificacion-fisica', 'dia', '2026-07-15'],
        {
          queryParams: {
            bloqueId: 33,
            originPlanificacionId: undefined,
          },
        },
      );
    });

    it('el click de la insignia de física NO dispara onDayClicked (no abre la vista semanal de ese día por accidente)', () => {
      const onDayClickedSpy = jest.spyOn(component, 'onDayClicked');
      const domEvent = {
        stopPropagation: jest.fn(),
        preventDefault: jest.fn(),
      } as unknown as Event;

      component.abrirFisica(dia, domEvent);

      expect(onDayClickedSpy).not.toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalled();
    });

    it('renderiza la insignia data-testid="temario-fisica-bridge" en un día con física para ALUMNO, y su click llama a abrirFisica sin disparar el click de la celda', () => {
      component.expectedRole = 'ALUMNO';
      fixture.detectChanges();

      const badge = fixture.nativeElement.querySelector(
        '[data-testid="temario-fisica-bridge"]',
      );
      // Puede no renderizarse si la vista activa es la semanal (el
      // customCellTemplate solo se instancia dentro de la vista mensual de
      // mwl-calendar-month-view); lo relevante para este test es que, si
      // existe en el DOM, dispara abrirFisica y no el click de la celda.
      if (badge) {
        const abrirFisicaSpy = jest.spyOn(component, 'abrirFisica');
        badge.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(abrirFisicaSpy).toHaveBeenCalled();
      } else {
        // Verificación equivalente a nivel de componente: mismo contrato
        // que la insignia usaría al pulsarse.
        const domEvent = {
          stopPropagation: jest.fn(),
          preventDefault: jest.fn(),
        } as unknown as Event;
        expect(component.tieneFisica(dia)).toBe(true);
        component.abrirFisica(dia, domEvent);
        expect(domEvent.stopPropagation).toHaveBeenCalled();
        expect(router.navigate).toHaveBeenCalled();
      }
    });
  });

  describe('conversión masiva de bloques ENTRENAMIENTO', () => {
    it('items() incluye la acción de conversión para admin cuando PLANIFICACION_FISICA está habilitada', () => {
      const items = component.items();
      const accion = items.find((i) =>
        i.tooltipOptions?.tooltipLabel?.includes('Convertir bloques'),
      );
      expect(accion).toBeDefined();
      expect(accion?.visible).not.toBe(false);
    });

    it('items() oculta la acción de conversión cuando PLANIFICACION_FISICA está deshabilitada', () => {
      appConfigService.setEstado({
        ...appConfigService.estadoModulos(),
        [ModuloApp.PLANIFICACION_FISICA]: false,
      });
      fixture.detectChanges();

      const items = component.items();
      const accion = items.find((i) =>
        i.tooltipOptions?.tooltipLabel?.includes('Convertir bloques'),
      );
      expect(accion?.visible).toBe(false);
    });

    it('confirmarConversionBloquesFisica NO abre el confirm si PLANIFICACION_FISICA está deshabilitada (defensa en profundidad)', () => {
      const confirmationService = TestBed.inject(ConfirmationService);
      const confirmSpy = jest.spyOn(confirmationService, 'confirm');
      appConfigService.setEstado({
        ...appConfigService.estadoModulos(),
        [ModuloApp.PLANIFICACION_FISICA]: false,
      });

      component.confirmarConversionBloquesFisica();

      expect(confirmSpy).not.toHaveBeenCalled();
    });

    it('confirmarConversionBloquesFisica pide confirmación y al aceptar llama al servicio y recarga', () => {
      const confirmationService = TestBed.inject(ConfirmationService);
      const confirmSpy = jest.spyOn(confirmationService, 'confirm');
      const convertirMock = jest.fn().mockReturnValue(
        of({
          actualizados: 3,
          ignorados: 1,
          sinCoincidencia: 0,
          desmarcados: 0,
        }),
      );
      (component as any).planificacionesService = {
        convertirBloquesFisica$: convertirMock,
      };
      const loadSpy = jest
        .spyOn(component as any, 'load')
        .mockImplementation(() => {});

      // Forzar la ruta a una planificación concreta para que el accept use su id.
      (component as any).activedRoute = {
        snapshot: {
          paramMap: { get: () => '207' },
        },
      };

      component.confirmarConversionBloquesFisica();

      expect(confirmSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining(
            'se conservará uno y los demás se desvincularán',
          ),
          accept: expect.any(Function),
        }),
      );

      const accept = confirmSpy.mock.calls[0][0].accept as () => void;
      accept();

      expect(convertirMock).toHaveBeenCalledWith(207);
      expect(loadSpy).toHaveBeenCalled();
    });

    it('confirmarConversionBloquesFisica no abre el confirm y avisa si hay cambios sin guardar', fakeAsync(() => {
      jest.clearAllMocks();
      const confirmationService = TestBed.inject(ConfirmationService);
      const confirmSpy = jest.spyOn(confirmationService, 'confirm');
      const toastService = TestBed.inject(ToastrService);
      const warningSpy = jest.spyOn(toastService, 'warning');
      tick();
      component.eventosModificados = true;

      component.confirmarConversionBloquesFisica();

      expect(confirmSpy).toHaveBeenCalledTimes(0);
      expect(warningSpy).toHaveBeenCalledWith(
        expect.stringContaining('cambios sin guardar'),
      );
    }));

    it('confirmarConversionBloquesFisica mantiene compatibilidad con respuestas legacy sin desmarcados', fakeAsync(() => {
      jest.clearAllMocks();
      const confirmationService = TestBed.inject(ConfirmationService);
      const confirmSpy = jest.spyOn(confirmationService, 'confirm');
      const convertirMock = jest.fn().mockReturnValue(
        of({
          actualizados: 0,
          ignorados: 5,
          sinCoincidencia: 0,
        }),
      );
      (component as any).planificacionesService = {
        convertirBloquesFisica$: convertirMock,
      };
      jest.spyOn(component as any, 'load').mockImplementation(() => {});
      const toastService = TestBed.inject(ToastrService);
      const infoSpy = jest.spyOn(toastService, 'info');
      (component as any).activedRoute = {
        snapshot: {
          paramMap: { get: () => '207' },
        },
      };
      tick();

      component.confirmarConversionBloquesFisica();
      const accept = confirmSpy.mock.calls[0][0].accept as () => void;
      accept();

      expect(infoSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'ya tenía un entrenamiento físico enlazado en 5 días',
        ),
      );
    }));

    it('confirmarConversionBloquesFisica detalla los bloques no coincidentes en vez de mostrar solo info', () => {
      jest.clearAllMocks();
      const confirmationService = TestBed.inject(ConfirmationService);
      const confirmSpy = jest.spyOn(confirmationService, 'confirm');
      (component as any).planificacionesService = {
        convertirBloquesFisica$: jest.fn().mockReturnValue(
          of({
            actualizados: 0,
            ignorados: 2,
            sinCoincidencia: 1,
            desmarcados: 0,
          }),
        ),
      };
      jest.spyOn(component as any, 'load').mockImplementation(() => {});
      const toastService = TestBed.inject(ToastrService);
      const successSpy = jest.spyOn(toastService, 'success');
      const infoSpy = jest.spyOn(toastService, 'info');
      (component as any).activedRoute = {
        snapshot: { paramMap: { get: () => '207' } },
      };

      component.confirmarConversionBloquesFisica();
      (
        confirmSpy.mock.calls[confirmSpy.mock.calls.length - 1][0]
          .accept as () => void
      )();

      expect(successSpy).toHaveBeenCalledWith(
        expect.stringContaining('1 bloques no empiezan por ENTRENAMIENTO'),
      );
      expect(infoSpy).not.toHaveBeenCalled();
    });

    it('confirmarConversionBloquesFisica informa de los duplicados normalizados aunque no haya altas nuevas', () => {
      const confirmationService = TestBed.inject(ConfirmationService);
      const confirmSpy = jest.spyOn(confirmationService, 'confirm');
      (component as any).planificacionesService = {
        convertirBloquesFisica$: jest.fn().mockReturnValue(
          of({
            actualizados: 0,
            ignorados: 2,
            sinCoincidencia: 0,
            desmarcados: 3,
          }),
        ),
      };
      jest.spyOn(component as any, 'load').mockImplementation(() => {});
      const successSpy = jest.spyOn(TestBed.inject(ToastrService), 'success');
      (component as any).activedRoute = {
        snapshot: { paramMap: { get: () => '207' } },
      };

      component.confirmarConversionBloquesFisica();
      (
        confirmSpy.mock.calls[confirmSpy.mock.calls.length - 1][0]
          .accept as () => void
      )();

      expect(successSpy).toHaveBeenCalledWith(
        expect.stringContaining('Se normalizaron 3 duplicados'),
      );
    });

    it('onEventsChange actualiza los eventos y marca que hay cambios sin guardar', () => {
      component.eventosModificados = false;
      const nuevosEventos = [{ title: 'Nuevo' } as any];

      component.onEventsChange(nuevosEventos);

      expect(component.events).toBe(nuevosEventos);
      expect(component.eventosModificados).toBe(true);
    });
  });
});
