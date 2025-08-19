import { Injectable, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { AuthService } from './auth.service';
import { AppState } from '../store/app.state';
import * as UserActions from '../store/user/user.actions';

@Injectable({
  providedIn: 'root'
})
export class AppInitializationService {
  private store = inject(Store<AppState>);
  private authService = inject(AuthService);

  initializeApp(): void {
    // Si hay un token válido, cargar el usuario
    if (this.authService.getToken()) {
      this.store.dispatch(UserActions.loadUser());
    }
  }
}
