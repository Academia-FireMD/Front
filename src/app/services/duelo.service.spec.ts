import { HttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { COMMON_TEST_PROVIDERS } from '../testing';
import { CrearDueloDto, DueloService } from './duelo.service';

describe('DueloService', () => {
  let service: DueloService;
  let mockHttpGet: jest.Mock;
  let mockHttpPost: jest.Mock;

  beforeEach(() => {
    mockHttpGet = jest.fn();
    mockHttpPost = jest.fn();
    const mockHttp = {
      get: mockHttpGet,
      post: mockHttpPost,
      put: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        ...COMMON_TEST_PROVIDERS,
        { provide: HttpClient, useValue: mockHttp },
        DueloService,
      ],
    });
    service = TestBed.inject(DueloService);
  });

  describe('crearDuelo$', () => {
    it('should POST to /duelos/crear with the dto', (done) => {
      const dto: CrearDueloDto = {
        temas: [1, 2],
        numeroPreguntas: 30,
        tiempoPorTestMin: 45,
        duracionSalaHoras: 168,
      };
      mockHttpPost.mockReturnValue(of({ codigo: 'BATALLA-X7K2', testId: 99 }));

      service.crearDuelo$(dto).subscribe((res) => {
        expect(mockHttpPost).toHaveBeenCalledWith(
          `${environment.apiUrl}/duelos/crear`,
          dto,
          { withCredentials: true },
        );
        expect(res.codigo).toBe('BATALLA-X7K2');
        expect(res.testId).toBe(99);
        done();
      });
    });
  });

  describe('unirse$', () => {
    it('should POST directly to /duelos/unirse/:codigo (encoded), preserving errors', (done) => {
      mockHttpPost.mockReturnValue(of({ testId: 123 }));

      service.unirse$('BATALLA X7K2').subscribe((res) => {
        expect(mockHttpPost).toHaveBeenCalledWith(
          `${environment.apiUrl}/duelos/unirse/${encodeURIComponent('BATALLA X7K2')}`,
          {},
          { withCredentials: true },
        );
        expect(res.testId).toBe(123);
        done();
      });
    });

    it('should propagate the HttpErrorResponse (no base-service wrapping / no toast)', (done) => {
      const httpError = {
        status: 403,
        error: { message: 'Oposición no permitida' },
      };
      mockHttpPost.mockReturnValue(throwError(() => httpError));

      service.unirse$('CERRADO').subscribe({
        next: () => done.fail('should have errored'),
        error: (err) => {
          expect(err.error.message).toBe('Oposición no permitida');
          done();
        },
      });
    });
  });

  describe('getRanking$', () => {
    it('should GET /duelos/:codigo/ranking (encoded)', (done) => {
      mockHttpGet.mockReturnValue(
        of({ resultados: [], miPosicion: 1, totalParticipantes: 3 }),
      );

      service.getRanking$('BATALLA-X7K2').subscribe((res) => {
        expect(mockHttpGet).toHaveBeenCalledWith(
          `${environment.apiUrl}/duelos/${encodeURIComponent('BATALLA-X7K2')}/ranking`,
          { withCredentials: true },
        );
        expect(res.totalParticipantes).toBe(3);
        done();
      });
    });
  });
});
