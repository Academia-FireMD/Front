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

  it('detallesDeBloque llama al endpoint correcto', () => {
    service.detallesDeBloque(3).subscribe();
    const req = http.expectOne(
      `${environment.apiUrl}/planificacion-fisica/bloques/3/detalles`,
    );
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('actualizarDetalle manda el body y llama al endpoint correcto', () => {
    service
      .actualizarDetalle(45, { contenido: '4x400m', comentario: 'suave' })
      .subscribe();
    const req = http.expectOne(
      `${environment.apiUrl}/planificacion-fisica/detalles/45`,
    );
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({
      contenido: '4x400m',
      comentario: 'suave',
    });
    req.flush({});
  });

  it('miPlan llama al endpoint correcto y propaga null cuando no hay plan', () => {
    let recibido: unknown = 'sin-emitir';
    service.miPlan().subscribe((res) => (recibido = res));
    const req = http.expectOne(
      `${environment.apiUrl}/planificacion-fisica/mi-plan`,
    );
    expect(req.request.method).toBe('GET');
    req.flush(null);
    expect(recibido).toBeNull();
  });

  it('miPlan propaga el cuerpo del 403 TIER_TOO_LOW sin transformarlo', () => {
    let errorRecibido: { error?: { reason?: string } } | undefined;
    service.miPlan().subscribe({
      error: (err) => (errorRecibido = err),
    });
    const req = http.expectOne(
      `${environment.apiUrl}/planificacion-fisica/mi-plan`,
    );
    req.flush(
      {
        reason: 'TIER_TOO_LOW',
        requiredTier: 'ADVANCED',
        message: 'Mejora tu suscripción.',
      },
      { status: 403, statusText: 'Forbidden' },
    );
    expect(errorRecibido?.error?.reason).toBe('TIER_TOO_LOW');
  });

  it('miPlan con bloqueId lo manda como query param', () => {
    service.miPlan(7).subscribe();
    const req = http.expectOne(
      `${environment.apiUrl}/planificacion-fisica/mi-plan?bloqueId=7`,
    );
    expect(req.request.method).toBe('GET');
    req.flush(null);
  });

  it('misBloques llama al endpoint correcto', () => {
    let recibido: unknown;
    service.misBloques().subscribe((res) => (recibido = res));
    const req = http.expectOne(
      `${environment.apiUrl}/planificacion-fisica/mis-bloques`,
    );
    expect(req.request.method).toBe('GET');
    const bloques = [
      {
        id: 2,
        identificador: 'Bloque Valencia',
        relevancia: [],
        esActivo: true,
      },
    ];
    req.flush(bloques);
    expect(recibido).toEqual(bloques);
  });

  it('dia llama al endpoint correcto con la fecha', () => {
    service.dia('2026-07-15').subscribe();
    const req = http.expectOne(
      `${environment.apiUrl}/planificacion-fisica/dia/2026-07-15`,
    );
    expect(req.request.method).toBe('GET');
    req.flush({
      fecha: '2026-07-15',
      comentarioSemana: null,
      comentarioGeneral: null,
      disciplinas: [],
    });
  });

  it('marcarProgreso manda el body y llama al endpoint correcto', () => {
    service.marcarProgreso(99, true).subscribe();
    const req = http.expectOne(
      `${environment.apiUrl}/planificacion-fisica/progreso/99`,
    );
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ realizado: true });
    req.flush({ realizado: true, realizadoEn: '2026-07-17T10:00:00Z' });
  });

  it('resumenDias llama al endpoint correcto con el rango de fechas', () => {
    let recibido: unknown = 'sin-emitir';
    service
      .resumenDias('2026-07-01', '2026-07-31')
      .subscribe((res) => (recibido = res));
    const req = http.expectOne(
      `${environment.apiUrl}/planificacion-fisica/resumen-dias?desde=2026-07-01&hasta=2026-07-31`,
    );
    expect(req.request.method).toBe('GET');
    const dias = [
      {
        fecha: '2026-07-15',
        disciplinas: [
          { nombre: 'Cuerda 2', grupo: 'CUERDA', color: '#9fe2d0' },
        ],
      },
    ];
    req.flush(dias);
    expect(recibido).toEqual(dias);
  });

  it('resumenDias devuelve [] cuando el alumno no tiene bloque activo (BASIC/sin plan) — nunca 403', () => {
    let recibido: unknown = 'sin-emitir';
    service
      .resumenDias('2026-07-01', '2026-07-31')
      .subscribe((res) => (recibido = res));
    const req = http.expectOne(
      `${environment.apiUrl}/planificacion-fisica/resumen-dias?desde=2026-07-01&hasta=2026-07-31`,
    );
    req.flush([]);
    expect(recibido).toEqual([]);
  });

  it('marcas llama al endpoint correcto', () => {
    let recibido: unknown = 'sin-emitir';
    service.marcas().subscribe((res) => (recibido = res));
    const req = http.expectOne(
      `${environment.apiUrl}/planificacion-fisica/marcas`,
    );
    expect(req.request.method).toBe('GET');
    const marcas = [
      {
        id: 1,
        disciplinaId: 3,
        disciplinaNombre: 'Carrera 1',
        grupo: 'CARRERA',
        color: '#fdeaa8',
        valor: 12.4,
        unidad: 'min',
        fecha: '2026-07-10',
        notas: null,
      },
    ];
    req.flush(marcas);
    expect(recibido).toEqual(marcas);
  });

  it('marcas propaga el cuerpo del 403 TIER_TOO_LOW sin transformarlo', () => {
    let errorRecibido: { error?: { reason?: string } } | undefined;
    service.marcas().subscribe({
      error: (err) => (errorRecibido = err),
    });
    const req = http.expectOne(
      `${environment.apiUrl}/planificacion-fisica/marcas`,
    );
    req.flush(
      {
        reason: 'TIER_TOO_LOW',
        requiredTier: 'ADVANCED',
        message: 'Mejora tu suscripción.',
      },
      { status: 403, statusText: 'Forbidden' },
    );
    expect(errorRecibido?.error?.reason).toBe('TIER_TOO_LOW');
  });

  it('crearMarca manda el body y llama al endpoint correcto', () => {
    const dto = {
      disciplinaId: 3,
      valor: 12.4,
      unidad: 'min',
      fecha: '2026-07-10',
      notas: 'buena sensación',
    };
    service.crearMarca(dto).subscribe();
    const req = http.expectOne(
      `${environment.apiUrl}/planificacion-fisica/marcas`,
    );
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(dto);
    req.flush({
      id: 9,
      disciplinaId: 3,
      disciplinaNombre: 'Carrera 1',
      grupo: 'CARRERA',
      color: '#fdeaa8',
      valor: 12.4,
      unidad: 'min',
      fecha: '2026-07-10',
      notas: 'buena sensación',
    });
  });

  it('borrarMarca llama al endpoint correcto', () => {
    let recibido: unknown = 'sin-emitir';
    service.borrarMarca(9).subscribe((res) => (recibido = res));
    const req = http.expectOne(
      `${environment.apiUrl}/planificacion-fisica/marcas/9`,
    );
    expect(req.request.method).toBe('DELETE');
    req.flush({ ok: true });
    expect(recibido).toEqual({ ok: true });
  });
});
