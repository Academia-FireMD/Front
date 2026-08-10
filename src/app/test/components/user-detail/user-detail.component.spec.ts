import { HttpErrorResponse } from '@angular/common/http';
import { Subject, of, throwError } from 'rxjs';
import { UserDetailComponent } from './user-detail.component';
import {
  Oposicion,
  SuscripcionTipo,
} from '../../../shared/models/subscription.model';

const OPOSICION_DE_PRUEBA = Oposicion.VALENCIA_AYUNTAMIENTO;

describe('UserDetailComponent focused behavior', () => {
  const build = () => {
    const component = Object.create(
      UserDetailComponent.prototype,
    ) as UserDetailComponent & any;
    component.users = {
      getAdminUserDetail$: jest.fn(),
      updateUser: jest.fn(),
      createUserSubscription: jest.fn(),
      cancelUserSubscription: jest.fn(),
    };
    component.planificaciones = {
      desvincularPlanificacionMensualAdmin$: jest.fn(),
    };
    component.fisica = { marcasDeAlumno: jest.fn() };
    component.config = {
      estadoModulos: () => ({ PLANIFICACION_FISICA: false }),
    };
    component.route = {
      snapshot: {
        queryParams: { skip: '20', searchTerm: 'Ana' },
        paramMap: { get: () => '7' },
      },
    };
    component.router = { navigate: jest.fn() };
    component.toast = {
      success: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
      warning: jest.fn(),
    };
    component.requestVersion = 0;
    component.detailRefreshVersion = 0;
    component.selectedOposicion = OPOSICION_DE_PRUEBA;
    component.selectedSubscriptionType = SuscripcionTipo.BASIC;
    component.oposiciones = [
      { value: OPOSICION_DE_PRUEBA, label: 'Valencia Ayuntamiento' },
    ];
    component.availableLabels = [];
    component.planificacionFisicaHabilitada = () => false;
    component.labels = {
      assignLabelToUser: jest.fn(),
      assignLabelByKeyValue: jest.fn(),
      removeLabelFromUser: jest.fn(),
      getLabels: jest.fn(),
    };
    return component;
  };

  it('returns to the list preserving its query state', () => {
    const component = build();
    component.volver();
    expect(component.router.navigate).toHaveBeenCalledWith(['/app/test/user'], {
      queryParams: { skip: '20', searchTerm: 'Ana' },
    });
  });

  it('maps a 404 to the dedicated missing-user state', async () => {
    const component = build();
    component.users.getAdminUserDetail$.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 404 })),
    );
    await component.load();
    expect(component.notFound).toBe(true);
    expect(component.error).toBe(false);
  });

  it('ignores a late response from the previously requested user', async () => {
    const component = build();
    const first = new Subject<any>();
    const second = new Subject<any>();
    let id = '7';
    component.route.snapshot.paramMap.get = () => id;
    component.users.getAdminUserDetail$.mockImplementation(
      (requestedId: number) => (requestedId === 7 ? first : second),
    );
    const loadingFirst = component.load();
    id = '8';
    const loadingSecond = component.load();
    second.next({ id: 8, nombre: 'B' });
    second.complete();
    await loadingSecond;
    first.next({ id: 7, nombre: 'A' });
    first.complete();
    await loadingFirst;
    expect(component.user).toMatchObject({ id: 8, nombre: 'B' });
  });

  it('uses the exact progress-loss confirmation before unlinking', () => {
    const component = build();
    component.confirmation = { confirm: jest.fn() };
    component.user = { id: 7 };
    component.confirmarDesvincular(12);
    expect(component.confirmation.confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        message:
          'Se eliminarán también el progreso y los eventos personalizados asociados. ¿Quieres continuar?',
      }),
    );
  });

  it('keeps the displayed user id when accepting an unlink after route changes', async () => {
    const component = build();
    let routeId = '7';
    component.user = { id: 7 };
    component.route.snapshot.paramMap.get = () => routeId;
    component.confirmation = { confirm: jest.fn() };
    component.planificaciones.desvincularPlanificacionMensualAdmin$.mockReturnValue(
      of({}),
    );
    component.confirmarDesvincular(12);
    const confirmation = component.confirmation.confirm.mock.calls[0][0];
    routeId = '8';
    component.user = { id: 8 };
    await confirmation.accept();
    expect(
      component.planificaciones.desvincularPlanificacionMensualAdmin$,
    ).toHaveBeenCalledWith(12, 7);
  });

  it('keeps the displayed user id when accepting deletion after route changes', () => {
    const component = build();
    component.user = { id: 7 };
    component.confirmation = { confirm: jest.fn() };
    component.users.eliminarUsuario = jest.fn().mockReturnValue(of({}));
    component.confirmarEliminar();
    const confirmation = component.confirmation.confirm.mock.calls[0][0];
    component.user = { id: 8 };
    confirmation.accept();
    expect(component.users.eliminarUsuario).toHaveBeenCalledWith(7);
  });

  it('does not request physical marks when the module is disabled', async () => {
    const component = build();
    component.users.getUserPlanifications$ = jest.fn().mockReturnValue(of([]));
    await component.loadSections(7, 0);
    expect(component.fisica.marcasDeAlumno).not.toHaveBeenCalled();
  });

  it('allows mixed Woo/manual subscription management and cancels Woo through the same endpoint', () => {
    const component = build();
    component.user = {
      id: 7,
      suscripciones: [
        {
          id: 1,
          status: 'PENDING_CANCEL',
          fechaFin: '2099-01-01T00:00:00.000Z',
          woocommerceSubscriptionId: 'wc_current',
          oposicion: Oposicion.MADRID,
        },
        {
          id: 2,
          status: 'ACTIVE',
          woocommerceSubscriptionId: null,
          oposicion: OPOSICION_DE_PRUEBA,
        },
      ],
    };
    component.abrirSuscripciones();
    expect(component.subscriptionVisible).toBe(true);
    expect(component.toast.info).not.toHaveBeenCalled();

    component.confirmation = { confirm: jest.fn() };
    component.users.cancelUserSubscription.mockReturnValue(of({}));
    component.cancelarSuscripcion(component.user.suscripciones[0]);
    component.confirmation.confirm.mock.calls[0][0].accept();
    expect(component.users.cancelUserSubscription).toHaveBeenCalledWith(1);
  });

  it('still blocks a duplicate current manual subscription', () => {
    const component = build();
    component.user = {
      id: 7,
      suscripciones: [
        { id: 1, status: 'ACTIVE', oposicion: OPOSICION_DE_PRUEBA },
      ],
    };
    component.anadirSuscripcion();
    expect(component.toast.warning).toHaveBeenCalledWith(
      'Ya existe una suscripción activa para esta oposición',
    );
  });

  it('derives label dropdown display from key and value', async () => {
    const component = build();
    component.user = { id: 7 };
    component.labels.getLabels.mockReturnValue(
      of([
        { id: 'one', key: 'cohorte', value: '2026' },
        { id: 'two', key: 'prioridad' },
      ]),
    );

    await component.abrirEtiquetas();

    expect(component.availableLabels).toEqual([
      expect.objectContaining({ id: 'one', display: 'cohorte: 2026' }),
      expect.objectContaining({ id: 'two', display: 'prioridad' }),
    ]);
  });

  it('allows a replacement when the pending cancellation for that opposition expired', () => {
    const component = build();
    component.user = {
      id: 7,
      suscripciones: [
        {
          id: 1,
          status: 'PENDING_CANCEL',
          oposicion: OPOSICION_DE_PRUEBA,
          fechaFin: '2020-01-01T00:00:00.000Z',
        },
      ],
    };
    component.users.createUserSubscription = jest.fn().mockReturnValue(of({}));

    component.anadirSuscripcion();

    expect(component.users.createUserSubscription).toHaveBeenCalled();
    expect(component.toast.warning).not.toHaveBeenCalled();
  });

  it('warns after a successful mutation when the detail refresh fails', async () => {
    const component = build();
    component.user = {
      id: 7,
      nombre: 'Ana',
      apellidos: 'Prueba',
      esTutor: false,
    };
    component.editableUser = { ...component.user };
    component.users.updateUser.mockReturnValue(of({}));
    component.users.getAdminUserDetail$.mockReturnValue(
      throwError(() => new Error('refresh failed')),
    );

    component.guardarEdicion();
    await Promise.resolve();
    await Promise.resolve();

    expect(component.toast.success).toHaveBeenCalledWith(
      'Usuario actualizado correctamente',
    );
    expect(component.toast.warning).toHaveBeenCalledWith(
      'Los cambios se guardaron, pero no se pudo actualizar la ficha.',
    );
    expect(component.toast.error).not.toHaveBeenCalledWith(
      'No se pudo actualizar el usuario',
    );
  });

  it('does not close B editor when A update responds after a route change', async () => {
    const component = build();
    let routeId = '7';
    component.route.snapshot.paramMap.get = () => routeId;
    const update = new Subject<any>();
    component.user = { id: 7, nombre: 'A', apellidos: 'Uno', esTutor: false };
    component.editableUser = { ...component.user };
    component.editVisible = true;
    component.users.updateUser.mockReturnValue(update);
    component.guardarEdicion();

    routeId = '8';
    component.user = { id: 8, nombre: 'B', apellidos: 'Dos', esTutor: false };
    component.editableUser = { ...component.user };
    component.editVisible = true;
    update.next({});
    update.complete();
    await Promise.resolve();
    await Promise.resolve();

    expect(component.editVisible).toBe(true);
    expect(component.editableUser.id).toBe(8);
  });

  it('always closes route-scoped dialogs while an earlier mutation finishes', () => {
    const component = build();
    component.confirmation = { close: jest.fn() };
    component.savingEdit = true;
    component.mutatingSubscription = true;
    component.mutatingLabels = true;
    component.editVisible = true;
    component.subscriptionVisible = true;
    component.labelsVisible = true;
    component.editableUser = { id: 7 };

    component.resetRouteScopedUi();

    expect(component.editVisible).toBe(false);
    expect(component.subscriptionVisible).toBe(false);
    expect(component.labelsVisible).toBe(false);
    expect(component.editableUser).toBeUndefined();
  });

  it('clears A form selections and mutations before displaying B', () => {
    const component = build();
    component.confirmation = { close: jest.fn() };
    component.user = { id: 7 };
    component.selectedSubscriptionType = SuscripcionTipo.PREMIUM;
    component.selectedOposicion = Oposicion.MADRID;
    component.selectedLabelId = 'label-a';
    component.availableLabels = [
      { id: 'label-a', key: 'cohorte', display: 'cohorte' },
    ];
    component.creatingNewLabel = true;
    component.newLabelKey = 'prioridad';
    component.newLabelValue = 'alta';
    component.mutatingSubscription = true;
    component.mutatingLabels = true;

    component.resetRouteScopedUi();
    component.user = { id: 8 };

    expect(component.selectedSubscriptionType).toBe(SuscripcionTipo.BASIC);
    expect(component.selectedOposicion).toBe(Oposicion.VALENCIA_AYUNTAMIENTO);
    expect(component.selectedLabelId).toBe('');
    expect(component.availableLabels).toEqual([]);
    expect(component.creatingNewLabel).toBe(false);
    expect(component.newLabelKey).toBe('');
    expect(component.newLabelValue).toBe('');
    expect(component.mutatingSubscription).toBe(false);
    expect(component.mutatingLabels).toBe(false);
  });

  it('does not reopen A labels dialog after switching to B while labels load', async () => {
    const component = build();
    let routeId = '7';
    const labels = new Subject<any>();
    component.route.snapshot.paramMap.get = () => routeId;
    component.user = { id: 7 };
    component.labels.getLabels.mockReturnValue(labels);

    const opening = component.abrirEtiquetas();
    routeId = '8';
    component.user = { id: 8 };
    labels.next([{ id: 'label-1', key: 'cohorte' }]);
    labels.complete();
    await opening;

    expect(component.labelsVisible).not.toBe(true);
    expect(component.availableLabels).toEqual([]);
  });

  it('edits a clone and cancel discards date/name changes without mutating the card', () => {
    const component = build();
    component.user = {
      id: 7,
      nombre: 'Ana',
      fechaAccesoClasesGrabadas: '2026-01-01T00:00:00.000Z',
    };
    component.editar();
    expect(component.editFechaClasesGrabadas).toEqual(
      new Date('2026-01-01T00:00:00.000Z'),
    );
    component.editableUser.nombre = 'Cambiada';
    component.editFechaClasesGrabadas = new Date('2027-02-03T00:00:00.000Z');
    component.cancelarEdicion();
    expect(component.user.nombre).toBe('Ana');
    expect(component.editableUser).toBeUndefined();
    expect(component.editFechaClasesGrabadas).toBeNull();
  });

  it('assigns existing and new labels through the real service methods', () => {
    const component = build();
    component.user = { id: 7, suscripciones: [] };
    component.users.getAdminUserDetail$.mockReturnValue(of(component.user));
    component.selectedLabelId = 'existing';
    component.labels.assignLabelToUser.mockReturnValue(of([]));
    component.asignarEtiqueta();
    expect(component.labels.assignLabelToUser).toHaveBeenCalledWith(
      7,
      'existing',
    );
    component.newLabelKey = 'cohorte';
    component.newLabelValue = '2026';
    component.labels.assignLabelByKeyValue.mockReturnValue(of([]));
    component.crearYAsignarEtiqueta();
    expect(component.labels.assignLabelByKeyValue).toHaveBeenCalledWith(
      7,
      'cohorte',
      '2026',
    );
  });

  it('shows a toast when unlinking fails without clearing the action flag early', async () => {
    const component = build();
    component.user = { id: 7 };
    component.planificaciones.desvincularPlanificacionMensualAdmin$.mockReturnValue(
      throwError(() => new Error('failed')),
    );
    await component.desvincular(12);
    expect(component.toast.error).toHaveBeenCalledWith(
      'No se pudo desvincular la planificación',
    );
    expect(component.unlinkingPlanificacionId).toBeUndefined();
  });

  it('does not let a stale unlink callback reset B action state or show a toast', async () => {
    const component = build();
    let routeId = '7';
    const unlink = new Subject<void>();
    component.route.snapshot.paramMap.get = () => routeId;
    component.user = { id: 7 };
    component.planificaciones.desvincularPlanificacionMensualAdmin$.mockReturnValue(
      unlink,
    );
    const pending = component.desvincular(12);

    routeId = '8';
    component.user = { id: 8 };
    component.unlinkingPlanificacionId = 99;
    unlink.error(new Error('failed'));
    await pending;

    expect(component.unlinkingPlanificacionId).toBe(99);
    expect(component.toast.error).not.toHaveBeenCalled();
  });

  it('keeps the latest detail refresh when requests complete in reverse order', async () => {
    const component = build();
    const first = new Subject<any>();
    const second = new Subject<any>();
    component.user = { id: 7, nombre: 'Inicial' };
    component.users.getAdminUserDetail$
      .mockReturnValueOnce(first)
      .mockReturnValueOnce(second);

    const firstRefresh = component.loadDetailOnly(7);
    const secondRefresh = component.loadDetailOnly(7);
    second.next({ id: 7, nombre: 'Nueva' });
    second.complete();
    await secondRefresh;
    first.next({ id: 7, nombre: 'Antigua' });
    first.complete();
    await firstRefresh;

    expect(component.user).toMatchObject({ id: 7, nombre: 'Nueva' });
  });

  it('retries planifications and marks independently after a section error', async () => {
    const component = build();
    component.user = { id: 7 };
    component.users.getUserPlanifications$ = jest
      .fn()
      .mockReturnValueOnce(throwError(() => new Error('failed')))
      .mockReturnValueOnce(of([]));
    await component.loadSections(7, 0);
    expect(component.asignacionesError).toBe(true);

    component.reintentarPlanificaciones();
    await Promise.resolve();
    expect(component.asignacionesError).toBe(false);

    component.planificacionFisicaHabilitada = () => true;
    component.users.getUserPlanifications$.mockReturnValue(of([]));
    component.fisica.marcasDeAlumno
      .mockReturnValueOnce(throwError(() => new Error('failed')))
      .mockReturnValueOnce(of([]));
    await component.loadSections(7, 0);
    expect(component.marcasError).toBe(true);

    component.reintentarMarcas();
    await Promise.resolve();
    expect(component.marcasError).toBe(false);
  });

  it('counts a valid false onboarding answer as completed', () => {
    const component = build();
    component.user = { id: 7, experienciaAcademias: false };
    component.onboardingGroups = [['Experiencia', 'experienciaAcademias']];

    expect(component.onboardingCompletion()).toBe(100);
  });
});
