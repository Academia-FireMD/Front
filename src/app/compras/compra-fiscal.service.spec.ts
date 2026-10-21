import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ToastrService } from 'ngx-toastr';
import { DialogService } from 'primeng/dynamicdialog';
import { Observable, of, Subject, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  DatosFiscalesCompra,
  EstadoDatosFiscalesCompra,
} from './datos-fiscales-compra.model';
import { CompraFiscalService } from './compra-fiscal.service';

const DATOS_COMPLETOS: DatosFiscalesCompra = {
  nombre: 'Ana',
  apellidos: 'García',
  empresa: '',
  direccion: 'Calle Uno 1',
  direccion2: '',
  poblacion: 'Valencia',
  provincia: 'Valencia',
  codigoPostal: '46001',
  pais: 'ES',
  nif: '12345678Z',
};

function estado(
  cambios: Partial<EstadoDatosFiscalesCompra> = {},
): EstadoDatosFiscalesCompra {
  return {
    datos: { ...DATOS_COMPLETOS },
    faltantes: [],
    invalidos: [],
    conflictos: [],
    completo: true,
    version: 'v1',
    ...cambios,
  };
}

describe('CompraFiscalService', () => {
  let service: CompraFiscalService;
  let httpMock: HttpTestingController;
  let dialogService: { open: jest.Mock };
  let dialogClose$: Subject<unknown>;
  let toast: { info: jest.Mock };

  beforeEach(() => {
    dialogClose$ = new Subject<unknown>();
    dialogService = {
      open: jest.fn(() => ({ onClose: dialogClose$.asObservable() })),
    };
    toast = { info: jest.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: DialogService, useValue: dialogService },
        { provide: ToastrService, useValue: toast },
        CompraFiscalService,
      ],
    });
    service = TestBed.inject(CompraFiscalService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('con ficha completa ejecuta la compra una vez y no abre formulario', () => {
    const compra = jest.fn(() => of({ success: true }));
    let respuesta: unknown;

    service.ejecutarConDatosFiscales(compra).subscribe((value) => {
      respuesta = value;
    });
    httpMock
      .expectOne(`${environment.apiUrl}/compras/datos-fiscales`)
      .flush(estado());

    expect(compra).toHaveBeenCalledTimes(1);
    expect(respuesta).toEqual({ success: true });
    expect(dialogService.open).not.toHaveBeenCalled();
  });

  it('sin cliente Woo permite recibir el checkout sin abrir una ficha que no se puede guardar', () => {
    const checkout = { success: false, requiereCheckout: true };
    const compra = jest.fn(() => of(checkout));
    let respuesta: unknown;

    service.ejecutarConDatosFiscales(compra).subscribe((value) => {
      respuesta = value;
    });
    httpMock.expectOne(`${environment.apiUrl}/compras/datos-fiscales`).flush(
      estado({
        completo: false,
        faltantes: ['direccion'],
        requiereCheckout: true,
      }),
    );

    expect(compra).toHaveBeenCalledTimes(1);
    expect(respuesta).toEqual(checkout);
    expect(dialogService.open).not.toHaveBeenCalled();
  });

  it('para resolver un intento enviado omite el GET previo de ficha fiscal', () => {
    const compra = jest.fn(() => of({ success: true }));
    let respuesta: unknown;

    service
      .ejecutarConDatosFiscales(compra, undefined, {
        omitirLecturaInicial: true,
      })
      .subscribe((value) => (respuesta = value));

    expect(compra).toHaveBeenCalledTimes(1);
    expect(respuesta).toEqual({ success: true });
    httpMock.expectNone(`${environment.apiUrl}/compras/datos-fiscales`);
    expect(dialogService.open).not.toHaveBeenCalled();
  });

  it('si el POST de resolución pide datos fiscales, abre el gate común tras el intento seguro', () => {
    const compra = jest.fn(() =>
      throwError(
        () =>
          new HttpErrorResponse({
            status: 400,
            statusText: 'Bad Request',
            error: {
              success: false,
              requiereDatosFiscales: true,
              codigo: 'DATOS_FISCALES_INCOMPLETOS',
              mensaje: 'Completa la dirección',
            },
          }),
      ),
    );

    service
      .ejecutarConDatosFiscales(compra, undefined, {
        omitirLecturaInicial: true,
      })
      .subscribe();

    // Server ha resuelto primero el intento; solo entonces se consulta la ficha.
    expect(compra).toHaveBeenCalledTimes(1);
    httpMock
      .expectOne(`${environment.apiUrl}/compras/datos-fiscales`)
      .flush(estado({ completo: false, faltantes: ['direccion'] }));

    expect(dialogService.open).toHaveBeenCalledTimes(1);
  });

  it('conserva los datos conocidos y limita el diálogo a campos pendientes', () => {
    const parcial = estado({
      completo: false,
      faltantes: ['direccion', 'poblacion'],
      datos: { ...DATOS_COMPLETOS, direccion: '', poblacion: '' },
    });
    const compra = jest.fn(() => of({ success: true }));

    service.ejecutarConDatosFiscales(compra, 31).subscribe();
    const req = httpMock.expectOne(
      `${environment.apiUrl}/compras/datos-fiscales?suscripcionId=31`,
    );
    expect(req.request.method).toBe('GET');
    req.flush(parcial);

    expect(compra).not.toHaveBeenCalled();
    expect(dialogService.open).toHaveBeenCalledTimes(1);
    const [, config] = dialogService.open.mock.calls[0];
    expect(config.data.estado).toEqual(parcial);
    expect(config.data.suscripcionId).toBe(31);

    dialogClose$.next(undefined);
    dialogClose$.complete();
    expect(compra).not.toHaveBeenCalled();
  });

  it('un diálogo cancelado no ejecuta la compra', () => {
    const compra = jest.fn(() => of({ success: true }));
    service.ejecutarConDatosFiscales(compra).subscribe();
    httpMock
      .expectOne(`${environment.apiUrl}/compras/datos-fiscales`)
      .flush(estado({ completo: false, faltantes: ['nif'] }));

    dialogClose$.next(undefined);
    dialogClose$.complete();
    expect(compra).not.toHaveBeenCalled();
  });

  it('guardar la ficha no cobra y el siguiente clic vuelve a consultar antes de comprar', () => {
    const compra = jest.fn(() => of({ success: true }));
    service.ejecutarConDatosFiscales(compra).subscribe();
    httpMock
      .expectOne(`${environment.apiUrl}/compras/datos-fiscales`)
      .flush(estado({ completo: false, conflictos: ['nif'] }));

    dialogClose$.next({ guardado: true });
    dialogClose$.complete();
    expect(compra).not.toHaveBeenCalled();
    expect(toast.info).toHaveBeenCalled();

    dialogClose$ = new Subject<unknown>();
    dialogService.open.mockImplementation(() => ({ onClose: dialogClose$ }));
    service.ejecutarConDatosFiscales(compra).subscribe();
    httpMock
      .expectOne(`${environment.apiUrl}/compras/datos-fiscales`)
      .flush(estado());

    expect(compra).toHaveBeenCalledTimes(1);
  });

  it('si falla la lectura no muestra una ficha vacía ni ejecuta la compra', () => {
    const compra = jest.fn(() => of({ success: true }));
    const errors: unknown[] = [];
    service.ejecutarConDatosFiscales(compra).subscribe({
      error: (error) => errors.push(error),
    });
    httpMock
      .expectOne(`${environment.apiUrl}/compras/datos-fiscales`)
      .flush(
        { message: 'fallo de lectura' },
        { status: 503, statusText: 'Unavailable' },
      );

    expect(errors).toHaveLength(1);
    expect(dialogService.open).not.toHaveBeenCalled();
    expect(compra).not.toHaveBeenCalled();
  });

  it('recupera un PUT perdido con solo GET y requiere otra confirmación para comprar', () => {
    const compra = jest.fn(() => of({ success: true }));
    service.ejecutarConDatosFiscales(compra, 31).subscribe();
    httpMock
      .expectOne(
        `${environment.apiUrl}/compras/datos-fiscales?suscripcionId=31`,
      )
      .flush(estado({ completo: false, faltantes: ['direccion'] }));

    const datosDialogo = dialogService.open.mock.calls[0][1].data;
    const erroresGuardado: unknown[] = [];
    datosDialogo.guardar({ direccion: 'Calle Uno 1' }).subscribe({
      error: (error: unknown) => erroresGuardado.push(error),
    });
    const put = httpMock.expectOne(
      `${environment.apiUrl}/compras/datos-fiscales`,
    );
    expect(put.request.method).toBe('PUT');
    put.flush(
      { mensaje: 'respuesta perdida' },
      { status: 499, statusText: 'Client Closed Request' },
    );
    expect(erroresGuardado).toHaveLength(1);

    let estadoRecuperado: EstadoDatosFiscalesCompra | undefined;
    datosDialogo.comprobar().subscribe((value: EstadoDatosFiscalesCompra) => {
      estadoRecuperado = value;
    });
    const comprobar = httpMock.expectOne(
      `${environment.apiUrl}/compras/datos-fiscales?suscripcionId=31`,
    );
    expect(comprobar.request.method).toBe('GET');
    comprobar.flush(estado({ completo: true }));

    expect(estadoRecuperado?.completo).toBe(true);
    expect(compra).not.toHaveBeenCalled();
    httpMock.expectNone((request) => request.method === 'PUT');

    dialogClose$.next({ guardado: true });
    dialogClose$.complete();
    expect(compra).not.toHaveBeenCalled();

    service.ejecutarConDatosFiscales(compra, 31).subscribe();
    const confirmacion = httpMock.expectOne(
      `${environment.apiUrl}/compras/datos-fiscales?suscripcionId=31`,
    );
    expect(confirmacion.request.method).toBe('GET');
    confirmacion.flush(estado({ completo: true }));
    expect(compra).toHaveBeenCalledTimes(1);
  });

  it('una verificación pendiente, incompleta o fallida no escribe ni inicia la compra', () => {
    const compra = jest.fn(() => of({ success: true }));
    service.ejecutarConDatosFiscales(compra, 31).subscribe();
    httpMock
      .expectOne(
        `${environment.apiUrl}/compras/datos-fiscales?suscripcionId=31`,
      )
      .flush(estado({ completo: false, faltantes: ['direccion'] }));
    const comprobar = dialogService.open.mock.calls[0][1].data.comprobar;

    const erroresPendientes: unknown[] = [];
    comprobar().subscribe({
      error: (error: unknown) => erroresPendientes.push(error),
    });
    const pendiente = httpMock.expectOne(
      `${environment.apiUrl}/compras/datos-fiscales?suscripcionId=31`,
    );
    expect(pendiente.request.method).toBe('GET');
    pendiente.flush({
      ...estado({ completo: false, faltantes: [] }),
      fiscalSyncPending: true,
    });
    expect(erroresPendientes).toHaveLength(0);
    expect(compra).not.toHaveBeenCalled();

    comprobar().subscribe();
    const incompleta = httpMock.expectOne(
      `${environment.apiUrl}/compras/datos-fiscales?suscripcionId=31`,
    );
    expect(incompleta.request.method).toBe('GET');
    incompleta.flush(estado({ completo: false, faltantes: ['direccion'] }));
    expect(compra).not.toHaveBeenCalled();

    const errores: unknown[] = [];
    comprobar().subscribe({ error: (error: unknown) => errores.push(error) });
    const fallida = httpMock.expectOne(
      `${environment.apiUrl}/compras/datos-fiscales?suscripcionId=31`,
    );
    expect(fallida.request.method).toBe('GET');
    fallida.flush(
      { mensaje: 'Lectura temporalmente no disponible' },
      { status: 503, statusText: 'Unavailable' },
    );
    expect(errores).toHaveLength(1);
    expect(compra).not.toHaveBeenCalled();
    httpMock.expectNone((request) => request.method === 'PUT');
  });

  it('reconoce la precondición autoritativa recibida en un body success:false', () => {
    const compra = jest.fn(() =>
      of({
        success: false,
        requiereDatosFiscales: true,
        codigo: 'DATOS_FISCALES_INCOMPLETOS',
        mensaje: 'Completa la dirección',
      }),
    );
    service.ejecutarConDatosFiscales(compra).subscribe();
    httpMock
      .expectOne(`${environment.apiUrl}/compras/datos-fiscales`)
      .flush(estado());

    expect(compra).toHaveBeenCalledTimes(1);
    expect(dialogService.open).not.toHaveBeenCalled();
    httpMock
      .expectOne(`${environment.apiUrl}/compras/datos-fiscales`)
      .flush(estado({ completo: false, invalidos: ['direccion'] }));

    expect(dialogService.open).toHaveBeenCalledTimes(1);
    expect(compra).toHaveBeenCalledTimes(1);
  });

  it('reconoce la precondición fiscal HTTP 400 sin clasificarla como tarjeta rechazada', () => {
    const compra = jest.fn(
      (): Observable<unknown> =>
        throwError(
          () =>
            new Error('test sentinel') as Error & {
              error: unknown;
              status: number;
            },
        ),
    );
    const error = Object.assign(new Error('datos fiscales incompletos'), {
      status: 400,
      error: {
        success: false,
        requiereDatosFiscales: true,
        codigo: 'DATOS_FISCALES_CONFLICTIVOS',
        mensaje: 'Revisa el NIF',
      },
    });
    compra.mockReturnValue(throwError(() => error));

    service.ejecutarConDatosFiscales(compra).subscribe();
    httpMock
      .expectOne(`${environment.apiUrl}/compras/datos-fiscales`)
      .flush(estado());
    httpMock
      .expectOne(`${environment.apiUrl}/compras/datos-fiscales`)
      .flush(estado({ completo: false, conflictos: ['nif'] }));

    expect(dialogService.open).toHaveBeenCalledTimes(1);
    expect(compra).toHaveBeenCalledTimes(1);
  });
});
