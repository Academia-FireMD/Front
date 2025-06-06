import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of, switchMap, tap } from 'rxjs';
import { Comunidad } from '../shared/models/pregunta.model';
import { Usuario } from '../shared/models/user.model';
import { ApiBaseService } from './api-base.service';
import { UserService } from './user.service';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class AuthService extends ApiBaseService {
  // BehaviorSubject para mantener el estado del usuario actual
  private currentDecodedUserSubject = new BehaviorSubject<any | null>(null);
  
  public currentUser$ = this.currentDecodedUserSubject.pipe(
    switchMap((user) => {
      if (user) {
        return this.userService.getByEmail$(user.email);
      }
      return of(null);
    }),
    tap((user) => {
      this.lastUserLoaded = user;
    })
  );

  // Observable público que otros componentes pueden suscribirse
  public lastUserLoaded: Usuario | null = null;

  constructor(private http: HttpClient, private userService: UserService) {
    super(http);
    this.controllerPrefix = '/auth';

    // Inicializar el usuario actual desde el token si existe
    this.initCurrentUser();
  }

  private initCurrentUser(): void {
    const decodedToken = this.decodeToken();
    if (decodedToken) {
      this.currentDecodedUserSubject.next(decodedToken);
    }
  }

  public register$(
    email: string,
    password: string,
    comunidad: Comunidad,
    nombre: string,
    apellidos: string,
    tutorId?: number,
    woocommerceCustomerId?: string,
    planType?: string
  ) {
    return this.post('/register', {
      email,
      password,
      comunidad,
      nombre,
      apellidos,
      tutorId,
      woocommerceCustomerId,
      planType,
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
        }
      })
    );
  }

  public refreshToken$(): Observable<any> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    return this.post('/refresh', { refresh_token: refreshToken }).pipe(
      tap((tokens) => {
        if (tokens && tokens.access_token) {
          this.setToken(tokens.access_token);

          // Actualizar el usuario actual después de refrescar el token
          const decodedUser = this.decodeToken();
          this.currentDecodedUserSubject.next(decodedUser);
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

  public registroTemporal$(token: string): Observable<any> {
    return this.get(`/registro-temporal/${token}`);
  }

  activateConsumible$(token: string, userId: number) {
    return this.http.post<any>(`${environment.apiUrl}/auth/activate-consumible`, {
      token,
      userId
    });
  }

 
}
