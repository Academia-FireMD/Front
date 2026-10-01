import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ToastrService } from 'ngx-toastr';
import { environment } from '../../../environments/environment';
import { NivelOposicion } from '../../shared/models/pregunta.model';
import { Oposicion } from '../../shared/models/subscription.model';
import { TipoDePlanificacionDeseada } from '../../shared/models/user.model';
import type { GuardarConfiguracionDTO } from '../models/autoasignacion.model';
import { AutoasignacionService } from './autoasignacion.service';

describe('AutoasignacionService', () => {
  let service: AutoasignacionService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        AutoasignacionService,
        { provide: ToastrService, useValue: { error: jest.fn() } },
      ],
    });
    service = TestBed.inject(AutoasignacionService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('consulta estado y cuestionario sin modificar nada', () => {
    service.getConfiguracion$().subscribe();
    const estado = http.expectOne(`${environment.apiUrl}/planificaciones/configuracion`);
    expect(estado.request.method).toBe('GET');
    expect(estado.request.withCredentials).toBe(true);
    estado.flush({ opcionesPermitidas: [] });

    service.getCuestionarioNivel$().subscribe();
    const cuestionario = http.expectOne(`${environment.apiUrl}/planificaciones/cuestionario-nivel`);
    expect(cuestionario.request.method).toBe('GET');
    cuestionario.flush({ version: 2, preguntas: [] });
  });

  it('la recomendación solo calcula y no llama al guardado', () => {
    service.recomendarNivel$([0, 1, 2, 3, 0], 2).subscribe();
    const peticion = http.expectOne(`${environment.apiUrl}/planificaciones/recomendacion-nivel`);
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({
      respuestas: [0, 1, 2, 3, 0], versionCuestionario: 2,
    });
    peticion.flush({ nivelRecomendado: NivelOposicion.INICIACION, puntuacion: 6 });
    http.expectNone(`${environment.apiUrl}/planificaciones/configuracion`, 'PUT');
  });

  it('confirma con snapshot, plan esperado y consentimiento de reemplazo', () => {
    const body: GuardarConfiguracionDTO = {
      oposicion: Oposicion.VALENCIA_AYUNTAMIENTO,
      nivel: NivelOposicion.AVANZADO,
      franja: TipoDePlanificacionDeseada.FRANJA_CUATRO_A_SEIS_HORAS,
      version: 0,
      planificacionIdEsperada: 203,
      estadoPrevioHash: 'a'.repeat(64),
      confirmarReemplazo: true,
      respuestasTest: [1, 2, 2, 1, 2],
    };
    service.guardarConfiguracion$(body).subscribe();
    const peticion = http.expectOne(`${environment.apiUrl}/planificaciones/configuracion`);
    expect(peticion.request.method).toBe('PUT');
    expect(peticion.request.body).toEqual(body);
    expect(peticion.request.withCredentials).toBe(true);
    peticion.flush({ estado: 'ACTIVA' });
  });

  it('propaga el conflicto 409 para recargar el estado', () => {
    const errores: HttpErrorResponse[] = [];
    service.guardarConfiguracion$({} as GuardarConfiguracionDTO)
      .subscribe({ error: (err) => { errores.push(err); } });
    http.expectOne(`${environment.apiUrl}/planificaciones/configuracion`)
      .flush({}, { status: 409, statusText: 'Conflict' });
    expect(errores[0].status).toBe(409);
  });
});
