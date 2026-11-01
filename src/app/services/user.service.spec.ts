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
import { AuthSessionService } from './auth-session.service';
import { UserService } from './user.service';

describe('UserService — perfil single-flight', () => {
  let service: UserService;
  let httpMock: HttpTestingController;
  let sessions: AuthSessionService;

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
    sessions = TestBed.inject(AuthSessionService);
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

  it('una renovación de token dentro de la misma sesión conserva el single-flight', () => {
    sessions.start({ sub: 7, isImpersonating: false });
    service.getUserProfile$().subscribe();

    sessions.continueSession({ sub: 7, isImpersonating: false });
    service.getUserProfile$().subscribe();

    expect(httpMock.match(`${environment.apiUrl}/user/profile`)).toHaveLength(
      1,
    );
  });

  it('B no comparte el perfil en vuelo de A y la respuesta de A no llega a B', () => {
    sessions.start({ sub: 1, isImpersonating: false });
    const recibidosA: Usuario[] = [];
    const recibidosB: Usuario[] = [];
    service.getUserProfile$().subscribe((user) => recibidosA.push(user));
    const perfilA = httpMock.expectOne(`${environment.apiUrl}/user/profile`);

    sessions.start({ sub: 2, isImpersonating: false });
    service.getUserProfile$().subscribe((user) => recibidosB.push(user));
    const perfilB = httpMock.expectOne(`${environment.apiUrl}/user/profile`);

    perfilA.flush({ ...usuario, id: 1 });
    expect(recibidosA).toEqual([expect.objectContaining({ id: 1 })]);
    expect(recibidosB).toEqual([]);

    perfilB.flush({ ...usuario, id: 2 });
    expect(recibidosB).toEqual([expect.objectContaining({ id: 2 })]);
  });

  it('re-login del mismo usuario abre una sesión nueva y pide otro perfil', () => {
    sessions.start({ sub: 7, isImpersonating: false });
    service.getUserProfile$().subscribe();
    const primerPerfil = httpMock.match(`${environment.apiUrl}/user/profile`);
    expect(primerPerfil).toHaveLength(1);

    sessions.start({ sub: 7, isImpersonating: false });
    service.getUserProfile$().subscribe();
    const segundoPerfil = httpMock.match(`${environment.apiUrl}/user/profile`);
    expect(segundoPerfil).toHaveLength(1);

    primerPerfil[0].flush(usuario);
    segundoPerfil[0].flush(usuario);
  });

  it('finalizar la petición vieja no borra el slot en vuelo de la sesión nueva', () => {
    sessions.start({ sub: 1, isImpersonating: false });
    service.getUserProfile$().subscribe({ error: () => undefined });
    const perfilA = httpMock.expectOne(`${environment.apiUrl}/user/profile`);

    sessions.start({ sub: 2, isImpersonating: false });
    const recibidosB: Usuario[] = [];
    service.getUserProfile$().subscribe((user) => recibidosB.push(user));
    const perfilB = httpMock.expectOne(`${environment.apiUrl}/user/profile`);

    perfilA.flush({ ...usuario, id: 1 });

    service.getUserProfile$().subscribe();
    expect(httpMock.match(`${environment.apiUrl}/user/profile`)).toHaveLength(
      0,
    );

    perfilB.flush({ ...usuario, id: 2 });
    expect(recibidosB).toEqual([expect.objectContaining({ id: 2 })]);
  });

  it('el error de la petición vieja no borra el slot en vuelo de B', () => {
    sessions.start({ sub: 1, isImpersonating: false });
    service.getUserProfile$().subscribe({ error: () => undefined });
    const perfilA = httpMock.expectOne(`${environment.apiUrl}/user/profile`);

    sessions.start({ sub: 2, isImpersonating: false });
    service.getUserProfile$().subscribe({ error: () => undefined });
    httpMock.expectOne(`${environment.apiUrl}/user/profile`);

    perfilA.flush(
      { message: 'red caída' },
      { status: 503, statusText: 'Service Unavailable' },
    );

    service.getUserProfile$().subscribe();
    expect(httpMock.match(`${environment.apiUrl}/user/profile`)).toHaveLength(
      0,
    );
  });
});
