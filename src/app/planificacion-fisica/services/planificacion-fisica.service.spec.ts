import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { PlanificacionFisicaService } from './planificacion-fisica.service';

describe('PlanificacionFisicaService', () => {
  let service: PlanificacionFisicaService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(PlanificacionFisicaService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('preview manda el fichero como multipart', () => {
    const file = new File(['x'], 'p.xlsx');
    service.preview(file).subscribe();
    const req = http.expectOne(
      `${environment.apiUrl}/planificacion-fisica/preview`,
    );
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBe(true);
    req.flush({ resumen: null, errores: [] });
  });

  it('importar manda el fichero como multipart', () => {
    const file = new File(['x'], 'p.xlsx');
    service.importar(file).subscribe();
    const req = http.expectOne(
      `${environment.apiUrl}/planificacion-fisica/import`,
    );
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBe(true);
    req.flush({ bloqueId: 1, errores: [] });
  });

  it('listarBloques llama al endpoint correcto', () => {
    service.listarBloques().subscribe();
    const req = http.expectOne(
      `${environment.apiUrl}/planificacion-fisica/bloques`,
    );
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('publicar llama al endpoint correcto', () => {
    service.publicar(7).subscribe();
    const req = http.expectOne(
      `${environment.apiUrl}/planificacion-fisica/bloques/7/publicar`,
    );
    expect(req.request.method).toBe('PUT');
    req.flush({});
  });

  it('eliminar llama al endpoint correcto sin force por defecto', () => {
    service.eliminar(7).subscribe();
    const req = http.expectOne(
      `${environment.apiUrl}/planificacion-fisica/bloques/7`,
    );
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('eliminar añade ?force=true cuando se pide forzar', () => {
    service.eliminar(7, true).subscribe();
    const req = http.expectOne(
      `${environment.apiUrl}/planificacion-fisica/bloques/7?force=true`,
    );
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('descargarPlantillaUrl devuelve la URL del endpoint de plantilla', () => {
    expect(service.descargarPlantillaUrl()).toBe(
      `${environment.apiUrl}/planificacion-fisica/plantilla`,
    );
  });
});
