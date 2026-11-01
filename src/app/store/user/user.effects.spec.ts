import { TestBed } from '@angular/core/testing';
import { provideMockActions } from '@ngrx/effects/testing';
import { Subject } from 'rxjs';
import { Rol, Usuario } from '../../shared/models/user.model';
import { AuthSessionService } from '../../services/auth-session.service';
import { UserService } from '../../services/user.service';
import * as UserActions from './user.actions';
import { UserEffects } from './user.effects';

describe('UserEffects — aislamiento de sesión', () => {
  let effects: UserEffects;
  let actions$: Subject<any>;
  let users: { getUserProfile$: jest.Mock; updateUser: jest.Mock };
  let sessions: AuthSessionService;
  let perfil$: Subject<Usuario>;

  const usuarioA = {
    id: 1,
    email: 'a@test.com',
    rol: Rol.ALUMNO,
  } as unknown as Usuario;

  beforeEach(() => {
    actions$ = new Subject();
    perfil$ = new Subject<Usuario>();
    users = {
      getUserProfile$: jest.fn(() => perfil$.asObservable()),
      updateUser: jest.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        UserEffects,
        provideMockActions(() => actions$),
        { provide: UserService, useValue: users },
      ],
    });

    effects = TestBed.inject(UserEffects);
    sessions = TestBed.inject(AuthSessionService);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('despacha el perfil cuando la sesión sigue siendo la misma', () => {
    sessions.start({ sub: 1, isImpersonating: false });
    const emitidas: unknown[] = [];
    const subscription = effects.loadUser$.subscribe((action) =>
      emitidas.push(action),
    );

    actions$.next(UserActions.loadUser());
    perfil$.next(usuarioA);
    perfil$.complete();

    expect(emitidas).toEqual([UserActions.loadUserSuccess({ user: usuarioA })]);
    subscription.unsubscribe();
  });

  it('no despacha el perfil de A si el logout ocurre antes de la respuesta', () => {
    sessions.start({ sub: 1, isImpersonating: false });
    const emitidas: unknown[] = [];
    const subscription = effects.loadUser$.subscribe((action) =>
      emitidas.push(action),
    );

    actions$.next(UserActions.loadUser());
    sessions.invalidate();

    perfil$.next(usuarioA);
    perfil$.complete();

    expect(emitidas).toEqual([]);
    subscription.unsubscribe();
  });

  it('no despacha el error de A sobre la sesión nueva de B', () => {
    sessions.start({ sub: 1, isImpersonating: false });
    const emitidas: unknown[] = [];
    const subscription = effects.loadUser$.subscribe((action) =>
      emitidas.push(action),
    );

    actions$.next(UserActions.loadUser());
    sessions.start({ sub: 2, isImpersonating: false });

    perfil$.error(new Error('red caída'));

    expect(emitidas).toEqual([]);
    subscription.unsubscribe();
  });

  it('no despacha el perfil de A al cambiar a B aunque la red no se cancele', () => {
    sessions.start({ sub: 1, isImpersonating: false });
    const emitidas: unknown[] = [];
    const subscription = effects.loadUser$.subscribe((action) =>
      emitidas.push(action),
    );

    actions$.next(UserActions.loadUser());
    sessions.start({ sub: 2, isImpersonating: false });

    perfil$.next(usuarioA);
    perfil$.complete();

    expect(emitidas).toEqual([]);
    subscription.unsubscribe();
  });

  it('no despacha un update de A sobre el store de B', () => {
    const actualizacion$ = new Subject<Usuario>();
    users.updateUser.mockReturnValue(actualizacion$.asObservable());
    sessions.start({ sub: 1, isImpersonating: false });
    const emitidas: unknown[] = [];
    const subscription = effects.updateUser$.subscribe((action) =>
      emitidas.push(action),
    );

    actions$.next(UserActions.updateUser({ userId: 1, userData: {} }));
    sessions.start({ sub: 2, isImpersonating: false });

    actualizacion$.next(usuarioA);
    actualizacion$.complete();

    expect(emitidas).toEqual([]);
    subscription.unsubscribe();
  });
});
