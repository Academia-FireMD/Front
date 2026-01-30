import { HttpClient } from '@angular/common/http';
import { Injectable, Injector, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { BehaviorSubject, Observable, of, switchMap, tap, throwError, catchError } from 'rxjs';
import { environment } from '../../environments/environment';
import { Usuario } from '../shared/models/user.model';
import { AppState } from '../store/app.state';
import * as UserActions from '../store/user/user.actions';
import { ApiBaseService } from './api-base.service';
import { UserService } from './user.service';

@Injectable({
  providedIn: 'root',
})
export class AuthService extends ApiBaseService {
  // BehaviorSubject para mantener el estado del usuario actual
  private currentDecodedUserSubject = new BehaviorSubject<any | null>(null);
  private _userService!: UserService;

  public currentUser$ = this.currentDecodedUserSubject.pipe(
    switchMap((user) => {
      if (user) {
        return this.getUserService().getByEmail$(user.email).pipe(
          catchError((error) => {
            console.error('Error loading user:', error);
            // Si falla la carga del usuario, limpiar tokens y retornar null
            this.clearToken();
            return of(null);
          })
        );
      }
      return of(null);
    }),
    tap((user) => {
      this.lastUserLoaded = user;
    })
  );

  // Observable público que otros componentes pueden suscribirse
  public lastUserLoaded: Usuario | null = null;

  // Store para NgRx
  private store = inject(Store<AppState>);

  constructor(private http: HttpClient) {
    super(http);
    this.controllerPrefix = '/auth';

    // Inicializar el usuario actual desde el token si existe
    this.initCurrentUser();
  }

  // Obtener UserService de forma lazy para evitar dependencia circular
  private getUserService(): UserService {
    if (!this._userService) {
      this._userService = this.injector.get(UserService);
    }
    return this._userService;
  }

  private initCurrentUser(): void {
    const decodedToken = this.decodeToken();
    if (decodedToken) {
      this.currentDecodedUserSubject.next(decodedToken);
      // Solo cargar el perfil si el usuario tiene permisos
      if (decodedToken.rol !== 'SIN_APROBACION') {
        this.store.dispatch(UserActions.loadUser());
      }
    }
  }

  /**
   * Registro manual de usuario.
   * NOTA: Los usuarios de WordPress se auto-registran desde el webhook.
   * Este método se mantiene solo para admins o casos edge.
   */
  public register$(
    email: string,
    password: string,
    nombre: string,
    apellidos: string,
    tutorId?: number,
  ) {
    return this.post('/register', {
      email,
      password,
      nombre,
      apellidos,
      tutorId,
    });
  }

  public login$(email: string, password: string): Observable<any> {
    return this.post('/login', { email, password }).pipe(
      tap((tokens) => {
        if (tokens) {
          this.setToken(tokens.access_token);
          this.setRefreshToken(tokens.refresh_token);

          // Actualizar el usuario actual después del login
          const decodedUser = this.decodeToken();
          this.currentDecodedUserSubject.next(decodedUser);

          // Solo cargar el perfil si el usuario tiene permisos
          if (decodedUser.rol !== 'SIN_APROBACION') {
            this.store.dispatch(UserActions.loadUser());
          }
        }
      })
    );
  }

  public refreshToken$(): Observable<any> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      return throwError(() => new Error('No refresh token available'));
    }

    return this.post('/refresh', { refresh_token: refreshToken }).pipe(
      tap((tokens) => {
        if (tokens && tokens.access_token) {
          this.setToken(tokens.access_token);

          // Actualizar el usuario actual después de refrescar el token
          const decodedUser = this.decodeToken();
          this.currentDecodedUserSubject.next(decodedUser);

          // Solo cargar el perfil si el usuario tiene permisos
          if (decodedUser.rol !== 'SIN_APROBACION') {
            this.store.dispatch(UserActions.loadUser());
          }
        }
      })
    );
  }

  public logout$(): Observable<any> {
    // Implementar la llamada al backend para logout si es necesario
    return of(true).pipe(
      tap(() => {
        // Limpiar tokens y usuario actual
        this.clearToken();
        this.currentDecodedUserSubject.next(null);
        this.lastUserLoaded = null;

        // Limpiar el store de NgRx
        this.store.dispatch(UserActions.clearUser());
      })
    );
  }

  private readonly TOKEN_KEY = 'authToken';
  private readonly REFRESH_TOKEN_KEY = 'refreshToken';

  setRefreshToken(token: string): void {
    sessionStorage.setItem(this.REFRESH_TOKEN_KEY, token);
  }

  getRefreshToken(): string | null {
    return sessionStorage.getItem(this.REFRESH_TOKEN_KEY);
  }

  clearRefreshToken(): void {
    sessionStorage.removeItem(this.REFRESH_TOKEN_KEY);
  }

  setToken(token: string): void {
    sessionStorage.setItem(this.TOKEN_KEY, token);
  }

  getToken(): string | null {
    return sessionStorage.getItem(this.TOKEN_KEY);
  }

  decodeToken(): any {
    const token = this.getToken();

    if (!token) {
      return null;
    }

    const payload = token.split('.')[1];
    return JSON.parse(atob(payload));
  }

  clearToken(): void {
    sessionStorage.removeItem(this.TOKEN_KEY);
    sessionStorage.removeItem(this.REFRESH_TOKEN_KEY);

    // También limpiar el store de NgRx si se limpia el token
    this.store.dispatch(UserActions.clearUser());
  }

  requestPasswordReset(email: string): Observable<any> {
    return this.post('/request-password-reset', { email });
  }

  resetPassword(token: string, newPassword: string): Observable<any> {
    return this.post('/reset-password', { token, newPassword });
  }

  // Método para obtener el usuario actual de forma síncrona
  public getCurrentUser(): Usuario | null {
    return this.lastUserLoaded;
  }

  // Método para verificar si el usuario está autenticado
  public isAuthenticated(): boolean {
    return !!this.getCurrentUser();
  }

  /**
   * @deprecated Ya no se usa para suscripciones nuevas.
   * El auto-registro desde WordPress crea usuarios directamente.
   * Solo se mantiene para consumibles y compatibilidad histórica.
   */
  public registroTemporal$(token: string): Observable<any> {
    return this.get(`/registro-temporal/${token}`);
  }

  /**
   * @deprecated Solo se mantiene para consumibles existentes.
   */
  activateConsumible$(token: string, userId: number) {
    return this.http.post<any>(`${environment.apiUrl}/auth/activate-consumible`, {
      token,
      userId
    });
  }

  // Métodos para impersonación
  public impersonateUser$(userId: number): Observable<any> {
    return this.post(`/impersonate/${userId}`, {}).pipe(
      tap((tokens) => {
        if (tokens) {
          this.setToken(tokens.access_token);
          this.setRefreshToken(tokens.refresh_token);

          // Actualizar el usuario actual después de la impersonación
          const decodedUser = this.decodeToken();
          this.currentDecodedUserSubject.next(decodedUser);

          // Solo cargar el perfil si el usuario tiene permisos
          if (decodedUser.rol !== 'SIN_APROBACION') {
            this.store.dispatch(UserActions.loadUser());
          }
        }
      })
    );
  }

  public stopImpersonation$(): Observable<any> {
    return this.post('/stop-impersonation', {}).pipe(
      tap((tokens) => {
        if (tokens) {
          this.setToken(tokens.access_token);
          this.setRefreshToken(tokens.refresh_token);

          // Actualizar el usuario actual después de detener la impersonación
          const decodedUser = this.decodeToken();
          this.currentDecodedUserSubject.next(decodedUser);

          // Solo cargar el perfil si el usuario tiene permisos (siempre true al salir de impersonación)
          if (decodedUser.rol !== 'SIN_APROBACION') {
            this.store.dispatch(UserActions.loadUser());
          }
        }
      })
    );
  }

  // Método para verificar si estamos impersonando
  public isImpersonating(): boolean {
    const token = this.decodeToken();
    return token?.isImpersonating || false;
  }

  // Método para obtener información de impersonación
  public getImpersonationInfo(): any {
    const token = this.decodeToken();
    if (token?.isImpersonating) {
      return {
        isImpersonating: true,
        impersonatedBy: token.impersonatedBy,
        originalAdminEmail: token.originalAdminEmail,
      };
    }
    return { isImpersonating: false };
  }


}
