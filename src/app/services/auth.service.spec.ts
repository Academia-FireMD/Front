import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Observable } from 'rxjs';
import { Router } from '@angular/router';
import { provideMockStore } from '@ngrx/store/testing';
import { ToastrService } from 'ngx-toastr';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

function token(payload: Record<string, unknown>): string {
  const json = JSON.stringify(payload);
  const binary = encodeURIComponent(json).replace(/%([0-9A-F]{2})/g, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16)),
  );
  const segment = btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `header.${segment}.signature`;
}

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideMockStore(),
        AuthService,
        { provide: ToastrService, useValue: { error: jest.fn() } },
        { provide: Router, useValue: { navigate: jest.fn() } },
      ],
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    sessionStorage.clear();
  });

  it('coalesce dos refresh concurrentes en un único POST', () => {
    service.setRefreshToken('refresh-token');
    const received: unknown[] = [];

    service.refreshToken$().subscribe((value) => received.push(value));
    service.refreshToken$().subscribe((value) => received.push(value));

    const requests = httpMock.match(`${environment.apiUrl}/auth/refresh`);
    expect(requests).toHaveLength(1);
    expect(requests[0].request.method).toBe('POST');
    expect(requests[0].request.body).toEqual({
      refresh_token: 'refresh-token',
    });

    const response = { access_token: 'fresh-token' };
    requests[0].flush(response);

    expect(received).toEqual([response, response]);
    expect(service.getToken()).toBe('fresh-token');
  });

  it('libera el coalescer después de un error', () => {
    service.setRefreshToken('refresh-token');
    service.refreshToken$().subscribe({ error: () => undefined });

    httpMock
      .expectOne(`${environment.apiUrl}/auth/refresh`)
      .flush(
        { message: 'expired' },
        { status: 401, statusText: 'Unauthorized' },
      );

    service.refreshToken$().subscribe({ error: () => undefined });
    expect(httpMock.match(`${environment.apiUrl}/auth/refresh`)).toHaveLength(
      1,
    );
  });

  it('descarta un refresh que termina después del logout y no restaura la sesión', () => {
    const tokenA = token({ sub: 1, email: 'a@test.com' });
    service.setToken(tokenA);
    service.setRefreshToken('refresh-A');
    service.refreshToken$().subscribe({ error: () => undefined });
    const refreshA = httpMock.expectOne(`${environment.apiUrl}/auth/refresh`);

    service.logout$().subscribe();
    expect(service.getToken()).toBeNull();

    refreshA.flush({ access_token: token({ sub: 1, email: 'a@test.com' }) });

    expect(service.getToken()).toBeNull();
    expect(service.getRefreshToken()).toBeNull();
    expect(service.lastUserLoaded).toBeNull();
  });

  it('inicia un refresh independiente para B y descarta la respuesta tardía de A', () => {
    const tokenA = token({ sub: 1, email: 'a@test.com' });
    const tokenB = token({ sub: 2, email: 'b@test.com' });
    service.setToken(tokenA);
    service.setRefreshToken('refresh-A');
    service.refreshToken$().subscribe({ error: () => undefined });
    const refreshA = httpMock.expectOne(`${environment.apiUrl}/auth/refresh`);

    service.logout$().subscribe();
    service.login$('b@test.com', 'secret').subscribe();
    httpMock.expectOne(`${environment.apiUrl}/auth/login`).flush({
      access_token: tokenB,
      refresh_token: 'refresh-B',
    });

    let respuestaB: string | undefined;
    service.refreshToken$().subscribe((tokens) => {
      respuestaB = tokens.access_token;
    });
    const refreshB = httpMock.expectOne(`${environment.apiUrl}/auth/refresh`);
    expect(refreshB.request.body).toEqual({ refresh_token: 'refresh-B' });

    refreshA.flush({ access_token: token({ sub: 1, email: 'a@test.com' }) });
    expect(service.getToken()).toBe(tokenB);

    refreshB.flush({ access_token: token({ sub: 2, email: 'b@test.com' }) });
    expect(respuestaB).toBe(token({ sub: 2, email: 'b@test.com' }));
    expect(service.getToken()).toBe(token({ sub: 2, email: 'b@test.com' }));
  });

  it('trata un re-login del mismo usuario como una sesión nueva', () => {
    const tokenA = token({ sub: 1, email: 'a@test.com' });
    service.setToken(tokenA);
    service.setRefreshToken('refresh-A1');
    service.refreshToken$().subscribe({ error: () => undefined });
    const refreshViejo = httpMock.expectOne(
      `${environment.apiUrl}/auth/refresh`,
    );

    service.logout$().subscribe();
    service.login$('a@test.com', 'secret').subscribe();
    httpMock.expectOne(`${environment.apiUrl}/auth/login`).flush({
      access_token: tokenA,
      refresh_token: 'refresh-A2',
    });

    service.refreshToken$().subscribe({ error: () => undefined });
    const refreshNuevo = httpMock.expectOne(
      `${environment.apiUrl}/auth/refresh`,
    );
    expect(refreshNuevo.request.body).toEqual({ refresh_token: 'refresh-A2' });

    refreshViejo.flush({
      access_token: token({ sub: 1, email: 'a@test.com' }),
    });
    expect(service.getRefreshToken()).toBe('refresh-A2');
  });

  it('salir de impersonación invalida un refresh pendiente de la sesión suplantada', () => {
    const tokenSuplantado = token({
      sub: 52,
      email: 'alumno@test.com',
      isImpersonating: true,
    });
    const tokenAdmin = token({ sub: 1, email: 'admin@test.com' });
    service.setToken(tokenSuplantado);
    service.setRefreshToken('refresh-impersonado');
    service.refreshToken$().subscribe({ error: () => undefined });
    const refreshSuplantado = httpMock.expectOne(
      `${environment.apiUrl}/auth/refresh`,
    );

    service.stopImpersonation$().subscribe();
    httpMock.expectOne(`${environment.apiUrl}/auth/stop-impersonation`).flush({
      access_token: tokenAdmin,
      refresh_token: 'refresh-admin',
    });

    refreshSuplantado.flush({ access_token: tokenSuplantado });

    expect(service.getToken()).toBe(tokenAdmin);
    expect(service.getRefreshToken()).toBe('refresh-admin');
    expect(service.isImpersonating()).toBe(false);
  });

  it('una respuesta de login que llega tras el logout no restaura la sesión', () => {
    service
      .login$('a@test.com', 'secret')
      .subscribe({ error: () => undefined });
    const loginA = httpMock.expectOne(`${environment.apiUrl}/auth/login`);

    service.logout$().subscribe();
    loginA.flush({
      access_token: token({ sub: 1, email: 'a@test.com' }),
      refresh_token: 'refresh-A',
    });

    expect(service.getToken()).toBeNull();
    expect(service.getRefreshToken()).toBeNull();
    expect(service.lastUserLoaded).toBeNull();
  });

  it('un login A que termina después del login B no sustituye la sesión de B', () => {
    service
      .login$('a@test.com', 'secret')
      .subscribe({ error: () => undefined });
    service.login$('b@test.com', 'secret').subscribe();
    const logins = httpMock.match(`${environment.apiUrl}/auth/login`);
    expect(logins).toHaveLength(2);

    const tokenB = token({ sub: 2, email: 'b@test.com' });
    logins[1].flush({ access_token: tokenB, refresh_token: 'refresh-B' });
    expect(service.getToken()).toBe(tokenB);

    logins[0].flush({
      access_token: token({ sub: 1, email: 'a@test.com' }),
      refresh_token: 'refresh-A',
    });

    expect(service.getToken()).toBe(tokenB);
    expect(service.getRefreshToken()).toBe('refresh-B');
  });

  it('entrar en impersonación invalida un refresh pendiente del administrador', () => {
    const tokenAdmin = token({ sub: 1, email: 'admin@test.com' });
    const tokenSuplantado = token({
      sub: 52,
      email: 'alumno@test.com',
      isImpersonating: true,
    });
    service.setToken(tokenAdmin);
    service.setRefreshToken('refresh-admin');
    service.refreshToken$().subscribe({ error: () => undefined });
    const refreshAdmin = httpMock.expectOne(
      `${environment.apiUrl}/auth/refresh`,
    );

    service.impersonateUser$(52).subscribe();
    httpMock.expectOne(`${environment.apiUrl}/auth/impersonate/52`).flush({
      access_token: tokenSuplantado,
      refresh_token: 'refresh-impersonado',
    });

    refreshAdmin.flush({ access_token: tokenAdmin });

    expect(service.getToken()).toBe(tokenSuplantado);
    expect(service.getRefreshToken()).toBe('refresh-impersonado');
    expect(service.isImpersonating()).toBe(true);
  });

  it('clearToken publica la identidad vacía para que los consumidores se reseteen', () => {
    const identidades: ({ sub: unknown } | null)[] = [];
    service.currentIdentity$.subscribe((identity) =>
      identidades.push(identity),
    );

    service.login$('alumno@test.com', 'secret').subscribe();
    httpMock.expectOne(`${environment.apiUrl}/auth/login`).flush({
      access_token: token({ sub: 52, email: 'alumno@test.com' }),
      refresh_token: 'refresh-alumno',
    });
    expect(identidades.at(-1)).toEqual(expect.objectContaining({ sub: 52 }));

    service.clearToken();

    expect(identidades.at(-1)).toBeNull();
    expect(service.getToken()).toBeNull();
    expect(service.getRefreshToken()).toBeNull();
  });

  it('emite identidad del token síncronamente sin esperar el perfil y conserva refresh del mismo sujeto', () => {
    const currentIdentity$ = Reflect.get(service, 'currentIdentity$') as
      | Observable<{ sub: unknown; isImpersonating: boolean } | null>
      | undefined;
    expect(currentIdentity$).toBeDefined();
    const identities: ({ sub: unknown; isImpersonating: boolean } | null)[] =
      [];
    currentIdentity$!.subscribe((identity) => identities.push(identity));

    service.login$('alumno@test.com', 'secret').subscribe();
    httpMock.expectOne(`${environment.apiUrl}/auth/login`).flush({
      access_token: token({
        sub: 52,
        isImpersonating: true,
        email: 'alumno@test.com',
      }),
      refresh_token: 'refresh-alumno',
    });
    expect(identities).toEqual([null, { sub: 52, isImpersonating: true }]);

    service.stopImpersonation$().subscribe();
    httpMock.expectOne(`${environment.apiUrl}/auth/stop-impersonation`).flush({
      access_token: token({
        sub: 1,
        isImpersonating: false,
        email: 'admin@test.com',
      }),
      refresh_token: 'refresh-admin',
    });
    expect(identities).toEqual([
      null,
      { sub: 52, isImpersonating: true },
      { sub: 1, isImpersonating: false },
    ]);

    service.refreshToken$().subscribe();
    httpMock.expectOne(`${environment.apiUrl}/auth/refresh`).flush({
      access_token: token({
        sub: 1,
        isImpersonating: false,
        email: 'admin@test.com',
        exp: 2,
      }),
    });
    expect(identities).toEqual([
      null,
      { sub: 52, isImpersonating: true },
      { sub: 1, isImpersonating: false },
    ]);
  });
});
