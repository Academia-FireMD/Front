import { HttpErrorResponse } from '@angular/common/http';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { PlanificacionesService } from './planificaciones.service';

describe('PlanificacionesService: aplicación del catálogo', () => {
  let servicio: PlanificacionesService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    servicio = TestBed.inject(PlanificacionesService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('conserva el estado 409 al guardar una edición', () => {
    let recibido: unknown;
    servicio
      .guardarCambioCatalogo('hash', true, {
        codigo: 'T01',
        nombreCorto: 'Tema',
        color: '#ffffff',
      })
      .subscribe({
        error: (error) => {
          recibido = error;
        },
      });
    const request = http.expectOne((req) =>
      req.url.endsWith('/planificaciones/catalogo-contenido/cambio/apply'),
    );
    expect(request.request.withCredentials).toBe(true);
    request.flush(
      { message: 'Catálogo modificado' },
      { status: 409, statusText: 'Conflict' },
    );
    expect(recibido).toBeInstanceOf(HttpErrorResponse);
    expect((recibido as HttpErrorResponse).status).toBe(409);
  });

  it('conserva el estado 409 al aplicar una importación', () => {
    let recibido: unknown;
    servicio
      .aplicarCatalogo(new File(['fixture'], 'catalogo.xlsx'), 'hash', true)
      .subscribe({
        error: (error) => {
          recibido = error;
        },
      });
    const request = http.expectOne((req) =>
      req.url.endsWith('/planificaciones/catalogo-contenido/importar/apply'),
    );
    request.flush(
      { message: 'Catálogo modificado' },
      { status: 409, statusText: 'Conflict' },
    );
    expect((recibido as HttpErrorResponse).status).toBe(409);
  });
});
