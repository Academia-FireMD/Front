import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { UserService } from './user.service';

describe('UserService administrative detail', () => {
  let service: UserService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(UserService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('gets the typed administrative detail by id', () => {
    service.getAdminUserDetail$(42).subscribe((detail) => {
      expect(detail.id).toBe(42);
      expect(detail.cantidadPlanificaciones).toBe(2);
    });
    const request = http.expectOne(`${environment.apiUrl}/user/admin/42`);
    expect(request.request.method).toBe('GET');
    request.flush({ id: 42, nombre: 'Ana', cantidadPlanificaciones: 2 });
  });

  it('re-emits el HttpErrorResponse original para que la ficha distinga 404 de 5xx', () => {
    service.getAdminUserDetail$(404).subscribe({
      error: (err: any) => {
        expect(err).toBeInstanceOf(HttpErrorResponse);
        expect(err.status).toBe(404);
      },
    });
    const request = http.expectOne(`${environment.apiUrl}/user/admin/404`);
    request.flush(
      { message: 'No encontrado' },
      { status: 404, statusText: 'Not Found' },
    );
  });

  it('re-emite también los 5xx con su status (no los aplana a Error)', () => {
    service.getAdminUserDetail$(500).subscribe({
      error: (err: any) => {
        expect(err).toBeInstanceOf(HttpErrorResponse);
        expect(err.status).toBe(500);
      },
    });
    const request = http.expectOne(`${environment.apiUrl}/user/admin/500`);
    request.flush(
      { message: 'Error interno' },
      { status: 500, statusText: 'Server Error' },
    );
  });
});
