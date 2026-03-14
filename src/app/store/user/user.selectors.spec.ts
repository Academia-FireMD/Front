import { UserState } from './user.state';
import {
  selectUserState,
  selectCurrentUser,
  selectUserLoading,
  selectUserError,
  selectUserMetodoCalificacion,
  selectUserRol,
  selectUserId,
} from './user.selectors';
import { MetodoCalificacion, Rol } from '../../shared/models/user.model';
import { createTestUser } from '../../testing/factories/user.factory';

describe('User Selectors', () => {
  const mockUser = createTestUser({
    id: 42,
    rol: Rol.ADMIN,
    metodoCalificacion: MetodoCalificacion.A1_E1_4_B0,
  });

  const populatedState: { user: UserState } = {
    user: {
      currentUser: mockUser,
      loading: false,
      error: null,
    },
  };

  const emptyState: { user: UserState } = {
    user: {
      currentUser: null,
      loading: true,
      error: 'some error',
    },
  };

  describe('selectUserState', () => {
    it('should select the user feature state', () => {
      expect(selectUserState(populatedState)).toEqual(populatedState.user);
    });
  });

  describe('selectCurrentUser', () => {
    it('should return the current user', () => {
      expect(selectCurrentUser(populatedState)).toEqual(mockUser);
    });

    it('should return null when no user is loaded', () => {
      expect(selectCurrentUser(emptyState)).toBeNull();
    });
  });

  describe('selectUserLoading', () => {
    it('should return false when not loading', () => {
      expect(selectUserLoading(populatedState)).toBe(false);
    });

    it('should return true when loading', () => {
      expect(selectUserLoading(emptyState)).toBe(true);
    });
  });

  describe('selectUserError', () => {
    it('should return null when no error', () => {
      expect(selectUserError(populatedState)).toBeNull();
    });

    it('should return the error string', () => {
      expect(selectUserError(emptyState)).toBe('some error');
    });
  });

  describe('selectUserMetodoCalificacion', () => {
    it('should return the user metodoCalificacion', () => {
      expect(selectUserMetodoCalificacion(populatedState)).toBe(MetodoCalificacion.A1_E1_4_B0);
    });

    it('should default to A1_E1_3_B0 when user is null', () => {
      expect(selectUserMetodoCalificacion(emptyState)).toBe(MetodoCalificacion.A1_E1_3_B0);
    });
  });

  describe('selectUserRol', () => {
    it('should return the user role', () => {
      expect(selectUserRol(populatedState)).toBe(Rol.ADMIN);
    });

    it('should return undefined when user is null', () => {
      expect(selectUserRol(emptyState)).toBeUndefined();
    });
  });

  describe('selectUserId', () => {
    it('should return the user id', () => {
      expect(selectUserId(populatedState)).toBe(42);
    });

    it('should return undefined when user is null', () => {
      expect(selectUserId(emptyState)).toBeUndefined();
    });
  });
});
