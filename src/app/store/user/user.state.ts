import { Usuario } from '../../shared/models/user.model';

export interface UserState {
  currentUser: Usuario | null;
  loading: boolean;
  error: string | null;
}

export const initialUserState: UserState = {
  currentUser: null,
  loading: false,
  error: null,
};


