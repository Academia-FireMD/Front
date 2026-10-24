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
