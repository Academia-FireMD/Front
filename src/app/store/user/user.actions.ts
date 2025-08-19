import { createAction, props } from '@ngrx/store';
import { Usuario } from '../../shared/models/user.model';

// Load User Actions
export const loadUser = createAction('[User] Load User');

export const loadUserSuccess = createAction(
  '[User] Load User Success',
  props<{ user: Usuario }>()
);

export const loadUserFailure = createAction(
  '[User] Load User Failure',
  props<{ error: string }>()
);

// Update User Actions
export const updateUser = createAction(
  '[User] Update User',
  props<{ userId: number; userData: Partial<Usuario> }>()
);

export const updateUserSuccess = createAction(
  '[User] Update User Success',
  props<{ user: Usuario }>()
);

export const updateUserFailure = createAction(
  '[User] Update User Failure',
  props<{ error: string }>()
);

// Clear User Action
export const clearUser = createAction('[User] Clear User');


