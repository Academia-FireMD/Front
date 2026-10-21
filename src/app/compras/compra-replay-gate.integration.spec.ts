import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ToastrService } from 'ngx-toastr';
import { DialogService } from 'primeng/dynamicdialog';
import { Observable, Subject } from 'rxjs';
import { environment } from '../../environments/environment';
import { CursosAlumnoService } from '../cursos/services/cursos-alumno.service';
import { SuscripcionManagementService } from '../services/suscripcion-management.service';
import { CompraFiscalService } from './compra-fiscal.service';
import { EstadoDatosFiscalesCompra } from './datos-fiscales-compra.model';

const FICHA_PARCIAL: EstadoDatosFiscalesCompra = {
  datos: {
    nombre: 'Ana',
    apellidos: 'García',
    empresa: '',
    direccion: '',
    direccion2: '',
    poblacion: 'Valencia',
    provincia: 'Valencia',
    codigoPostal: '46001',
    pais: 'ES',
    nif: '12345678Z',
  },
  faltantes: ['direccion'],
  invalidos: [],
  conflictos: [],
  completo: false,
  version: 'synthetic-v1',
};

describe.each([
  { tipo: 'curso', path: '/cursos/42/comprar-cof' },
  { tipo: 'alta', path: '/suscripcion-management/anadir-plan' },
])('Compra $tipo con el gate fiscal real', ({ tipo, path }) => {
  let httpMock: HttpTestingController;
  let dialogService: { open: jest.Mock };
  let dialogClose$: Subject<unknown>;

  beforeEach(() => {
    dialogClose$ = new Subject<unknown>();
    dialogService = {
      open: jest.fn(() => ({ onClose: dialogClose$.asObservable() })),
    };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        CompraFiscalService,
        CursosAlumnoService,
        SuscripcionManagementService,
        { provide: DialogService, useValue: dialogService },
        {
          provide: ToastrService,
          useValue: { info: jest.fn(), error: jest.fn(), success: jest.fn() },
        },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  function comprar(): Observable<unknown> {
    return tipo === 'curso'
      ? TestBed.inject(CursosAlumnoService).comprarCursoCof(42, 49)
      : TestBed.inject(SuscripcionManagementService).anadirPlan('PLAN', 49);
  }

  it('recupera el pago guardado sin exigir la ficha fiscal actual', () => {
    let respuesta: unknown;
    comprar().subscribe((value) => (respuesta = value));

    httpMock.expectNone(`${environment.apiUrl}/compras/datos-fiscales`);
    const req = httpMock.expectOne(`${environment.apiUrl}${path}`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.importeConfirmado).toBe(49);
    req.flush({ success: true, mensaje: 'Pago anterior recuperado' });

    expect(respuesta).toEqual({
      success: true,
      mensaje: 'Pago anterior recuperado',
    });
    expect(dialogService.open).not.toHaveBeenCalled();
  });

  it('una compra nueva incompleta abre el formulario y guardar no repite el POST', () => {
    const next = jest.fn();
    comprar().subscribe(next);
    httpMock.expectOne(`${environment.apiUrl}${path}`).flush(
      {
        success: false,
        requiereDatosFiscales: true,
        codigo: 'DATOS_FISCALES_INCOMPLETOS',
        mensaje: 'Completa la dirección',
      },
      { status: 400, statusText: 'Bad Request' },
    );
    httpMock
      .expectOne(`${environment.apiUrl}/compras/datos-fiscales`)
      .flush(FICHA_PARCIAL);

    expect(dialogService.open).toHaveBeenCalledTimes(1);
    expect(dialogService.open.mock.calls[0][1].data.estado).toEqual(
      FICHA_PARCIAL,
    );
    dialogClose$.next({ guardado: true });
    dialogClose$.complete();
    expect(next).not.toHaveBeenCalled();
    httpMock.expectNone(`${environment.apiUrl}${path}`);
  });

  it('un fallo técnico de lectura no abre ficha vacía ni reintenta el pago', () => {
    const error = jest.fn();
    comprar().subscribe({ error });
    httpMock
      .expectOne(`${environment.apiUrl}${path}`)
      .flush(
        { mensaje: 'No se pudo consultar el intento o cliente Woo' },
        { status: 502, statusText: 'Bad Gateway' },
      );

    expect(error).toHaveBeenCalledTimes(1);
    expect(dialogService.open).not.toHaveBeenCalled();
    httpMock.expectNone(`${environment.apiUrl}/compras/datos-fiscales`);
    httpMock.expectNone(`${environment.apiUrl}${path}`);
  });
});
