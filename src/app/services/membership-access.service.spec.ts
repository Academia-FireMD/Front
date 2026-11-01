import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { ToastrService } from 'ngx-toastr';
import { Observable, Subject, of, throwError } from 'rxjs';
import {
  REASON_SUSCRIPCION_REQUERIDA,
  SuscripcionStatus,
} from '../shared/models/subscription.model';
import { Rol, Usuario } from '../shared/models/user.model';
import * as UserActions from '../store/user/user.actions';
import { AuthService } from './auth.service';
import { AuthSessionService } from './auth-session.service';
import { MembershipAccessService } from './membership-access.service';
import { UserService } from './user.service';

describe('MembershipAccessService', () => {
  let service: MembershipAccessService;
  let sessions: AuthSessionService;
  let auth: { decodeToken: jest.Mock; lastUserLoaded: Usuario | null };
  let users: { getUserProfile$: jest.Mock };
  let store: { dispatch: jest.Mock };
  let router: { url: string; navigate: jest.Mock };
  let toast: { info: jest.Mock };

  const usuarioSinMembresia: Usuario = {
    id: 7,
    email: 'alumno@test.com',
    nombre: 'Ana',
    apellidos: 'Pérez',
    rol: Rol.ALUMNO,
    validated: false,
    suscripciones: [],
  } as unknown as Usuario;

  function crearServicio(): MembershipAccessService {
    TestBed.configureTestingModule({
      providers: [
        MembershipAccessService,
        { provide: AuthService, useValue: auth },
        { provide: UserService, useValue: users },
        { provide: Store, useValue: store },
        { provide: Router, useValue: router },
        { provide: ToastrService, useValue: toast },
      ],
    });
    return TestBed.inject(MembershipAccessService);
  }

  beforeEach(() => {
    auth = {
      decodeToken: jest.fn(() => ({ rol: Rol.ALUMNO })),
      lastUserLoaded: null,
    };
    users = { getUserProfile$: jest.fn(() => of(usuarioSinMembresia)) };
    store = { dispatch: jest.fn() };
    router = { url: '/app/planificacion-fisica', navigate: jest.fn() };
    toast = { info: jest.fn() };
    service = crearServicio();
    sessions = TestBed.inject(AuthSessionService);
    sessions.start({ sub: 7, isImpersonating: false });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it('solo reconoce el 403 estable SUSCRIPCION_REQUERIDA', () => {
    expect(
      service.debeGestionar(
        new HttpErrorResponse({
          status: 403,
          error: { reason: REASON_SUSCRIPCION_REQUERIDA },
        }),
      ),
    ).toBe(true);
    expect(
      service.debeGestionar(
        new HttpErrorResponse({
          status: 403,
          error: { reason: 'TIER_TOO_LOW' },
        }),
      ),
    ).toBe(false);
    expect(
      service.debeGestionar(
        new HttpErrorResponse({
          status: 500,
          error: { reason: REASON_SUSCRIPCION_REQUERIDA },
        }),
      ),
    ).toBe(false);
  });

  it('recarga el perfil una vez, actualiza el store y lleva a /app/profile', () => {
    service.handleSuscripcionRequerida();

    expect(users.getUserProfile$).toHaveBeenCalledTimes(1);
    expect(store.dispatch).toHaveBeenCalledWith(
      UserActions.loadUserSuccess({ user: usuarioSinMembresia }),
    );
    expect(auth.lastUserLoaded).toBe(usuarioSinMembresia);
    expect(router.navigate).toHaveBeenCalledWith(['/app/profile']);
    expect(toast.info).toHaveBeenCalledWith(
      expect.stringContaining('Tu membresía ya no está activa'),
      'Acceso actualizado',
    );
  });

  it('no repite la carga ni el toast si llegan varios 403 en paralelo', () => {
    const pendiente = new Subject<Usuario>();
    users.getUserProfile$.mockReturnValue(pendiente.asObservable());

    service.handleSuscripcionRequerida();
    service.handleSuscripcionRequerida();
    service.handleSuscripcionRequerida();

    expect(users.getUserProfile$).toHaveBeenCalledTimes(1);
    expect(toast.info).not.toHaveBeenCalled();

    pendiente.next(usuarioSinMembresia);
    pendiente.complete();

    expect(store.dispatch).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledTimes(1);
    expect(toast.info).toHaveBeenCalledTimes(1);
  });

  it('aplica un cooldown a ráfagas posteriores (evita bucles)', () => {
    const ahora = jest.spyOn(Date, 'now');
    ahora.mockReturnValue(10_000);
    service.handleSuscripcionRequerida();

    ahora.mockReturnValue(11_000);
    service.handleSuscripcionRequerida();

    expect(users.getUserProfile$).toHaveBeenCalledTimes(1);
    expect(toast.info).toHaveBeenCalledTimes(1);
  });

  it('si el perfil recargado aún tiene membresía, no habla de pérdida total', () => {
    users.getUserProfile$.mockReturnValue(
      of({
        ...usuarioSinMembresia,
        suscripciones: [
          {
            id: 1,
            status: SuscripcionStatus.ACTIVE,
            fechaFin: null,
          },
        ],
      } as unknown as Usuario),
    );

    service.handleSuscripcionRequerida();

    expect(toast.info).toHaveBeenCalledWith(
      expect.stringContaining('Tu plan actual no incluye esta sección'),
      'Acceso actualizado',
    );
  });

  it('no actúa para un ADMIN ni sin rol de alumno', () => {
    auth.decodeToken.mockReturnValue({ rol: Rol.ADMIN });
    service.handleSuscripcionRequerida();
    expect(users.getUserProfile$).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('si la recarga invalida la sesión (401), no fuerza /app/profile tras el logout', () => {
    auth.decodeToken
      .mockReturnValueOnce({ rol: Rol.ALUMNO })
      .mockReturnValue(null);
    users.getUserProfile$.mockReturnValue(
      throwError(() => new Error('sesión expirada')) as Observable<Usuario>,
    );

    service.handleSuscripcionRequerida();

    expect(router.navigate).not.toHaveBeenCalled();
    expect(toast.info).not.toHaveBeenCalled();
  });

  it('si la recarga falla, no afirma una baja y deriva a un destino seguro', () => {
    users.getUserProfile$.mockReturnValue(
      throwError(() => new Error('red caída')) as Observable<Usuario>,
    );

    expect(() => service.handleSuscripcionRequerida()).not.toThrow();
    expect(router.navigate).toHaveBeenCalledWith(['/app/profile']);
    expect(toast.info).toHaveBeenCalledTimes(1);
    expect(toast.info).toHaveBeenCalledWith(
      expect.stringContaining('No hemos podido confirmar'),
      'Acceso actualizado',
    );
    expect(toast.info).not.toHaveBeenCalledWith(
      expect.stringContaining('Tu membresía ya no está activa'),
      expect.anything(),
    );
  });

  it('no navega si ya está en un destino permitido', () => {
    router.url = '/app/cursos/curso-demo';
    service.handleSuscripcionRequerida();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('la recarga de A que termina tras cambiar a B no escribe perfil ni redirige', () => {
    const pendienteA = new Subject<Usuario>();
    users.getUserProfile$.mockReturnValue(pendienteA.asObservable());

    service.handleSuscripcionRequerida();
    sessions.start({ sub: 2, isImpersonating: false });

    pendienteA.next(usuarioSinMembresia);
    pendienteA.complete();

    expect(auth.lastUserLoaded).toBeNull();
    expect(store.dispatch).not.toHaveBeenCalled();
    expect(toast.info).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('el error tardío de A tras cambiar a B no muestra toast ni redirige como B', () => {
    const pendienteA = new Subject<Usuario>();
    users.getUserProfile$.mockReturnValue(pendienteA.asObservable());

    service.handleSuscripcionRequerida();
    sessions.start({ sub: 2, isImpersonating: false });

    pendienteA.error(new Error('red caída'));

    expect(auth.lastUserLoaded).toBeNull();
    expect(store.dispatch).not.toHaveBeenCalled();
    expect(toast.info).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('B inicia su propia recarga aunque la de A siga en vuelo y no comparte el slot', () => {
    const pendienteA = new Subject<Usuario>();
    const usuarioB = { ...usuarioSinMembresia, id: 8 } as Usuario;
    const pendienteB = new Subject<Usuario>();
    users.getUserProfile$
      .mockReturnValueOnce(pendienteA.asObservable())
      .mockReturnValueOnce(pendienteB.asObservable());

    service.handleSuscripcionRequerida();
    sessions.start({ sub: 2, isImpersonating: false });
    service.handleSuscripcionRequerida();

    expect(users.getUserProfile$).toHaveBeenCalledTimes(2);

    pendienteA.next(usuarioSinMembresia);
    pendienteA.complete();
    expect(store.dispatch).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(toast.info).not.toHaveBeenCalled();

    pendienteB.next(usuarioB);
    pendienteB.complete();
    expect(store.dispatch).toHaveBeenCalledWith(
      UserActions.loadUserSuccess({ user: usuarioB }),
    );
    expect(auth.lastUserLoaded).toBe(usuarioB);
    expect(router.navigate).toHaveBeenCalledTimes(1);
    expect(toast.info).toHaveBeenCalledTimes(1);
  });

  it('el cooldown de A no bloquea la primera recarga de B', () => {
    const ahora = jest.spyOn(Date, 'now');
    ahora.mockReturnValue(10_000);
    users.getUserProfile$.mockReturnValue(of(usuarioSinMembresia));
    service.handleSuscripcionRequerida();

    sessions.start({ sub: 2, isImpersonating: false });
    ahora.mockReturnValue(11_000);
    service.handleSuscripcionRequerida();

    expect(users.getUserProfile$).toHaveBeenCalledTimes(2);
    expect(toast.info).toHaveBeenCalledTimes(2);
  });

  it('entrar en impersonación invalida la recarga pendiente de la sesión anterior', () => {
    const pendiente = new Subject<Usuario>();
    users.getUserProfile$.mockReturnValue(pendiente.asObservable());

    service.handleSuscripcionRequerida();
    sessions.start({ sub: 7, isImpersonating: true });

    pendiente.next(usuarioSinMembresia);
    pendiente.complete();

    expect(auth.lastUserLoaded).toBeNull();
    expect(store.dispatch).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
