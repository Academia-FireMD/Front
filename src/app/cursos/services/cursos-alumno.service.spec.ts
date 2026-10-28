import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ToastrService } from 'ngx-toastr';
import { environment } from '../../../environments/environment';
import { CompraFiscalService } from '../../compras/compra-fiscal.service';
import { ComprarCursoCofResponse } from '../models/curso.model';
import { CursosAlumnoService } from './cursos-alumno.service';

describe('CursosAlumnoService.comprarCursoCof', () => {
  let service: CursosAlumnoService;
  let httpMock: HttpTestingController;
  let compraFiscal: { ejecutarConDatosFiscales: jest.Mock };

  beforeEach(() => {
    compraFiscal = {
      ejecutarConDatosFiscales: jest.fn((compra: () => unknown) => compra()),
    };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ToastrService,
          useValue: { error: jest.fn(), success: jest.fn() },
        },
        { provide: CompraFiscalService, useValue: compraFiscal },
        CursosAlumnoService,
      ],
    });
    service = TestBed.inject(CursosAlumnoService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('POST a /cursos/:id/comprar-cof y devuelve la respuesta tipada', () => {
    const res: ComprarCursoCofResponse = {
      success: true,
      accesoId: 5,
      mensaje: 'OK',
    };
    let received: ComprarCursoCofResponse | undefined;
    service.comprarCursoCof(42, 17.45).subscribe((r) => (received = r));

    const req = httpMock.expectOne(
      `${environment.apiUrl}/cursos/42/comprar-cof`,
    );
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.body).toEqual({ importeConfirmado: 17.45 });
    req.flush(res);

    expect(received).toEqual(res);
    expect(compraFiscal.ejecutarConDatosFiscales).toHaveBeenCalledTimes(1);
  });

  it('propaga requiereCheckout sin disparar el toast genérico', () => {
    const toast = TestBed.inject(ToastrService);
    const res: ComprarCursoCofResponse = {
      success: false,
      requiereCheckout: true,
      wooProductId: 100,
      mensaje: 'Sin COF',
    };
    let received: ComprarCursoCofResponse | undefined;
    service.comprarCursoCof(7, 17.45).subscribe((r) => (received = r));

    httpMock.expectOne(`${environment.apiUrl}/cursos/7/comprar-cof`).flush(res);

    expect(received).toEqual(res);
    expect(toast.error).not.toHaveBeenCalled();
  });

  // Clases grabadas (2026-06-29): mismo shape que /mios, endpoint propio.
  it('listClasesGrabadas hace GET a /cursos/clases-grabadas', () => {
    let received: unknown;
    service.listClasesGrabadas().subscribe((r) => (received = r));

    const req = httpMock.expectOne(
      `${environment.apiUrl}/cursos/clases-grabadas`,
    );
    expect(req.request.method).toBe('GET');
    req.flush([]);

    expect(received).toEqual([]);
  });
});

describe('CursosAlumnoService (bloque INTERACTIVO)', () => {
  let service: CursosAlumnoService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ToastrService,
          useValue: { error: jest.fn(), success: jest.fn() },
        },
        {
          provide: CompraFiscalService,
          useValue: {
            ejecutarConDatosFiscales: (compra: () => unknown) => compra(),
          },
        },
        CursosAlumnoService,
      ],
    });
    service = TestBed.inject(CursosAlumnoService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('descarga el HTML protegido como Blob con credenciales', () => {
    let recibido: Blob | undefined;
    service
      .descargarAplicacionInteractiva(501)
      .subscribe((b) => (recibido = b));

    const req = httpMock.expectOne(
      `${environment.apiUrl}/cursos/bloques/501/aplicacion`,
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.responseType).toBe('blob');
    const blob = new Blob(['<html></html>'], { type: 'text/html' });
    req.flush(blob);
    expect(recibido).toBe(blob);
  });

  it('GET progreso interactivo devuelve el contrato {estado,revision}', () => {
    let recibido: unknown;
    service.getProgresoInteractivo(77).subscribe((r) => (recibido = r));

    const req = httpMock.expectOne(
      `${environment.apiUrl}/lecciones/77/progreso/interactivo`,
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBe(true);
    req.flush({ estado: null, revision: 0 });
    expect(recibido).toEqual({ estado: null, revision: 0 });
  });

  it('PUT envía body EXACTO {estado} y devuelve estado+revisión', () => {
    const estado = { v: 1, hist: {} };
    let recibido: unknown;
    service
      .guardarProgresoInteractivo(77, estado)
      .subscribe((r) => (recibido = r));

    const req = httpMock.expectOne(
      `${environment.apiUrl}/lecciones/77/progreso/interactivo`,
    );
    expect(req.request.method).toBe('PUT');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.body).toEqual({ estado });
    req.flush({ estado, revision: 1 });
    expect(recibido).toEqual({ estado, revision: 1 });
  });
});
