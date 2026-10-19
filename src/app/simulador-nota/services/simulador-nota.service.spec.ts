import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { SimuladorNotaSnapshot } from '../models/simulador-nota.model';
import { SimuladorNotaService } from './simulador-nota.service';

describe('SimuladorNotaService', () => {
  let service: SimuladorNotaService;
  let http: HttpTestingController;
  const endpoint = `${environment.apiUrl}/simulador-nota/mi-estado`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        SimuladorNotaService,
      ],
    });
    service = TestBed.inject(SimuladorNotaService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('carga el estado con GET y credenciales del padre autenticado', () => {
    const response = { revision: 0, estado: null, actualizadoEn: null };
    let recibido: unknown;

    service.cargar().subscribe((estado) => (recibido = estado));

    const request = http.expectOne(endpoint);
    expect(request.request.method).toBe('GET');
    expect(request.request.withCredentials).toBe(true);
    request.flush(response);
    expect(recibido).toEqual(response);
  });

  it('guarda el snapshot con control de revisión CAS', () => {
    const estado: SimuladorNotaSnapshot = {
      v: 1,
      actual: { ambito: 'cv' },
      guardadas: [],
      tab: 'examenes',
      plazas: {},
    };
    let recibido: unknown;

    service.guardar(4, estado).subscribe((res) => (recibido = res));

    const request = http.expectOne(endpoint);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ revision: 4, estado });
    expect(request.request.withCredentials).toBe(true);
    request.flush({ revision: 5, estado, actualizadoEn: '2026-10-19T12:00:00.000Z' });
    expect(recibido).toEqual({
      revision: 5,
      estado,
      actualizadoEn: '2026-10-19T12:00:00.000Z',
    });
  });

  it('borra con DELETE condicional y no simula un PUT vacío', () => {
    const response = { revision: 6, estado: null, actualizadoEn: null };
    let recibido: unknown;

    service.borrar(5).subscribe((res) => (recibido = res));

    const request = http.expectOne(endpoint);
    expect(request.request.method).toBe('DELETE');
    expect(request.request.body).toEqual({ revision: 5 });
    expect(request.request.withCredentials).toBe(true);
    request.flush(response);
    expect(recibido).toEqual(response);
  });
});
