import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { CompraFiscalService } from '../../compras/compra-fiscal.service';
import { ExamenesService } from './examen.service';

describe('ExamenesService.comprarSimulacroCof$', () => {
  let service: ExamenesService;
  let httpMock: HttpTestingController;
  const compraFiscal = {
    ejecutarConDatosFiscales: jest.fn((compra: () => unknown) => compra()),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CompraFiscalService, useValue: compraFiscal },
        ExamenesService,
      ],
    });
    service = TestBed.inject(ExamenesService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('envía el importe exactamente como aparece en la confirmación', () => {
    service
      .comprarSimulacroCof$(
        50,
        'simulacro_v2_00000000-0000-4000-8000-000000000001',
        9.9,
      )
      .subscribe();
    const req = httpMock.expectOne(
      `${environment.apiUrl}/examenes/comprar-simulacro-cof/50`,
    );

    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      idempotencyKey: 'simulacro_v2_00000000-0000-4000-8000-000000000001',
      importeConfirmado: 9.9,
    });
    req.flush({ success: true, mensaje: 'ok' });
  });

  it('admite resolver un intento previo antes del GET fiscal y marca envío justo antes del POST', () => {
    const antesDeEnviar = jest.fn();
    service
      .comprarSimulacroCof$(
        50,
        'simulacro_v2_00000000-0000-4000-8000-000000000001',
        9.9,
        {
          omitirLecturaFiscalInicial: true,
          antesDeEnviar,
        },
      )
      .subscribe();

    expect(antesDeEnviar).toHaveBeenCalledTimes(1);
    expect(compraFiscal.ejecutarConDatosFiscales).toHaveBeenLastCalledWith(
      expect.any(Function),
      undefined,
      { omitirLecturaInicial: true },
    );
    httpMock
      .expectOne(`${environment.apiUrl}/examenes/comprar-simulacro-cof/50`)
      .flush({ success: true, mensaje: 'ok' });
  });

  it('rechaza una key legacy sin prefijo v2 sin transformarla ni enviar compra', () => {
    const errors: unknown[] = [];
    service
      .comprarSimulacroCof$(50, 'legacy-uuid-sin-prefijo', 9.9)
      .subscribe({ error: (error) => errors.push(error) });

    expect(errors).toHaveLength(1);
    expect(compraFiscal.ejecutarConDatosFiscales).not.toHaveBeenCalled();
    httpMock.expectNone(
      `${environment.apiUrl}/examenes/comprar-simulacro-cof/50`,
    );
  });
});
