import { HttpClient, provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Injectable } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiBaseService, ApiRequestError } from './api-base.service';

@Injectable()
class ApiBaseServiceTest extends ApiBaseService {
  constructor(http: HttpClient) {
    super(http);
    this.controllerPrefix = '/test';
  }

  cargar() {
    return this.get('/recurso');
  }
}

describe('ApiBaseService — manejo de errores', () => {
  let service: ApiBaseServiceTest;
  let httpMock: HttpTestingController;
  let router: { navigate: jest.Mock };
  let toast: { error: jest.Mock };

  beforeEach(() => {
    router = { navigate: jest.fn() };
    toast = { error: jest.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ApiBaseServiceTest,
        { provide: Router, useValue: router },
        { provide: ToastrService, useValue: toast },
      ],
    });
    service = TestBed.inject(ApiBaseServiceTest);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    TestBed.resetTestingModule();
  });

  it('un 403 arbitrario NO manda al login y conserva status/reason', async () => {
    const promesa = firstValueFrom(service.cargar());
    httpMock
      .expectOne(`${environment.apiUrl}/test/recurso`)
      .flush(
        { reason: 'TIER_TOO_LOW', message: 'Plan insuficiente' },
        { status: 403, statusText: 'Forbidden' },
      );

    const error = (await promesa.catch((err) => err)) as ApiRequestError;
    expect(error).toBeInstanceOf(Error);
    expect(error.status).toBe(403);
    expect(error.reason).toBe('TIER_TOO_LOW');
    expect(router.navigate).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('Plan insuficiente');
  });

  it('un 403 SUSCRIPCION_REQUERIDA no duplica el toast genérico', async () => {
    const promesa = firstValueFrom(service.cargar());
    httpMock.expectOne(`${environment.apiUrl}/test/recurso`).flush(
      {
        reason: 'SUSCRIPCION_REQUERIDA',
        message: 'Tu membresía no está vigente',
      },
      { status: 403, statusText: 'Forbidden' },
    );

    await promesa.catch(() => undefined);
    expect(toast.error).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('un 401 sin refresh válido sí vuelve al login', async () => {
    const promesa = firstValueFrom(service.cargar());
    httpMock
      .expectOne(`${environment.apiUrl}/test/recurso`)
      .flush(
        { message: 'Sesión expirada' },
        { status: 401, statusText: 'Unauthorized' },
      );

    await promesa.catch(() => undefined);
    expect(router.navigate).toHaveBeenCalledWith(['/auth']);
    expect(toast.error).toHaveBeenCalledWith('Sesión expirada');
  });
});
