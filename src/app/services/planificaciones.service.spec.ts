import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { PlanificacionesService } from './planificaciones.service';

describe('PlanificacionesService', () => {
  let service: PlanificacionesService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        PlanificacionesService,
      ],
    });
    service = TestBed.inject(PlanificacionesService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('POST convertir-bloques-fisica usa la ruta exacta y conserva desmarcados', () => {
    const respuesta = {
      actualizados: 1,
      ignorados: 2,
      sinCoincidencia: 3,
      desmarcados: 4,
    };
    let recibida:
      | {
          actualizados: number;
          ignorados: number;
          sinCoincidencia: number;
          desmarcados?: number;
        }
      | undefined;

    service
      .convertirBloquesFisica$(207)
      .subscribe((resultado) => (recibida = resultado));

    const request = httpMock.expectOne(
      `${environment.apiUrl}/planificaciones/planificacion-mensual/207/convertir-bloques-fisica`,
    );
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({});
    expect(request.request.withCredentials).toBe(true);
    request.flush(respuesta);

    expect(recibida).toEqual(respuesta);
  });

  it('GET buscarCatalogoContenido envía el query codificado', () => {
    const respuesta = [
      { id: 1, codigo: 'T01', nombreCorto: 'Tema 1', color: '#ff0000' },
    ];
    let recibida: any;

    service.buscarCatalogoContenido('T 01').subscribe((r) => (recibida = r));

    const request = httpMock.expectOne(
      `${environment.apiUrl}/planificaciones/catalogo-contenido/buscar?q=T%2001`,
    );
    expect(request.request.method).toBe('GET');
    request.flush(respuesta);

    expect(recibida).toEqual(respuesta);
  });

  it('POST componerContenidoCatalogo envía código y tipo de trabajo', () => {
    const respuesta = {
      codigo: 'T01',
      nombre: 'Tema 1 compuesto',
      color: '#ff0000',
      comentarios: 'Comentarios',
    };
    let recibida: any;

    service
      .componerContenidoCatalogo('T01', 'R1')
      .subscribe((r) => (recibida = r));

    const request = httpMock.expectOne(
      `${environment.apiUrl}/planificaciones/catalogo-contenido/componer`,
    );
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ codigo: 'T01', tipoTrabajo: 'R1' });
    expect(request.request.withCredentials).toBe(true);
    request.flush(respuesta);

    expect(recibida).toEqual(respuesta);
  });

  it('POST componerContenidoCatalogo permite llamar sin tipo de trabajo', () => {
    const respuesta = {
      codigo: 'T01',
      nombre: 'Tema 1 compuesto',
      color: '#ff0000',
      comentarios: 'Comentarios',
    };
    let recibida: any;

    service.componerContenidoCatalogo('T01').subscribe((r) => (recibida = r));

    const request = httpMock.expectOne(
      `${environment.apiUrl}/planificaciones/catalogo-contenido/componer`,
    );
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      codigo: 'T01',
      tipoTrabajo: undefined,
    });
    request.flush(respuesta);

    expect(recibida).toEqual(respuesta);
  });
});
