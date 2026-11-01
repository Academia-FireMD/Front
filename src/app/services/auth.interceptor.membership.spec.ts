import {
  HttpClient,
  HTTP_INTERCEPTORS,
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideMockStore } from '@ngrx/store/testing';
import { ToastrService } from 'ngx-toastr';
import { Observable, of } from 'rxjs';
import { environment } from '../../environments/environment';
import { Rol, Usuario } from '../shared/models/user.model';
import { AuthInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';
import { MembershipAccessService } from './membership-access.service';
import { UserService } from './user.service';

function token(payload: Record<string, unknown>): string {
  const segment = btoa(JSON.stringify(payload))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `header.${segment}.signature`;
}

const alumnoSinMembresia = {
  id: 7,
  email: 'alumno@test.com',
  nombre: 'Ana',
  apellidos: 'Pérez',
  rol: Rol.ALUMNO,
  validated: false,
  suscripciones: [],
} as unknown as Usuario;

/**
 * Integración real interceptor ↔ MembershipAccessService.
 *
 * El bug crítico: tras un refresh válido, un 403 de membresía en el reintento
 * caía en el catchError del refresh y borraba los tokens, expulsando a un
 * alumno que conserva cursos permanentes. Aquí se comprueba el flujo completo
 * sin mocks del interceptor.
 */
describe('AuthInterceptor — 401 → refresh → 403 de membresía', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let users: { getUserProfile$: jest.Mock };
  let router: { navigate: jest.Mock; url: string };
  let toast: { error: jest.Mock; info: jest.Mock };
  let auth: AuthService;

  beforeEach(() => {
    users = {
      getUserProfile$: jest.fn(
        () => of(alumnoSinMembresia) as Observable<Usuario>,
      ),
    };
    router = {
      navigate: jest.fn(),
      url: '/app/planificacion-fisica',
    };
    toast = { error: jest.fn(), info: jest.fn() };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideMockStore(),
        AuthService,
        MembershipAccessService,
        { provide: UserService, useValue: users },
        { provide: Router, useValue: router },
        { provide: ToastrService, useValue: toast },
        { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);

    sessionStorage.setItem(
      'authToken',
      token({ rol: Rol.ALUMNO, email: 'alumno@test.com', sub: 7 }),
    );
    sessionStorage.setItem('refreshToken', 'refresh-token');
  });

  afterEach(() => {
    httpMock.verify();
    sessionStorage.clear();
    TestBed.resetTestingModule();
  });

  it('conserva tokens, recarga el perfil una vez y va a /app/profile', () => {
    const tokenRenovado = token({
      rol: Rol.ALUMNO,
      email: 'alumno@test.com',
      sub: 7,
    });
    const errors: unknown[] = [];

    http.get(`${environment.apiUrl}/planificacion-fisica/mi-plan`).subscribe({
      error: (error) => errors.push(error),
    });
    httpMock
      .expectOne(`${environment.apiUrl}/planificacion-fisica/mi-plan`)
      .flush(
        { message: 'token expirado' },
        { status: 401, statusText: 'Unauthorized' },
      );

    httpMock
      .expectOne(`${environment.apiUrl}/auth/refresh`)
      .flush({ access_token: tokenRenovado });

    const retry = httpMock.expectOne(
      `${environment.apiUrl}/planificacion-fisica/mi-plan`,
    );
    expect(retry.request.headers.get('Authorization')).toBe(
      `Bearer ${tokenRenovado}`,
    );
    retry.flush(
      {
        reason: 'SUSCRIPCION_REQUERIDA',
        message: 'Tu membresía no está vigente',
      },
      { status: 403, statusText: 'Forbidden' },
    );

    expect(errors).toHaveLength(1);
    expect(users.getUserProfile$).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledWith(['/app/profile']);
    expect(toast.info).toHaveBeenCalledTimes(1);
    expect(toast.info).toHaveBeenCalledWith(
      expect.stringContaining('Tu membresía ya no está activa'),
      'Acceso actualizado',
    );
    expect(sessionStorage.getItem('authToken')).toBe(tokenRenovado);
    expect(sessionStorage.getItem('refreshToken')).toBe('refresh-token');
    expect(httpMock.match(`${environment.apiUrl}/auth/refresh`)).toHaveLength(
      0,
    );
  });

  it('un 403 de otro motivo en el reintento tampoco cierra sesión ni recarga perfil', () => {
    const tokenRenovado = token({
      rol: Rol.ALUMNO,
      email: 'alumno@test.com',
      sub: 7,
    });
    const errors: unknown[] = [];

    http.get(`${environment.apiUrl}/planificacion-fisica/mi-plan`).subscribe({
      error: (error) => errors.push(error),
    });
    httpMock
      .expectOne(`${environment.apiUrl}/planificacion-fisica/mi-plan`)
      .flush(
        { message: 'token expirado' },
        { status: 401, statusText: 'Unauthorized' },
      );
    httpMock
      .expectOne(`${environment.apiUrl}/auth/refresh`)
      .flush({ access_token: tokenRenovado });

    httpMock
      .expectOne(`${environment.apiUrl}/planificacion-fisica/mi-plan`)
      .flush(
        { reason: 'TIER_TOO_LOW', message: 'Plan insuficiente' },
        { status: 403, statusText: 'Forbidden' },
      );

    expect(errors).toHaveLength(1);
    expect(users.getUserProfile$).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(toast.info).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('authToken')).toBe(tokenRenovado);
    expect(sessionStorage.getItem('refreshToken')).toBe('refresh-token');
  });

  it.each([503, 0])(
    'un refresh transitorio (%s) conserva tokens y no manda al login',
    (status) => {
      const tokenOriginal = sessionStorage.getItem('authToken');
      const errors: unknown[] = [];

      http.get(`${environment.apiUrl}/planificacion-fisica/mi-plan`).subscribe({
        error: (error) => errors.push(error),
      });
      httpMock
        .expectOne(`${environment.apiUrl}/planificacion-fisica/mi-plan`)
        .flush(
          { message: 'token expirado' },
          { status: 401, statusText: 'Unauthorized' },
        );

      httpMock.expectOne(`${environment.apiUrl}/auth/refresh`).flush(
        { message: 'BD temporalmente no disponible' },
        {
          status,
          statusText: status === 0 ? 'Unknown Error' : 'Service Unavailable',
        },
      );

      expect(errors).toHaveLength(1);
      expect(sessionStorage.getItem('authToken')).toBe(tokenOriginal);
      expect(sessionStorage.getItem('refreshToken')).toBe('refresh-token');
      expect(router.navigate).not.toHaveBeenCalled();
      expect(users.getUserProfile$).not.toHaveBeenCalled();
      expect(httpMock.match(`${environment.apiUrl}/auth/refresh`)).toHaveLength(
        0,
      );
    },
  );

  it('un refresh inválido 401 sí limpia la sesión sin bucles', () => {
    const errors: unknown[] = [];

    http.get(`${environment.apiUrl}/planificacion-fisica/mi-plan`).subscribe({
      error: (error) => errors.push(error),
    });
    httpMock
      .expectOne(`${environment.apiUrl}/planificacion-fisica/mi-plan`)
      .flush(
        { message: 'token expirado' },
        { status: 401, statusText: 'Unauthorized' },
      );
    httpMock
      .expectOne(`${environment.apiUrl}/auth/refresh`)
      .flush(
        { message: 'refresh inválido' },
        { status: 401, statusText: 'Unauthorized' },
      );

    expect(errors).toHaveLength(1);
    expect(sessionStorage.getItem('authToken')).toBeNull();
    expect(sessionStorage.getItem('refreshToken')).toBeNull();
    expect(auth.getToken()).toBeNull();
    expect(users.getUserProfile$).not.toHaveBeenCalled();
    expect(httpMock.match(`${environment.apiUrl}/auth/refresh`)).toHaveLength(
      0,
    );
  });

  it('un refresh 200 sin access_token limpia la sesión y no reintenta', () => {
    const errors: unknown[] = [];

    http.get(`${environment.apiUrl}/planificacion-fisica/mi-plan`).subscribe({
      error: (error) => errors.push(error),
    });
    httpMock
      .expectOne(`${environment.apiUrl}/planificacion-fisica/mi-plan`)
      .flush(
        { message: 'token expirado' },
        { status: 401, statusText: 'Unauthorized' },
      );
    httpMock
      .expectOne(`${environment.apiUrl}/auth/refresh`)
      .flush({ ok: true });

    expect(errors).toHaveLength(1);
    expect(sessionStorage.getItem('authToken')).toBeNull();
    expect(sessionStorage.getItem('refreshToken')).toBeNull();
    expect(
      httpMock.match(`${environment.apiUrl}/planificacion-fisica/mi-plan`),
    ).toHaveLength(0);
  });
});
