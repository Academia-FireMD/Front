import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ToastrService } from 'ngx-toastr';
import { environment } from '../../../environments/environment';
import {
  CallesZonaResponse,
  Ciudad,
  ResumenProgreso,
  Zona,
} from '../models/callejero.model';
import { loadValenciaFixture } from '../testing/valencia-fixture';
import { CallejeroService } from './callejero.service';

const API = environment.apiUrl;

describe('CallejeroService', () => {
  let service: CallejeroService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ToastrService, useValue: { error: jest.fn() } },
        CallejeroService,
      ],
    });
    service = TestBed.inject(CallejeroService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('GET /callejero/ciudades devuelve las ciudades del backend', () => {
    const { ciudad } = loadValenciaFixture();
    const ciudades: Ciudad[] = [ciudad];
    let received: Ciudad[] | undefined;

    service.listarCiudades().subscribe((c) => (received = c));

    const req = httpMock.expectOne(`${API}/callejero/ciudades`);
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBe(true);
    req.flush(ciudades);

    expect(received).toEqual(ciudades);
    expect(received?.[0].slug).toBe('valencia');
  });

  it('GET /callejero/ciudades/:id/zonas usa el id en la URL', () => {
    const { zonas } = loadValenciaFixture();
    let received: Zona[] | undefined;

    service.listarZonas(1).subscribe((z) => (received = z));

    const req = httpMock.expectOne(`${API}/callejero/ciudades/1/zonas`);
    expect(req.request.method).toBe('GET');
    req.flush(zonas);

    expect(received?.length).toBe(zonas.length);
  });

  it('GET /callejero/zonas/:id/calles devuelve { calles, pois }', () => {
    const fx = loadValenciaFixture();
    const zona = fx.zonaConMasCalles;
    const body: CallesZonaResponse = {
      calles: fx.callesPorZona.get(zona.id) ?? [],
      pois: fx.pois,
    };
    let received: CallesZonaResponse | undefined;

    service.listarCalles(zona.id).subscribe((r) => (received = r));

    httpMock.expectOne(`${API}/callejero/zonas/${zona.id}/calles`).flush(body);

    expect(received?.calles.length).toBeGreaterThan(0);
    expect(received?.pois).toEqual(fx.pois);
  });

  it('POST /callejero/progreso envía { calleId, acierto }', () => {
    let received: ResumenProgreso | void | undefined;
    service
      .registrarProgreso(42, true)
      .subscribe((r) => (received = r as ResumenProgreso));

    const req = httpMock.expectOne(`${API}/callejero/progreso`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ calleId: 42, acierto: true });
    const res: ResumenProgreso = {
      ciudad: { totalCalles: 0, callesDominadas: 0, porcentaje: 0 },
      zonas: [],
    };
    req.flush(res);

    expect(received).toEqual(res);
  });

  it('GET /callejero/ciudades/:id/progreso devuelve el resumen', () => {
    const res: ResumenProgreso = {
      ciudad: { totalCalles: 10, callesDominadas: 3, porcentaje: 30 },
      zonas: [
        {
          zonaId: 1,
          codigo: 'el-carme',
          nombre: 'el Carme',
          totalCalles: 10,
          callesDominadas: 3,
          porcentaje: 30,
        },
      ],
    };
    let received: ResumenProgreso | undefined;

    service.resumenProgreso(1).subscribe((r) => (received = r));

    httpMock.expectOne(`${API}/callejero/ciudades/1/progreso`).flush(res);

    expect(received).toEqual(res);
  });
});
