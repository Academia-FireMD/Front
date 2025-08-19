import { createFeatureSelector, createSelector } from '@ngrx/store';
import { UserState } from './user.state';
import { MetodoCalificacion } from '../../shared/models/user.model';

export const selectUserState = createFeatureSelector<UserState>('user');

export const selectCurrentUser = createSelector(
  selectUserState,
  (state) => state.currentUser
);

export const selectUserLoading = createSelector(
  selectUserState,
  (state) => state.loading
);

export const selectUserError = createSelector(
  selectUserState,
  (state) => state.error
);

export const selectUserMetodoCalificacion = createSelector(
  selectCurrentUser,
  (user) => user?.metodoCalificacion || MetodoCalificacion.A1_E1_3_B0
);

export const selectUserRol = createSelector(
  selectCurrentUser,
  (user) => user?.rol
);

export const selectUserId = createSelector(
  selectCurrentUser,
  (user) => user?.id
);


