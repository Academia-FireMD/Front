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
});
