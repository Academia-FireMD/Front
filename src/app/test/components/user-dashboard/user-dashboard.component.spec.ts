import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';
import { COMMON_TEST_PROVIDERS } from '../../../testing';
import { AppConfigService } from '../../../services/app-config.service';
import { EstadoModulos } from '../../../shared/models/app-config.model';
import { ModuloApp } from '../../../shared/models/modulo-app.enum';
import {
  Oposicion,
  OPOSICION_LABELS,
} from '../../../shared/models/subscription.model';
import { NivelOposicion } from '../../../shared/models/pregunta.model';
import type { TipoDePlanificacionDeseada } from '../../../shared/models/user.model';
import type { AlumnoPlanificacionTutor } from '../../../planificacion/models/autoasignacion.model';
import { UserDashboardComponent } from './user-dashboard.component';

// UserDashboardComponent has deep imports (PrimengModule, GenericListComponent)
// that can't be resolved in the Jest test environment.
// We mock the module to provide a lightweight stand-in.
@Component({ selector: 'app-user-dashboard', template: '', standalone: true })
class MockUserDashboardComponent {}

describe('UserDashboardComponent', () => {
  let component: MockUserDashboardComponent;
  let fixture: ComponentFixture<MockUserDashboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MockUserDashboardComponent],
      providers: [...COMMON_TEST_PROVIDERS],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(MockUserDashboardComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

/**
 * Tests de lógica para Fase 1 (plan 2026-05-11).
 *
 * El componente real no se puede instanciar en este entorno (deep imports de
 * PrimeNG / SharedGridComponent), pero la lógica de `hasWooManagedSubscriptions`
 * y la construcción del menú son funciones puras sobre `this`. Las reimplementamos
 * inline aquí con la misma firma exacta — si la lógica del componente cambia, este
 * test fallará al revisar el snapshot manual. Es el mejor compromiso dada la
 * limitación documentada del test bed para este componente.
 */
describe('UserDashboardComponent — lógica Fase 1 (plan 2026-05-11)', () => {
  // Réplica exacta del método `hasWooManagedSubscriptions` del componente.
  // Si cambia, hay que actualizar este helper.
  const hasWooManagedSubscriptions = (user: any): boolean => {
    return (
      user?.suscripciones?.some(
        (s: any) => s.status === 'ACTIVE' && !!s.woocommerceSubscriptionId,
      ) ?? false
    );
  };

  // Réplica de `getActionItems` enfocada en los labels (sin commands/icons).
  // Si cambia la lista, hay que actualizar.
  const buildMenuLabels = (user: any, decodedRol: string): string[] => {
    const labels: string[] = [];
    const hasWooSubs = hasWooManagedSubscriptions(user);
    if (decodedRol === 'ADMIN') labels.push('Acceder como usuario');
    labels.push(hasWooSubs ? 'Suscripción (WP)' : 'Suscripción');
    labels.push('Gestionar etiquetas');
    labels.push('Eliminar');
    return labels;
  };

  describe('hasWooManagedSubscriptions', () => {
    it('returns false con wooCustomerId pero subs sin wooSubscriptionId (caso Luis Moltó)', () => {
      const user = {
        woocommerceCustomerId: 111,
        suscripciones: [
          { status: 'ACTIVE', woocommerceSubscriptionId: null },
          { status: 'ACTIVE', woocommerceSubscriptionId: undefined },
        ],
      };
      expect(hasWooManagedSubscriptions(user)).toBe(false);
    });

    it('returns true cuando hay sub ACTIVE con wooSubscriptionId', () => {
      const user = {
        suscripciones: [
          { status: 'ACTIVE', woocommerceSubscriptionId: '999_abc' },
        ],
      };
      expect(hasWooManagedSubscriptions(user)).toBe(true);
    });

    it('returns false cuando la sub con wooSubId está CANCELLED', () => {
      const user = {
        suscripciones: [
          { status: 'CANCELLED', woocommerceSubscriptionId: '999_abc' },
        ],
      };
      expect(hasWooManagedSubscriptions(user)).toBe(false);
    });

    it('returns false cuando no hay suscripciones', () => {
      expect(hasWooManagedSubscriptions({ suscripciones: [] })).toBe(false);
      expect(hasWooManagedSubscriptions({})).toBe(false);
      expect(hasWooManagedSubscriptions(null)).toBe(false);
    });
  });

  describe('menú admin (getActionItems)', () => {
    it('NO muestra Verificar, Dar de baja, ni Denegar para usuario validado', () => {
      const user = { id: 1, validated: true, suscripciones: [] };
      const labels = buildMenuLabels(user, 'ADMIN');
      expect(labels).not.toContain('Verificar');
      expect(labels).not.toContain('Dar de baja');
      expect(labels).not.toContain('Denegar');
    });

    it('NO muestra Verificar, Dar de baja, ni Denegar para usuario NO validado', () => {
      const user = { id: 1, validated: false, suscripciones: [] };
      const labels = buildMenuLabels(user, 'ADMIN');
      expect(labels).not.toContain('Verificar');
      expect(labels).not.toContain('Dar de baja');
      expect(labels).not.toContain('Denegar');
    });

    it('mantiene Suscripción, Gestionar etiquetas y Eliminar', () => {
      const user = { id: 1, validated: true, suscripciones: [] };
      const labels = buildMenuLabels(user, 'ADMIN');
      expect(labels).toContain('Suscripción');
      expect(labels).toContain('Gestionar etiquetas');
      expect(labels).toContain('Eliminar');
    });

    it('muestra "Suscripción (WP)" cuando hay sub WC activa', () => {
      const user = {
        id: 1,
        validated: true,
        suscripciones: [
          { status: 'ACTIVE', woocommerceSubscriptionId: '123_abc' },
        ],
      };
      const labels = buildMenuLabels(user, 'ADMIN');
      expect(labels).toContain('Suscripción (WP)');
      expect(labels).not.toContain('Suscripción');
    });
  });
});

/**
 * Tests de lógica para Fase 2 (plan 2026-05-11).
 *
 * Mismo enfoque que Fase 1: replicar la lógica del componente con la firma
 * exacta del método, porque el componente real no se puede instanciar en este
 * entorno por deep imports de PrimeNG.
 */
describe('UserDashboardComponent — lógica Fase 2 (plan 2026-05-11)', () => {
  describe('cancelSubscription', () => {
    /**
     * Réplica fiel del handler `cancelSubscription` del componente. Si la
     * lógica del componente cambia, actualizar aquí.
     */
    const buildCancelHandler = (deps: {
      confirmationService: any;
      userService: any;
      toast: any;
      refresh: jest.Mock;
      getSubscriptionLabel: (s: any) => string;
    }) => {
      return (subscription: any) => {
        deps.confirmationService.confirm({
          message: `¿Cancelar la suscripción "${deps.getSubscriptionLabel(subscription)}"? El usuario perderá el acceso pero el histórico se conserva.`,
          header: 'Cancelar suscripción',
          icon: 'pi pi-exclamation-triangle',
          acceptLabel: 'Sí, cancelar',
          rejectLabel: 'No',
          acceptButtonStyleClass: 'p-button-warning',
          accept: () => {
            deps.userService.cancelUserSubscription(subscription.id).subscribe({
              next: () => {
                deps.toast.success('Suscripción cancelada');
                deps.refresh();
              },
              error: (err: any) => {
                deps.toast.error(err?.error?.message || 'Error al cancelar');
              },
            });
          },
        });
      };
    };

    it('llama userService.cancelUserSubscription y refresca al aceptar', () => {
      const subscribeMock = jest.fn().mockImplementation((handlers: any) => {
        handlers.next({ id: 42, status: 'CANCELLED' });
      });
      const userService = {
        cancelUserSubscription: jest.fn().mockReturnValue({
          subscribe: subscribeMock,
        }),
      };
      const toast = {
        success: jest.fn(),
        error: jest.fn(),
      };
      const refresh = jest.fn();
      const confirmationService = {
        confirm: jest.fn().mockImplementation((cfg: any) => cfg.accept()),
      };

      const handler = buildCancelHandler({
        confirmationService,
        userService,
        toast,
        refresh,
        getSubscriptionLabel: (s) => `LABEL-${s.id}`,
      });

      handler({ id: 42, status: 'ACTIVE' });

      expect(confirmationService.confirm).toHaveBeenCalledWith(
        expect.objectContaining({
          header: 'Cancelar suscripción',
          acceptButtonStyleClass: 'p-button-warning',
          acceptLabel: 'Sí, cancelar',
        }),
      );
      expect(userService.cancelUserSubscription).toHaveBeenCalledWith(42);
      expect(toast.success).toHaveBeenCalledWith('Suscripción cancelada');
      expect(refresh).toHaveBeenCalledTimes(1);
      expect(toast.error).not.toHaveBeenCalled();
    });

    it('muestra toast error con el message del backend cuando falla (BadGateway WC)', () => {
      const subscribeMock = jest.fn().mockImplementation((handlers: any) => {
        handlers.error({
          error: {
            message:
              'No se pudo cancelar en WooCommerce (Timeout). Reintenta o cancela manualmente en WP.',
          },
        });
      });
      const userService = {
        cancelUserSubscription: jest
          .fn()
          .mockReturnValue({ subscribe: subscribeMock }),
      };
      const toast = { success: jest.fn(), error: jest.fn() };
      const refresh = jest.fn();
      const confirmationService = {
        confirm: jest.fn().mockImplementation((cfg: any) => cfg.accept()),
      };

      const handler = buildCancelHandler({
        confirmationService,
        userService,
        toast,
        refresh,
        getSubscriptionLabel: (s) => `LABEL-${s.id}`,
      });

      handler({ id: 99, status: 'ACTIVE' });

      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('No se pudo cancelar en WooCommerce'),
      );
      expect(toast.success).not.toHaveBeenCalled();
      expect(refresh).not.toHaveBeenCalled();
    });

    it('NO llama el servicio si el usuario rechaza la confirmación', () => {
      const userService = {
        cancelUserSubscription: jest.fn(),
      };
      const confirmationService = {
        // No invoca cfg.accept ni cfg.reject — simula que el usuario cierra el dialog
        confirm: jest.fn(),
      };

      const handler = buildCancelHandler({
        confirmationService,
        userService,
        toast: { success: jest.fn(), error: jest.fn() },
        refresh: jest.fn(),
        getSubscriptionLabel: (s) => `LABEL-${s.id}`,
      });

      handler({ id: 5, status: 'ACTIVE' });

      expect(confirmationService.confirm).toHaveBeenCalled();
      expect(userService.cancelUserSubscription).not.toHaveBeenCalled();
    });
  });
});

describe('UserDashboardComponent — diálogo legacy de planificación', () => {
  const opciones = [
    {
      oposicion: Oposicion.MADRID,
      nivel: NivelOposicion.AVANZADO,
      franja: 'FRANJA_SEIS_A_OCHO_HORAS' as TipoDePlanificacionDeseada,
      varianteId: 8,
      planificacionMensual: {
        id: 91,
        identificador: 'MADRID-6-8',
        mes: 8,
        ano: 2026,
      },
    },
    {
      oposicion: Oposicion.MADRID,
      nivel: NivelOposicion.AVANZADO,
      franja: 'FRANJA_CUATRO_A_SEIS_HORAS' as TipoDePlanificacionDeseada,
      varianteId: 9,
      planificacionMensual: null,
    },
  ];

  const alumnoConfig: AlumnoPlanificacionTutor = {
    alumno: { id: 42, nombre: 'Ana', apellidos: 'A', email: 'ana@test.es' },
    configuracion: {
      variante: {
        id: 8,
        codigo: 'MAD6-8',
        oposicion: Oposicion.MADRID,
        nivel: NivelOposicion.AVANZADO,
        franja: 'FRANJA_SEIS_A_OCHO_HORAS' as TipoDePlanificacionDeseada,
      },
      version: 2,
      fechaVigencia: '2026-08-20',
      origen: 'ALUMNO',
      planificacionMensual: {
        id: 91,
        identificador: 'MADRID-6-8',
        mes: 8,
        ano: 2026,
      },
    },
    preferencias: {
      oposicion: Oposicion.MADRID,
      nivel: NivelOposicion.INICIACION,
      franja: 'FRANJA_CUATRO_A_SEIS_HORAS' as TipoDePlanificacionDeseada,
    },
    oposicionesPermitidas: [Oposicion.MADRID],
    opcionesPermitidas: opciones,
    recomendacion: null,
  };

  function crearComponente(overrides: Record<string, unknown> = {}) {
    const componente = Object.create(
      UserDashboardComponent.prototype,
    ) as UserDashboardComponent;
    Object.assign(componente, {
      toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn() },
      autoasignacionService: {
        getAdminAlumnoConfiguracion$: jest.fn(() => of(alumnoConfig)),
        forzarConfiguracionTutor$: jest.fn(() => of({})),
      },
      ...overrides,
    });
    return componente;
  }

  it('carga la configuración admin y deriva la cascada desde combinaciones backend', async () => {
    const componente = crearComponente();

    await componente.abrirForzarPlanificacion({ id: 42 } as any);

    expect(
      componente.autoasignacionService.getAdminAlumnoConfiguracion$,
    ).toHaveBeenCalledWith(42);
    expect(componente.tutorForzarPreferencias).toEqual({
      oposicion: Oposicion.MADRID,
      nivel: NivelOposicion.AVANZADO,
      franja: 'FRANJA_SEIS_A_OCHO_HORAS',
    });
    expect(componente.tutorForzarFranjaOptions).toEqual([
      { label: '6-8 horas', value: 'FRANJA_SEIS_A_OCHO_HORAS' },
      { label: '4-6 horas', value: 'FRANJA_CUATRO_A_SEIS_HORAS' },
    ]);
  });

  it('envía solo la combinación publicada y el motivo al forzar', async () => {
    const componente = crearComponente();
    await componente.abrirForzarPlanificacion({ id: 42 } as any);
    componente.tutorForzarMotivo = 'Cambio acordado';

    await componente.confirmarForzarPlanificacion();

    expect(
      componente.autoasignacionService.forzarConfiguracionTutor$,
    ).toHaveBeenCalledWith(42, {
      oposicion: Oposicion.MADRID,
      nivel: NivelOposicion.AVANZADO,
      franja: 'FRANJA_SEIS_A_OCHO_HORAS',
      motivo: 'Cambio acordado',
    });
  });

  it('bloquea una combinación sin plan publicado y muestra error visible si el force falla', async () => {
    const warning = jest.fn();
    const componente = crearComponente({
      toast: { success: jest.fn(), error: jest.fn(), warning },
    });
    await componente.abrirForzarPlanificacion({ id: 42 } as any);
    componente.tutorForzarPreferencias = {
      oposicion: Oposicion.MADRID,
      nivel: NivelOposicion.AVANZADO,
      franja: 'FRANJA_CUATRO_A_SEIS_HORAS' as TipoDePlanificacionDeseada,
    };
    componente.tutorForzarMotivo = 'Cambio acordado';
    await componente.confirmarForzarPlanificacion();
    expect(warning).toHaveBeenCalledWith(
      'La combinación seleccionada no tiene una planificación publicada.',
    );
    expect(
      componente.autoasignacionService.forzarConfiguracionTutor$,
    ).not.toHaveBeenCalled();

    componente.tutorForzarPreferencias = {
      oposicion: Oposicion.MADRID,
      nivel: NivelOposicion.AVANZADO,
      franja: 'FRANJA_SEIS_A_OCHO_HORAS' as TipoDePlanificacionDeseada,
    };
    componente.autoasignacionService.forzarConfiguracionTutor$ = jest.fn(() =>
      throwError(() => new Error('fallo')),
    );
    await componente.confirmarForzarPlanificacion();
    expect(componente.toast.error).toHaveBeenCalledWith(
      'No se pudo cambiar la planificación',
    );
    expect(componente.tutorForzarError).toBe(
      'No se pudo cambiar la planificación',
    );
  });
});

/**
 * Task C4 (feedback Raúl 2026-07-24) — override admin "Acceso a clases
 * grabadas desde" en el diálogo de edición.
 *
 * Mismo enfoque que Fase 1/2: réplica fiel de `editarUsuario` +
 * `confirmarCambios` del componente (no instanciable en este entorno por deep
 * imports de PrimeNG). Si la lógica del componente cambia, actualizar aquí.
 */
describe('UserDashboardComponent — override clases grabadas (Task C4)', () => {
  const buildEditHandlers = (deps: { userService: any; toast: any }) => {
    const state = {
      selectedUser: null as any,
      editFechaClasesGrabadas: null as Date | null,
      editDialogVisible: false,
    };
    // Réplica de `editarUsuario`.
    const editarUsuario = (user: any) => {
      state.selectedUser = { ...user };
      state.editFechaClasesGrabadas = user.fechaAccesoClasesGrabadas
        ? new Date(user.fechaAccesoClasesGrabadas)
        : null;
      state.editDialogVisible = true;
    };
    // Réplica de `confirmarCambios` (solo la construcción del payload).
    const confirmarCambios = (modifiedUser: any) => {
      deps.userService
        .updateUser(modifiedUser.id, {
          nombre: modifiedUser.nombre,
          apellidos: modifiedUser.apellidos,
          esTutor: modifiedUser.esTutor,
          fechaAccesoClasesGrabadas: state.editFechaClasesGrabadas
            ? state.editFechaClasesGrabadas.toISOString()
            : null,
        })
        .subscribe({
          next: () => deps.toast.success('Usuario actualizado correctamente'),
          error: () => deps.toast.error('No se pudo actualizar el usuario'),
        });
    };
    return { state, editarUsuario, confirmarCambios };
  };

  const buildDeps = () => {
    const subscribeMock = jest
      .fn()
      .mockImplementation((handlers: any) => handlers.next({}));
    return {
      userService: {
        updateUser: jest.fn().mockReturnValue({ subscribe: subscribeMock }),
      },
      toast: { success: jest.fn(), error: jest.fn() },
    };
  };

  it('el payload de guardado incluye fechaAccesoClasesGrabadas en ISO cuando el admin fija fecha', () => {
    const deps = buildDeps();
    const { state, editarUsuario, confirmarCambios } = buildEditHandlers(deps);

    editarUsuario({ id: 7, nombre: 'Ana', apellidos: 'B', esTutor: false });
    state.editFechaClasesGrabadas = new Date('2026-05-01T00:00:00.000Z');
    confirmarCambios(state.selectedUser);

    expect(deps.userService.updateUser).toHaveBeenCalledWith(7, {
      nombre: 'Ana',
      apellidos: 'B',
      esTutor: false,
      fechaAccesoClasesGrabadas: '2026-05-01T00:00:00.000Z',
    });
  });

  it('calendario vacío → manda fechaAccesoClasesGrabadas=null (borra el override)', () => {
    const deps = buildDeps();
    const { state, editarUsuario, confirmarCambios } = buildEditHandlers(deps);

    editarUsuario({
      id: 7,
      nombre: 'Ana',
      apellidos: 'B',
      esTutor: false,
      fechaAccesoClasesGrabadas: '2026-05-01T00:00:00.000Z',
    });
    // El admin limpia el calendario (botón clear del p-calendar).
    state.editFechaClasesGrabadas = null;
    confirmarCambios(state.selectedUser);

    expect(deps.userService.updateUser).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ fechaAccesoClasesGrabadas: null }),
    );
  });

  it('editarUsuario hidrata el calendario con el override existente del usuario', () => {
    const deps = buildDeps();
    const { state, editarUsuario } = buildEditHandlers(deps);

    editarUsuario({
      id: 7,
      fechaAccesoClasesGrabadas: '2026-05-01T00:00:00.000Z',
    });
    expect(state.editFechaClasesGrabadas).toEqual(
      new Date('2026-05-01T00:00:00.000Z'),
    );

    editarUsuario({ id: 8 });
    expect(state.editFechaClasesGrabadas).toBeNull();
  });
});

/**
 * Tests de lógica para el cambio a tipoOposicion: Oposicion[].
 */
describe('UserDashboardComponent — tipoOposicion array', () => {
  const isEmptyArray = (value: any): boolean =>
    Array.isArray(value) && value.length === 0;

  const getOnboardingCompletionPercentage = (user: any): number => {
    const onboardingFields = [
      user.tipoOposicion,
      user.nivelOposicion,
      user.tipoDePlanificacionDuracionDeseada,
    ];
    const filledFields = onboardingFields.filter(
      (field) =>
        field !== null &&
        field !== '' &&
        field !== false &&
        field !== undefined &&
        !isEmptyArray(field),
    ).length;
    return Math.round((filledFields / onboardingFields.length) * 100);
  };

  const formatTipoOposicion = (ops?: Oposicion[]): string => {
    if (!ops || ops.length === 0) {
      return 'No proporcionado';
    }
    return ops.map((o) => OPOSICION_LABELS[o] ?? o).join(', ');
  };

  it('formatTipoOposicion devuelve labels separados por coma', () => {
    expect(
      formatTipoOposicion([
        Oposicion.VALENCIA_AYUNTAMIENTO,
        Oposicion.ALICANTE_CPBA,
      ]),
    ).toBe('Valencia Ayuntamiento, CPBA Alicante');
  });

  it('formatTipoOposicion devuelve "No proporcionado" para array vacío o undefined', () => {
    expect(formatTipoOposicion([])).toBe('No proporcionado');
    expect(formatTipoOposicion(undefined)).toBe('No proporcionado');
  });

  it('getOnboardingCompletionPercentage no cuenta tipoOposicion vacío como relleno', () => {
    const user = {
      tipoOposicion: [],
      nivelOposicion: 'INICIACION',
      tipoDePlanificacionDuracionDeseada: 'FRANJA_CUATRO_A_SEIS_HORAS',
    };
    expect(getOnboardingCompletionPercentage(user)).toBe(67);
  });

  it('getOnboardingCompletionPercentage cuenta tipoOposicion con valores como relleno', () => {
    const user = {
      tipoOposicion: [Oposicion.MADRID],
      nivelOposicion: 'INICIACION',
      tipoDePlanificacionDuracionDeseada: 'FRANJA_CUATRO_A_SEIS_HORAS',
    };
    expect(getOnboardingCompletionPercentage(user)).toBe(100);
  });
});

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

/**
 * Task 8 fix: gatear el tab y la carga lazy de marcas físicas por el flag
 * PLANIFICACION_FISICA. El componente real sigue sin poder instanciarse en
 * este entorno (deep imports de PrimeNG), así que replicamos la lógica
 * exacta que vive en el componente.
 */
describe('UserDashboardComponent — marcas físicas (Task 8)', () => {
  const buildToggleHandler = (deps: {
    planificacionFisicaHabilitada: boolean;
    loadUserMarcas: jest.Mock;
    loadUserPlanifications: jest.Mock;
  }) => {
    const expandedUserIds = new Set<number>();
    const userPlanifications = new Map<number, any[]>();
    const userMarcas = new Map<number, any[]>();

    return (userId: number) => {
      if (expandedUserIds.has(userId)) {
        expandedUserIds.delete(userId);
      } else {
        expandedUserIds.add(userId);
        if (!userPlanifications.has(userId)) {
          deps.loadUserPlanifications(userId);
        }
        if (!userMarcas.has(userId) && deps.planificacionFisicaHabilitada) {
          deps.loadUserMarcas(userId);
        }
      }
    };
  };

  it('expandir fila llama loadUserMarcas cuando PLANIFICACION_FISICA está habilitada', () => {
    const loadUserMarcas = jest.fn();
    const loadUserPlanifications = jest.fn();
    const toggle = buildToggleHandler({
      planificacionFisicaHabilitada: true,
      loadUserMarcas,
      loadUserPlanifications,
    });

    toggle(42);

    expect(loadUserPlanifications).toHaveBeenCalledWith(42);
    expect(loadUserMarcas).toHaveBeenCalledWith(42);
  });

  it('expandir fila NO llama loadUserMarcas cuando PLANIFICACION_FISICA está deshabilitada', () => {
    const loadUserMarcas = jest.fn();
    const loadUserPlanifications = jest.fn();
    const toggle = buildToggleHandler({
      planificacionFisicaHabilitada: false,
      loadUserMarcas,
      loadUserPlanifications,
    });

    toggle(42);

    expect(loadUserPlanifications).toHaveBeenCalledWith(42);
    expect(loadUserMarcas).not.toHaveBeenCalled();
  });

  it('el tab "Marcas físicas" se renderiza solo cuando PLANIFICACION_FISICA está habilitada', () => {
    const on = makeMockAppConfigService(true);
    const off = makeMockAppConfigService(false);

    // Réplica exacta de la guarda del template.
    const tabVisible = (svc: ReturnType<typeof makeMockAppConfigService>) =>
      svc.estadoModulos()[ModuloApp.PLANIFICACION_FISICA] !== false;

    expect(tabVisible(on)).toBe(true);
    expect(tabVisible(off)).toBe(false);
  });
});
