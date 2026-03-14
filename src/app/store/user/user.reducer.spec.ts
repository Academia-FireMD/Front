import { userReducer } from './user.reducer';
import { initialUserState, UserState } from './user.state';
import * as UserActions from './user.actions';
import { createTestUser } from '../../testing/factories/user.factory';

describe('userReducer', () => {
  const mockUser = createTestUser();

  describe('unknown action', () => {
    it('should return the initial state', () => {
      const action = { type: 'UNKNOWN' } as any;
      const state = userReducer(initialUserState, action);
      expect(state).toBe(initialUserState);
    });
  });

  // ─── loadUser ───────────────────────────────────────────────────────
  describe('loadUser', () => {
    it('should set loading to true and clear error', () => {
      const prevState: UserState = { ...initialUserState, error: 'old error' };
      const state = userReducer(prevState, UserActions.loadUser());
      expect(state.loading).toBe(true);
      expect(state.error).toBeNull();
    });
  });

  describe('loadUserSuccess', () => {
    it('should set the user and stop loading', () => {
      const prevState: UserState = { ...initialUserState, loading: true };
      const state = userReducer(prevState, UserActions.loadUserSuccess({ user: mockUser }));
      expect(state.currentUser).toEqual(mockUser);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('loadUserFailure', () => {
    it('should set the error and stop loading', () => {
      const prevState: UserState = { ...initialUserState, loading: true };
      const state = userReducer(prevState, UserActions.loadUserFailure({ error: 'fail' }));
      expect(state.loading).toBe(false);
      expect(state.error).toBe('fail');
    });
  });

  // ─── updateUser ─────────────────────────────────────────────────────
  describe('updateUser', () => {
    it('should set loading to true', () => {
      const state = userReducer(
        initialUserState,
        UserActions.updateUser({ userId: 1, userData: { nombre: 'Nuevo' } }),
      );
      expect(state.loading).toBe(true);
      expect(state.error).toBeNull();
    });
  });

  describe('updateUserSuccess', () => {
    it('should update the user and stop loading', () => {
      const updated = createTestUser({ nombre: 'Updated' });
      const prevState: UserState = {
        currentUser: mockUser,
        loading: true,
        error: null,
      };
      const state = userReducer(prevState, UserActions.updateUserSuccess({ user: updated }));
      expect(state.currentUser?.nombre).toBe('Updated');
      expect(state.loading).toBe(false);
    });
  });

  describe('updateUserFailure', () => {
    it('should set the error and stop loading', () => {
      const prevState: UserState = { currentUser: mockUser, loading: true, error: null };
      const state = userReducer(prevState, UserActions.updateUserFailure({ error: 'update fail' }));
      expect(state.error).toBe('update fail');
      expect(state.loading).toBe(false);
    });
  });

  // ─── clearUser ──────────────────────────────────────────────────────
  describe('clearUser', () => {
    it('should reset to initial state', () => {
      const prevState: UserState = {
        currentUser: mockUser,
        loading: true,
        error: 'some error',
      };
      const state = userReducer(prevState, UserActions.clearUser());
      expect(state).toEqual(initialUserState);
    });
  });
});
