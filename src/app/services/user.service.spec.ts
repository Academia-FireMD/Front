import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { Rol, Usuario } from '../shared/models/user.model';
import { UserService } from './user.service';

describe('UserService — perfil single-flight', () => {
  let service: UserService;
  let httpMock: HttpTestingController;

  const usuario = {
    id: 7,
    email: 'alumno@test.com',
    rol: Rol.ALUMNO,
    suscripciones: [],
  } as unknown as Usuario;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        UserService,
        { provide: Router, useValue: { navigate: jest.fn() } },
        { provide: ToastrService, useValue: { error: jest.fn() } },
      ],
    });
    service = TestBed.inject(UserService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    TestBed.resetTestingModule();
  });

  it('dos recargas concurrentes comparten una sola petición GET /user/profile', async () => {
    const primera = firstValueFrom(service.getUserProfile$());
    const segunda = firstValueFrom(service.getUserProfile$());

    const requests = httpMock.match(`${environment.apiUrl}/user/profile`);
    expect(requests).toHaveLength(1);
    requests[0].flush(usuario);

    await expect(primera).resolves.toBe(usuario);
    await expect(segunda).resolves.toBe(usuario);
  });

  it('libera el single-flight tras completar y permite una recarga posterior', async () => {
    const primera = firstValueFrom(service.getUserProfile$());
    httpMock.expectOne(`${environment.apiUrl}/user/profile`).flush(usuario);
    await primera;

    const segunda = firstValueFrom(service.getUserProfile$());
    httpMock.expectOne(`${environment.apiUrl}/user/profile`).flush(usuario);
    await expect(segunda).resolves.toBe(usuario);
  });

  it('libera el single-flight si la petición falla', async () => {
    const primera = firstValueFrom(service.getUserProfile$()).catch(
      (error) => error,
    );
    httpMock
      .expectOne(`${environment.apiUrl}/user/profile`)
      .flush(
        { message: 'red caída' },
        { status: 503, statusText: 'Service Unavailable' },
      );
    await primera;

    const segunda = firstValueFrom(service.getUserProfile$());
    httpMock.expectOne(`${environment.apiUrl}/user/profile`).flush(usuario);
    await expect(segunda).resolves.toBe(usuario);
  });
});
