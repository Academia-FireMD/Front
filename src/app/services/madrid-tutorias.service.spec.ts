import { HttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { MadridTutoriasService } from './madrid-tutorias.service';

describe('MadridTutoriasService', () => {
  it('consulta el saldo de créditos con la ruta protegida de Madrid', () => {
    const http = {
      get: jest.fn().mockReturnValue(of({ disponibles: 1 })),
    };

    TestBed.configureTestingModule({
      providers: [
        MadridTutoriasService,
        { provide: HttpClient, useValue: http },
      ],
    });

    const service = TestBed.inject(MadridTutoriasService);
    let response: unknown;
    service.getCreditBalance().subscribe((value) => (response = value));

    expect(response).toEqual({ disponibles: 1 });
    expect(http.get).toHaveBeenCalledWith(
      expect.stringContaining('/madrid-tutorias/creditos'),
      { withCredentials: true },
    );
  });
});
