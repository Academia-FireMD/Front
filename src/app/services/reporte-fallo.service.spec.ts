import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { ReportesFalloService } from './reporte-fallo.service';
import { COMMON_TEST_PROVIDERS } from '../testing';
import { environment } from '../../environments/environment';

describe('ReportesFalloService', () => {
  let service: ReportesFalloService;
  let mockHttpPost: jest.Mock;
  let mockHttpPatch: jest.Mock;

  beforeEach(() => {
    mockHttpPost = jest.fn();
    mockHttpPatch = jest.fn();
    const mockHttp = {
      get: jest.fn(),
      post: mockHttpPost,
      put: jest.fn(),
      patch: mockHttpPatch,
      delete: jest.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        ...COMMON_TEST_PROVIDERS,
        { provide: HttpClient, useValue: mockHttp },
        ReportesFalloService,
      ],
    });
    service = TestBed.inject(ReportesFalloService);
  });

  describe('exportarFallos$', () => {
    it('should POST to /reportes/exportar with type, formato and filtros merged', (done) => {
      const mockBlob = new Blob(['dummy'], { type: 'application/xlsx' });
      mockHttpPost.mockReturnValue(of(mockBlob));

      const filtros: { temas?: number[]; dificultad?: string } = {
        temas: [1, 2],
      };
      const type: 'test' | 'flashcards' = 'test';
      const formato: 'excel' | 'word' = 'excel';

      service.exportarFallos$(filtros, type, formato).subscribe((result) => {
        expect(mockHttpPost).toHaveBeenCalledWith(
          `${environment.apiUrl}/reportes/exportar`,
          { ...filtros, type, formato },
          { responseType: 'blob', withCredentials: true },
        );
        expect(result).toBeInstanceOf(Blob);
        done();
      });
    });

    it('should POST with type=flashcards and formato=word', (done) => {
      const mockBlob = new Blob(['dummy'], { type: 'application/docx' });
      mockHttpPost.mockReturnValue(of(mockBlob));

      const filtros: { temas?: number[]; dificultad?: string } = {
        temas: [1, 2],
        dificultad: 'BASICO',
      };
      const type: 'test' | 'flashcards' = 'flashcards';
      const formato: 'excel' | 'word' = 'word';

      service.exportarFallos$(filtros, type, formato).subscribe(() => {
        expect(mockHttpPost).toHaveBeenCalledWith(
          `${environment.apiUrl}/reportes/exportar`,
          { ...filtros, type, formato },
          { responseType: 'blob', withCredentials: true },
        );
        done();
      });
    });

    it('should spread filtros into request body alongside type and formato', (done) => {
      const mockBlob = new Blob(['dummy']);
      mockHttpPost.mockReturnValue(of(mockBlob));

      const filtros: { temas?: number[]; dificultad?: string } = {
        temas: [3, 7],
        dificultad: 'INTERMEDIO',
      };

      service.exportarFallos$(filtros, 'test', 'excel').subscribe(() => {
        const calledBody = mockHttpPost.mock.calls[0][1];
        expect(calledBody).toMatchObject({
          temas: [3, 7],
          dificultad: 'INTERMEDIO',
          type: 'test',
          formato: 'excel',
        });
        done();
      });
    });
  });

  describe('resolverFallo$', () => {
    it('should PATCH to /reportes/fallo/:id/resolver', (done) => {
      mockHttpPatch.mockReturnValue(of({ id: 5, resuelto: true }));

      service.resolverFallo$(5).subscribe((result) => {
        expect(mockHttpPatch).toHaveBeenCalledWith(
          `${environment.apiUrl}/reportes/fallo/5/resolver`,
          {},
          { withCredentials: true },
        );
        expect(result).toMatchObject({ id: 5, resuelto: true });
        done();
      });
    });
  });
});
