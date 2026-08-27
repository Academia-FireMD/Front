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
import { environment } from '../../environments/environment';
import { AuthInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';

describe('AuthInterceptor', () => {
  let httpMock: HttpTestingController;
  let http: HttpClient;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideMockStore(),
        AuthService,
        { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
        { provide: ToastrService, useValue: { error: jest.fn() } },
        { provide: Router, useValue: { navigate: jest.fn() } },
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    sessionStorage.clear();
  });

  it('comparte un refresh entre dos 401 y reintenta cada request una vez', () => {
    sessionStorage.setItem('authToken', 'stale-token');
    sessionStorage.setItem('refreshToken', 'refresh-token');
    const received: unknown[] = [];

    http
      .get(`${environment.apiUrl}/protected-a`)
      .subscribe((value) => received.push(value));
    http
      .get(`${environment.apiUrl}/protected-b`)
      .subscribe((value) => received.push(value));

    const initial = httpMock.match((request) =>
      /protected-[ab]$/.test(request.url),
    );
    expect(initial).toHaveLength(2);
    expect(
      initial.every(
        (request) =>
          request.request.headers.get('Authorization') === 'Bearer stale-token',
      ),
    ).toBe(true);
    initial.forEach((request) =>
      request.flush(
        { message: 'expired' },
        { status: 401, statusText: 'Unauthorized' },
      ),
    );

    const refresh = httpMock.match(`${environment.apiUrl}/auth/refresh`);
    expect(refresh).toHaveLength(1);
    refresh[0].flush({ access_token: 'fresh-token' });

    const retries = httpMock.match((request) =>
      /protected-[ab]$/.test(request.url),
    );
    expect(retries).toHaveLength(2);
    expect(
      retries.every(
        (request) =>
          request.request.headers.get('Authorization') === 'Bearer fresh-token',
      ),
    ).toBe(true);
    retries[0].flush({ ok: 'a' });
    retries[1].flush({ ok: 'b' });

    expect(received).toHaveLength(2);
  });

  it('no reentra en refresh si falla el propio endpoint /auth/refresh', () => {
    sessionStorage.setItem('authToken', 'stale-token');
    sessionStorage.setItem('refreshToken', 'refresh-token');
    const errors: unknown[] = [];

    http.get(`${environment.apiUrl}/protected`).subscribe({
      error: (error) => errors.push(error),
    });
    httpMock
      .expectOne(`${environment.apiUrl}/protected`)
      .flush(
        { message: 'expired' },
        { status: 401, statusText: 'Unauthorized' },
      );

    const refresh = httpMock.expectOne(`${environment.apiUrl}/auth/refresh`);
    expect(refresh.request.headers.get('Authorization')).toBe(
      'Bearer stale-token',
    );
    refresh.flush(
      { message: 'refresh expired' },
      { status: 401, statusText: 'Unauthorized' },
    );

    expect(errors).toHaveLength(1);
    expect(httpMock.match(`${environment.apiUrl}/auth/refresh`)).toHaveLength(
      0,
    );
  });

  it('no añade Bearer null ni reintenta si refresh no devuelve access token', () => {
    sessionStorage.removeItem('authToken');
    sessionStorage.setItem('refreshToken', 'refresh-token');
    const requestHeaders: string[] = [];
    const errors: unknown[] = [];

    http.get(`${environment.apiUrl}/protected`).subscribe({
      error: (error) => errors.push(error),
    });
    const initial = httpMock.expectOne(`${environment.apiUrl}/protected`);
    requestHeaders.push(initial.request.headers.get('Authorization') ?? '');
    initial.flush(
      { message: 'expired' },
      { status: 401, statusText: 'Unauthorized' },
    );
    httpMock
      .expectOne(`${environment.apiUrl}/auth/refresh`)
      .flush({ ok: true });

    expect(requestHeaders).toEqual(['']);
    expect(errors).toHaveLength(1);
    expect(httpMock.match(`${environment.apiUrl}/protected`)).toHaveLength(0);
  });
});
