import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { EMPTY, of } from 'rxjs';
import { catchError, mergeMap } from 'rxjs/operators';
import { AuthSessionService } from '../../services/auth-session.service';
import { UserService } from '../../services/user.service';
import * as UserActions from './user.actions';

@Injectable()
export class UserEffects {
  private readonly sessions = inject(AuthSessionService);

  loadUser$;
  updateUser$;

  constructor(
    private actions$: Actions,
    private userService: UserService,
  ) {
    this.loadUser$ = createEffect(() =>
      this.actions$.pipe(
        ofType(UserActions.loadUser),
        mergeMap(() => {
          const session = this.sessions.snapshot();
          return this.userService.getUserProfile$().pipe(
            mergeMap((user) =>
              this.sessions.isCurrent(session)
                ? of(UserActions.loadUserSuccess({ user }))
                : EMPTY,
            ),
            catchError((error) => {
              // Silenciar el error si es 403 (usuario sin permisos). Si la
              // sesión cambió, el fallo pertenece al usuario anterior y no
              // debe escribir error/loading en el store del actual.
              if (!this.sessions.isCurrent(session)) {
                return EMPTY;
              }
              console.warn('Error loading user profile:', error);
              return of(UserActions.loadUserFailure({ error: error.message }));
            }),
          );
        }),
      ),
    );

    this.updateUser$ = createEffect(() =>
      this.actions$.pipe(
        ofType(UserActions.updateUser),
        mergeMap(({ userId, userData }) => {
          const session = this.sessions.snapshot();
          return this.userService.updateUser(userId, userData).pipe(
            mergeMap((user) =>
              this.sessions.isCurrent(session)
                ? of(UserActions.updateUserSuccess({ user }))
                : EMPTY,
            ),
            catchError((error) =>
              this.sessions.isCurrent(session)
                ? of(UserActions.updateUserFailure({ error: error.message }))
                : EMPTY,
            ),
          );
        }),
      ),
    );
  }
}
