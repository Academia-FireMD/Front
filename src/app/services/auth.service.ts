import { HttpClient } from '@angular/common/http';
import { Injectable, Injector, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import {
  BehaviorSubject,
  distinctUntilChanged,
  Observable,
  map,
  of,
  switchMap,
  tap,
  throwError,
  catchError,
  filter,
  finalize,
  shareReplay,
} from 'rxjs';
import { environment } from '../../environments/environment';
import { Usuario } from '../shared/models/user.model';
import { decodeJwtPayload } from '../shared/utils/jwt.util';
import { AppState } from '../store/app.state';
import * as UserActions from '../store/user/user.actions';
import { ApiBaseService } from './api-base.service';
import {
  AuthIdentity,
  AuthSessionService,
  AuthSessionSnapshot,
} from './auth-session.service';
import { UserService } from './user.service';

export interface CurrentAuthIdentity {
  sub: unknown;
  isImpersonating: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService extends ApiBaseService {
  // BehaviorSubject para mantener el estado del usuario actual
  private currentDecodedUserSubject = new BehaviorSubject<any | null>(null);
  private _userService!: UserService;
  private refreshInFlight$: {
    session: AuthSessionSnapshot;
    observable: Observable<any>;
  } | null = null;
  /** Invalida respuestas de operaciones de autenticación anteriores. */
  private authOperation = 0;

  private readonly sessions = inject(AuthSessionService);

  /** Claims mínimos de identidad, síncronos y de solo lectura para cambios de cuenta. */
  public readonly currentIdentity$: Observable<CurrentAuthIdentity | null> =
    this.currentDecodedUserSubject.asObservable().pipe(
      map((claims) =>
        claims && typeof claims === 'object'
          ? {
              sub: claims.sub,
              isImpersonating: claims.isImpersonating === true,
            }
          : null,
      ),
      distinctUntilChanged(
        (previous, current) =>
          previous?.sub === current?.sub &&
          previous?.isImpersonating === current?.isImpersonating,
      ),
    );

  public currentUser$ = this.currentDecodedUserSubject.pipe(
    switchMap((user) => {
      const session = this.sessions.snapshot();
      if (user) {
        return this.getUserService()
          .getByEmail$(user.email)
          .pipe(
            map((loaded) => ({ session, user: loaded })),
            catchError((error) => {
              console.error('Error loading user:', error);
              // Solo retornar null, NO limpiar tokens aquí
              // El interceptor ya maneja refresh de tokens
              return of({ session, user: null });
            }),
          );
      }
      return of({ session, user: null });
    }),
    filter(({ session }) => this.sessions.isCurrent(session)),
    tap(({ user }) => {
      this.lastUserLoaded = user;
    }),
    map(({ user }) => user),
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

  private getUserService(): UserService {
    if (!this._userService) {
      this._userService = this.injector.get(UserService);
    }
    return this._userService;
  }

  private initCurrentUser(): void {
    const decodedToken = this.decodeToken();
    if (decodedToken) {
      const session = this.sessions.start(this.identityFrom(decodedToken));
      this.currentDecodedUserSubject.next(decodedToken);
      // Solo cargar el perfil si el usuario tiene permisos
      if (decodedToken.rol !== 'SIN_APROBACION') {
        this.deferInitialProfileLoad(session);
      }
    }
  }

  /**
   * Diferir la carga inicial evita resolver este servicio a mitad de su propio
   * constructor: el efecto suscribe la petición de perfil síncronamente y
   * AuthInterceptor pide AuthService al inyector, que aún no ha completado la
   * instancia (en producción el placeholder no expone `sessionSnapshot` y el
   * arranque muestra el toast genérico). La instantánea impide que un logout o
   * un login de otra cuenta ocurrido antes de la microtarea despache la carga
   * de la sesión anterior.
   */
  private deferInitialProfileLoad(session: AuthSessionSnapshot): void {
    queueMicrotask(() => {
      if (!this.sessions.isCurrent(session)) {
        return;
      }
      this.store.dispatch(UserActions.loadUser());
    });
  }

  private identityFrom(decoded: any): AuthIdentity {
    return {
      sub: decoded?.sub,
      isImpersonating: decoded?.isImpersonating === true,
    };
  }

  /**
   * Aplica claims ya autenticados. `newSession` debe ser true para login e
   * impersonación (aunque repitan el mismo `sub`); false solo para una
   * renovación de token dentro de la misma sesión.
   */
  private adoptDecodedUser(decoded: any, newSession: boolean): void {
    const anterior = this.sessions.snapshot();
    const actual = decoded
      ? newSession
        ? this.sessions.start(this.identityFrom(decoded))
        : this.sessions.continueSession(this.identityFrom(decoded))
      : anterior;

    // Un cambio real de sesión no puede heredar el perfil de la anterior.
    if (newSession || actual !== anterior) {
      this.clearLoadedUserData();
    }

    this.currentDecodedUserSubject.next(decoded);

    // Solo cargar el perfil si el usuario tiene permisos
    if (decoded && decoded.rol !== 'SIN_APROBACION') {
      this.store.dispatch(UserActions.loadUser());
    }
  }

  private clearLoadedUserData(): void {
    this.lastUserLoaded = null;
    this.store.dispatch(UserActions.clearUser());
  }

  private beginAuthOperation(): number {
    return ++this.authOperation;
  }

  private assertAuthOperation(operation: number): void {
    if (operation !== this.authOperation) {
      throw new Error('La operación de autenticación cambió');
    }
  }

  /** Instantánea síncrona para que interceptor/servicios detecten respuestas viejas. */
  public sessionSnapshot(): AuthSessionSnapshot {
    if (!this.sessions.snapshot().authenticated) {
      const decoded = this.decodeToken();
      if (decoded && typeof decoded === 'object') {
        this.sessions.start(this.identityFrom(decoded));
      }
    }
    return this.sessions.snapshot();
  }

  public isSessionCurrent(session: AuthSessionSnapshot): boolean {
    return this.sessions.isCurrent(session);
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
    const operacion = this.beginAuthOperation();
    return this.post('/login', { email, password }).pipe(
      tap((tokens) => {
        this.assertAuthOperation(operacion);
        if (tokens) {
          this.setToken(tokens.access_token);
          this.setRefreshToken(tokens.refresh_token);

          const decodedUser = this.decodeToken();
          this.adoptDecodedUser(decodedUser, true);
        }
      }),
    );
  }

  public refreshToken$(): Observable<any> {
    const sessionAlIniciar = this.sessionSnapshot();
    if (
      this.refreshInFlight$ &&
      this.sessions.isCurrent(this.refreshInFlight$.session)
    ) {
      return this.refreshInFlight$.observable;
    }

    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      return throwError(() => new Error('No refresh token available'));
    }

    const slot = {
      session: sessionAlIniciar,
      observable: null as unknown as Observable<any>,
    };

    const refresh$ = this.post('/refresh', {
      refresh_token: refreshToken,
    }).pipe(
      tap((tokens) => {
        // Si la sesión cambió mientras el refresh estaba en vuelo (logout,
        // login de otra cuenta, impersonación), esta respuesta ya no puede
        // escribir tokens, identidad ni perfil: restauraría al usuario viejo.
        if (!this.sessions.isCurrent(sessionAlIniciar)) {
          throw new Error('La sesión cambió durante la renovación del token');
        }
        if (tokens && tokens.access_token) {
          this.setToken(tokens.access_token);

          const decodedUser = this.decodeToken();
          this.adoptDecodedUser(decodedUser, false);
        }
      }),
      // El slot se libera tanto en éxito como en error, pero solo si sigue
      // siendo el nuestro: una sesión nueva puede haber abierto otro refresh.
      finalize(() => {
        if (this.refreshInFlight$ === slot) {
          this.refreshInFlight$ = null;
        }
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );

    slot.observable = refresh$;
    this.refreshInFlight$ = slot;
    return refresh$;
  }

  public logout$(): Observable<any> {
    // Implementar la llamada al backend para logout si es necesario
    return of(true).pipe(
      tap(() => {
        // Limpiar tokens, identidad y store en un único punto
        this.clearToken();
      }),
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
    // JWT va en base64url; usar el helper compartido en vez de atob directo
    // (atob peta con '-'/'_', incidente prod 2026-06-05). Devuelve null ante
    // token inválido para no romper el flujo de la app.
    return decodeJwtPayload(this.getToken());
  }

  clearToken(): void {
    sessionStorage.removeItem(this.TOKEN_KEY);
    sessionStorage.removeItem(this.REFRESH_TOKEN_KEY);

    // Invalida logins/impersonaciones en vuelo y publica la identidad vacía
    // para que ningún consumidor siga trabajando con el usuario anterior.
    this.authOperation += 1;
    this.sessions.invalidate();
    this.currentDecodedUserSubject.next(null);
    this.clearLoadedUserData();
  }

  requestPasswordReset(email: string): Observable<any> {
    return this.post('/request-password-reset', { email });
  }

  resetPassword(token: string, newPassword: string): Observable<any> {
    return this.post('/reset-password', { token, newPassword });
  }

  public getCurrentUser(): Usuario | null {
    return this.lastUserLoaded;
  }

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
    return this.http.post<any>(
      `${environment.apiUrl}/auth/activate-consumible`,
      {
        token,
        userId,
      },
    );
  }

  // Métodos para impersonación
  public impersonateUser$(userId: number): Observable<any> {
    const operacion = this.beginAuthOperation();
    const sessionAlIniciar = this.sessionSnapshot();
    return this.post(`/impersonate/${userId}`, {}).pipe(
      tap((tokens) => {
        this.assertAuthOperation(operacion);
        if (!this.sessions.isCurrent(sessionAlIniciar)) {
          throw new Error('La sesión cambió durante la impersonación');
        }
        if (tokens) {
          this.setToken(tokens.access_token);
          this.setRefreshToken(tokens.refresh_token);

          const decodedUser = this.decodeToken();
          this.adoptDecodedUser(decodedUser, true);
        }
      }),
    );
  }

  public stopImpersonation$(): Observable<any> {
    const operacion = this.beginAuthOperation();
    const sessionAlIniciar = this.sessionSnapshot();
    return this.post('/stop-impersonation', {}).pipe(
      tap((tokens) => {
        this.assertAuthOperation(operacion);
        if (!this.sessions.isCurrent(sessionAlIniciar)) {
          throw new Error('La sesión cambió al salir de la impersonación');
        }
        if (tokens) {
          this.setToken(tokens.access_token);
          this.setRefreshToken(tokens.refresh_token);

          const decodedUser = this.decodeToken();
          this.adoptDecodedUser(decodedUser, true);
        }
      }),
    );
  }

  public isImpersonating(): boolean {
    const token = this.decodeToken();
    return token?.isImpersonating || false;
  }

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

  /**
   * Pide al backend una URL SSO magic-link para WordPress.
   * El token resultante es de un solo uso (TTL 60s, jti guardado en WP).
   *
   * @param target Clave de destino en la allowlist del server (default: 'subscriptions')
   * @returns Observable con { url: string }
   */
  public getWpSsoUrl$(
    target: 'subscriptions' = 'subscriptions',
  ): Observable<{ url: string }> {
    return this.get(`/wp-sso-url?target=${target}`) as Observable<{
      url: string;
    }>;
  }
}
