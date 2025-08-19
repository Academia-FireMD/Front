import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { of } from 'rxjs';
import { catchError, map, mergeMap } from 'rxjs/operators';
import { UserService } from '../../services/user.service';
import * as UserActions from './user.actions';

@Injectable()
export class UserEffects {
  
  loadUser$;
  updateUser$;

  constructor(
    private actions$: Actions,
    private userService: UserService
  ) {
    this.loadUser$ = createEffect(() =>
      this.actions$.pipe(
        ofType(UserActions.loadUser),
        mergeMap(() =>
          this.userService.getUserProfile$().pipe(
            map((user) => UserActions.loadUserSuccess({ user })),
            catchError((error) =>
              of(UserActions.loadUserFailure({ error: error.message }))
            )
          )
        )
      )
    );

    this.updateUser$ = createEffect(() =>
      this.actions$.pipe(
        ofType(UserActions.updateUser),
        mergeMap(({ userId, userData }) =>
          this.userService.updateUser(userId, userData).pipe(
            map((user) => UserActions.updateUserSuccess({ user })),
            catchError((error) =>
              of(UserActions.updateUserFailure({ error: error.message }))
            )
          )
        )
      )
    );
  }
}
