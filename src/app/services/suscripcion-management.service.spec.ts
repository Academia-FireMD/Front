import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { CompraFiscalService } from '../compras/compra-fiscal.service';
import {
  PreviewCambioResponse,
  SuscripcionManagementService,
} from './suscripcion-management.service';

const PREVIEW_PAGADO: PreviewCambioResponse = {
  switchType: 'UPGRADE',
  modo: 'INMEDIATO',
  requiereCobro: true,
  costeCalculable: true,
  prorrateo: { importe: 12.5, diasRestantes: 15, diasCiclo: 30 },
  precioActual: 20,
  precioNuevo: 30,
  fechaAplicacion: null,
  metodoPago: { usable: true, tarjetaMasked: '•••• 0004' },
  avisos: [],
};
const PREVIEW_GRATUITO: PreviewCambioResponse = {
  ...PREVIEW_PAGADO,
  switchType: 'DOWNGRADE',
  modo: 'PROGRAMADO',
  requiereCobro: false,
  costeCalculable: true,
};

describe('SuscripcionManagementService cambios con gate fiscal', () => {
  let service: SuscripcionManagementService;
  let httpMock: HttpTestingController;
  let gate: { ejecutarConDatosFiscales: jest.Mock };

  beforeEach(() => {
    gate = {
      ejecutarConDatosFiscales: jest.fn((request: () => unknown) => request()),
    };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CompraFiscalService, useValue: gate },
        SuscripcionManagementService,
      ],
    });
    service = TestBed.inject(SuscripcionManagementService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('no cobra ni pregunta por ficha si el preview no permite calcular el coste', async () => {
    const errors: unknown[] = [];
    service
      .cambiarSuscripcion(7, 'SKU', undefined, {
        ...PREVIEW_PAGADO,
        costeCalculable: false,
      })
      .subscribe({ error: (error) => errors.push(error) });

    expect(errors).toHaveLength(1);
    expect(gate.ejecutarConDatosFiscales).not.toHaveBeenCalled();
    httpMock.expectNone((req) => req.url.endsWith('/cambiar-plan'));
  });

  it('cambio calculable sin cobro no consulta ni exige datos fiscales', () => {
    service
      .cambiarSuscripcion(7, 'SKU', undefined, PREVIEW_GRATUITO)
      .subscribe();
    const req = httpMock.expectOne((request) =>
      request.url.endsWith('/suscripcion-management/cambiar-plan'),
    );

    expect(req.request.method).toBe('POST');
    expect(gate.ejecutarConDatosFiscales).not.toHaveBeenCalled();
    expect(req.request.body).toEqual({ suscripcionId: 7, nuevoSku: 'SKU' });
    req.flush({
      mensaje: 'Cambio programado',
      switchType: 'DOWNGRADE',
      modo: 'PROGRAMADO',
    });
  });

  it('cambio con coste usa el gate y conserva el id de suscripción', () => {
    service
      .cambiarSuscripcion(9, 'SKU-PAID', undefined, PREVIEW_PAGADO)
      .subscribe();
    const req = httpMock.expectOne((request) =>
      request.url.endsWith('/suscripcion-management/cambiar-plan'),
    );

    expect(gate.ejecutarConDatosFiscales).toHaveBeenCalledTimes(1);
    expect(gate.ejecutarConDatosFiscales.mock.calls[0][1]).toBe(9);
    expect(req.request.body).toEqual({
      suscripcionId: 9,
      nuevoSku: 'SKU-PAID',
      importeConfirmado: 12.5,
    });
    req.flush({
      mensaje: 'Cambio inmediato',
      switchType: 'UPGRADE',
      modo: 'INMEDIATO',
    });
  });

  it('un alta de plan siempre pasa por el gate antes de enviar la petición', () => {
    service.anadirPlan('SKU-NEW', 59.9).subscribe();
    const req = httpMock.expectOne((request) =>
      request.url.endsWith('/suscripcion-management/anadir-plan'),
    );

    expect(gate.ejecutarConDatosFiscales).toHaveBeenCalledTimes(1);
    expect(req.request.body).toEqual({
      nuevoSku: 'SKU-NEW',
      importeConfirmado: 59.9,
    });
    req.flush({ success: true, mensaje: 'Alta confirmada' });
  });
});
