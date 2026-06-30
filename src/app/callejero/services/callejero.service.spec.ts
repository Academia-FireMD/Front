import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ToastrService } from 'ngx-toastr';
import { environment } from '../../../environments/environment';
import {
  CalleCiudad,
  CalleModificada,
  CallesZonaResponse,
  Ciudad,
  GeocodeBuscarItem,
  GenerarExamenResponse,
  RecorridoLibreResponse,
  RecorridoResponse,
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

  // ── Recorridos (Callejero v10) ────────────────────────────────────────────

  it('GET /callejero/recorrido?calleId= devuelve el recorrido publicado', () => {
    const rec: RecorridoResponse = {
      polyline: {
        type: 'LineString',
        coordinates: [
          [-0.37, 39.47],
          [-0.36, 39.46],
        ],
      },
      calles: ['Av. del Cid', 'Calle Colón'],
      km: 2.4,
      minutos: 6,
      estacion: { nombre: 'Parque Campanar', lat: 39.48, lng: -0.38 },
    };
    let received: RecorridoResponse | undefined;

    service.getRecorrido(99).subscribe((r) => (received = r));

    const req = httpMock.expectOne(`${API}/callejero/recorrido?calleId=99`);
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBe(true);
    req.flush(rec);

    expect(received).toEqual(rec);
    expect(received?.calles.length).toBe(2);
  });

  // ── Recorrido "dirección libre" (Callejero v27) ───────────────────────────

  it('GET /callejero/recorrido-libre codifica ciudadId + q y devuelve la ruta', () => {
    const rec: RecorridoLibreResponse = {
      direccionResuelta: 'Calle de Colón 12, València',
      lat: 39.4699,
      lng: -0.3712,
      parqueNombre: 'Centro',
      estacion: { nombre: 'Parque Centro', lat: 39.4665, lng: -0.3759 },
      polyline: [
        [39.4665, -0.3759],
        [39.4699, -0.3712],
      ],
      km: 1.4,
      minutos: 4,
    };
    let received: RecorridoLibreResponse | undefined;

    service.getRecorridoLibre(1, 'Calle Colón 12').subscribe((r) => {
      received = r;
    });

    const req = httpMock.expectOne(
      `${API}/callejero/recorrido-libre?ciudadId=1&q=Calle%20Col%C3%B3n%2012`,
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBe(true);
    req.flush(rec);

    expect(received).toEqual(rec);
  });

  it('GET /callejero/recorrido-libre propaga el error crudo (code) sin toast (404 NO_GEOCODE)', () => {
    const toast = TestBed.inject(ToastrService) as unknown as {
      error: jest.Mock;
    };
    let err: { status?: number; error?: { code?: string } } | undefined;

    service.getRecorridoLibre(1, 'no existe').subscribe({
      next: () => fail('no debería emitir'),
      error: (e) => (err = e),
    });

    httpMock
      .expectOne(`${API}/callejero/recorrido-libre?ciudadId=1&q=no%20existe`)
      .flush({ code: 'NO_GEOCODE' }, { status: 404, statusText: 'Not Found' });

    // El error llega íntegro (status + code), no colapsado a Error(message).
    expect(err?.status).toBe(404);
    expect(err?.error?.code).toBe('NO_GEOCODE');
    // Sin toast genérico: el padre gobierna el estado (D7).
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('generarExamen sin tipo envía tipoExamen MIXTO (default, no rompe firma)', () => {
    let received: GenerarExamenResponse | undefined;
    service.generarExamen(1, [2, 3]).subscribe((r) => (received = r));

    const req = httpMock.expectOne(`${API}/callejero/examen/generar`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      ciudadId: 1,
      zonaIds: [2, 3],
      tipoExamen: 'MIXTO',
      dificultad: 'MEDIO',
    });
    const res: GenerarExamenResponse = {
      token: 't',
      tipoExamen: 'MIXTO',
      ciudadId: 1,
      zonaIds: [2, 3],
      totalRetos: 0,
      duracionRetoMs: 1000,
      calles: [],
      retos: [],
    };
    req.flush(res);
    expect(received?.tipoExamen).toBe('MIXTO');
  });

  it('generarExamenRecorrido envía tipoExamen RECORRIDO', () => {
    let received: GenerarExamenResponse | undefined;
    service.generarExamenRecorrido(1).subscribe((r) => (received = r));

    const req = httpMock.expectOne(`${API}/callejero/examen/generar`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      ciudadId: 1,
      zonaIds: [],
      tipoExamen: 'RECORRIDO',
      dificultad: 'MEDIO',
    });
    const res: GenerarExamenResponse = {
      token: 't',
      tipoExamen: 'RECORRIDO',
      ciudadId: 1,
      zonaIds: [],
      totalRetos: 1,
      duracionRetoMs: 1000,
      calles: [],
      retos: [
        {
          orden: 0,
          tipo: 'RECORRIDO',
          calleId: 5,
          nombre: 'Calle X',
          opciones: [{ parque: 'Campanar' }, { parque: 'Centro' }],
        },
      ],
    };
    req.flush(res);
    expect(received?.tipoExamen).toBe('RECORRIDO');
    expect(received?.retos[0].tipo).toBe('RECORRIDO');
  });

  it('generarExamenRecorrido propaga la dificultad elegida (port v27)', () => {
    service.generarExamenRecorrido(1, [], 'DIFICIL').subscribe();
    const req = httpMock.expectOne(`${API}/callejero/examen/generar`);
    expect(req.request.body).toEqual({
      ciudadId: 1,
      zonaIds: [],
      tipoExamen: 'RECORRIDO',
      dificultad: 'DIFICIL',
    });
    req.flush({
      token: 't',
      tipoExamen: 'RECORRIDO',
      ciudadId: 1,
      zonaIds: [],
      totalRetos: 0,
      duracionRetoMs: 1000,
      calles: [],
      retos: [],
    } as GenerarExamenResponse);
  });

  // ── Nuevos endpoints v27 (T1, T4, T10) ───────────────────────────────────

  it('GET /callejero/ciudades/:id/calles mapea response.calles y usa withCredentials', () => {
    const calles: CalleCiudad[] = [
      {
        id: 1001,
        nombre: 'Avenida del Puerto',
        tipoVia: 'Avenida',
        lat: 39.471,
        lng: -0.362,
        longitudM: 600,
        parquesCobertura: ['Campanar'],
      },
    ];
    let received: CalleCiudad[] | undefined;

    service.listarCallesCiudad(1).subscribe((r) => (received = r));

    const req = httpMock.expectOne(`${API}/callejero/ciudades/1/calles`);
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBe(true);
    req.flush({ calles });

    expect(received).toEqual(calles);
    expect(received?.[0].longitudM).toBe(600);
  });

  it('GET /callejero/geocode/reverse devuelve la dirección aproximada', () => {
    let received: { direccion: string } | undefined;

    service.geocodeReverse(39.471, -0.362).subscribe((r) => (received = r));

    const req = httpMock.expectOne(
      `${API}/callejero/geocode/reverse?lat=39.471&lng=-0.362`,
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBe(true);
    req.flush({ direccion: 'Avenida del Puerto 10, València' });

    expect(received?.direccion).toBe('Avenida del Puerto 10, València');
  });

  it('GET /callejero/geocode/buscar mapea response.items y codifica la query', () => {
    const items: GeocodeBuscarItem[] = [
      { nombre: 'Avenida del Puerto 12, València', lat: 39.471, lng: -0.362 },
    ];
    let received: GeocodeBuscarItem[] | undefined;

    service.geocodeBuscar('Puerto 12').subscribe((r) => (received = r));

    const req = httpMock.expectOne(
      `${API}/callejero/geocode/buscar?q=Puerto%2012&limit=5`,
    );
    expect(req.request.method).toBe('GET');
    req.flush({ items });

    expect(received).toEqual(items);
    expect(received?.[0].nombre).toBe('Avenida del Puerto 12, València');
  });

  it('GET /callejero/geocode/buscar respeta el limit personalizado', () => {
    service.geocodeBuscar('Colón', 10).subscribe();

    const req = httpMock.expectOne(
      `${API}/callejero/geocode/buscar?q=Col%C3%B3n&limit=10`,
    );
    req.flush({ items: [] });

    expect(req.request.url).toContain('limit=10');
  });

  // ── Calles modificadas (v27) ──────────────────────────────────────────────

  it('GET /callejero/ciudades/:id/calles-modificadas mapea response.modificadas', () => {
    const modificadas: CalleModificada[] = [
      {
        nombreNuevo: 'Av. de la Constitución',
        nombreAntiguo: 'Calle General Mola',
        tipoVia: 'Avenida',
      },
    ];
    let received: CalleModificada[] | undefined;

    service.listarCallesModificadas(1).subscribe((r) => (received = r));

    const req = httpMock.expectOne(
      `${API}/callejero/ciudades/1/calles-modificadas`,
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBe(true);
    req.flush({ modificadas });

    expect(received).toEqual(modificadas);
    expect(received?.[0].nombreAntiguo).toBe('Calle General Mola');
  });

  it('listarCallesModificadas propaga el error sin toast (ignoreError=true, degradación en componente)', () => {
    // ignoreError=true solo suprime el toast; el error se propaga al subscriber.
    // La degradación a [] ocurre en el component (error: () => callesModificadas.set([])).
    const toast = TestBed.inject(ToastrService) as unknown as {
      error: jest.Mock;
    };
    let err: unknown;

    service.listarCallesModificadas(1).subscribe({
      next: () => fail('no debería emitir'),
      error: (e) => (err = e),
    });

    httpMock
      .expectOne(`${API}/callejero/ciudades/1/calles-modificadas`)
      .flush(null, { status: 404, statusText: 'Not Found' });

    expect(err).toBeDefined();
    expect(toast.error).not.toHaveBeenCalled();
  });
});
