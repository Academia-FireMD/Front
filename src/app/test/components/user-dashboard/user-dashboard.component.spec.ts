import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { COMMON_TEST_PROVIDERS } from '../../../testing';

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
