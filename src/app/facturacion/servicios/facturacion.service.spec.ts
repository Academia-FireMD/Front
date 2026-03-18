import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { PaginationFilter } from '../../shared/models/pagination.model';
import { Factura, FacturasResponse } from '../models/factura.model';
import { FacturacionService } from './facturacion.service';

const BASE = `${environment.apiUrl}/admin/facturas`;

const facturasMock: Factura[] = [
  {
    id: 1,
    numero: 'TEST-2026-0001',
    serie: 'TEST',
    tipo: 'NORMAL',
    estado: 'EMITIDA',
    clienteNombre: 'Cliente Test',
    clienteEmail: 'test@test.com',
    clienteNif: '12345678A',
    clienteDireccion: 'Calle Test 1',
    clientePoblacion: 'Valencia',
    clienteCodigoPostal: '46000',
    clientePais: 'ES',
    concepto: 'Suscripción Premium',
    baseImponible: 100,
    tipoIva: 21,
    cuotaIva: 21,
    total: 121,
    dryRun: true,
    createdAt: '2026-03-18T00:00:00.000Z',
    updatedAt: '2026-03-18T00:00:00.000Z',
  } as any,
];

const apiResponse: FacturasResponse = {
  facturas: facturasMock,
  total: 1,
  pagina: 1,
  porPagina: 20,
  totalPaginas: 1,
};

describe('FacturacionService', () => {
  let service: FacturacionService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [FacturacionService],
    });
    service = TestBed.inject(FacturacionService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  // ─────────────────────────────────────────────────────────────
  // listar$
  // ─────────────────────────────────────────────────────────────
  describe('listar$', () => {
    it('convierte skip/take a pagina/porPagina correctamente', () => {
      const pagination: PaginationFilter = { skip: 0, take: 20, searchTerm: '' };

      service.listar$(pagination).subscribe();

      const req = httpMock.expectOne((r) => r.url === BASE);
      expect(req.request.params.get('pagina')).toBe('1');
      expect(req.request.params.get('porPagina')).toBe('20');
      req.flush(apiResponse);
    });

    it('calcula pagina correctamente con skip > 0', () => {
      const pagination: PaginationFilter = { skip: 40, take: 20, searchTerm: '' };

      service.listar$(pagination).subscribe();

      const req = httpMock.expectOne((r) => r.url === BASE);
      expect(req.request.params.get('pagina')).toBe('3');
      req.flush(apiResponse);
    });

    it('mapea la respuesta al formato PaginatedResult<Factura>', () => {
      const pagination: PaginationFilter = { skip: 0, take: 20, searchTerm: '' };
      let result: any;

      service.listar$(pagination).subscribe((r) => (result = r));

      const req = httpMock.expectOne((r) => r.url === BASE);
      req.flush(apiResponse);

      expect(result.data).toEqual(facturasMock);
      expect(result.pagination.count).toBe(1);
      expect(result.pagination.skip).toBe(0);
      expect(result.pagination.take).toBe(20);
      expect(result.pagination.searchTerm).toBe('');
    });

    it('pasa filtros tipo, estado, desde, hasta desde where', () => {
      const pagination: PaginationFilter = {
        skip: 0,
        take: 10,
        searchTerm: '',
        where: { tipo: 'NORMAL', estado: 'EMITIDA', desde: '2026-01-01', hasta: '2026-12-31' },
      };

      service.listar$(pagination).subscribe();

      const req = httpMock.expectOne((r) => r.url === BASE);
      expect(req.request.params.get('tipo')).toBe('NORMAL');
      expect(req.request.params.get('estado')).toBe('EMITIDA');
      expect(req.request.params.get('desde')).toBe('2026-01-01');
      expect(req.request.params.get('hasta')).toBe('2026-12-31');
      req.flush({ ...apiResponse, facturas: [] });
    });

    it('no incluye filtros vacíos en los params', () => {
      const pagination: PaginationFilter = { skip: 0, take: 20, searchTerm: '' };

      service.listar$(pagination).subscribe();

      const req = httpMock.expectOne((r) => r.url === BASE);
      expect(req.request.params.has('tipo')).toBe(false);
      expect(req.request.params.has('estado')).toBe(false);
      expect(req.request.params.has('desde')).toBe(false);
      expect(req.request.params.has('hasta')).toBe(false);
      req.flush(apiResponse);
    });

    it('usa paginación por defecto cuando no se pasan parámetros', () => {
      service.listar$().subscribe();

      const req = httpMock.expectOne((r) => r.url === BASE);
      expect(req.request.params.get('pagina')).toBe('1');
      expect(req.request.params.get('porPagina')).toBe('20');
      req.flush(apiResponse);
    });

    it('pasa usuarioId desde where si está presente', () => {
      const pagination: PaginationFilter = {
        skip: 0,
        take: 20,
        searchTerm: '',
        where: { usuarioId: 42 },
      };

      service.listar$(pagination).subscribe();

      const req = httpMock.expectOne((r) => r.url === BASE);
      expect(req.request.params.get('usuarioId')).toBe('42');
      req.flush(apiResponse);
    });

    it('pasa searchTerm como query param cuando está presente', () => {
      const pagination: PaginationFilter = {
        skip: 0,
        take: 20,
        searchTerm: 'cliente test',
      };

      service.listar$(pagination).subscribe();

      const req = httpMock.expectOne((r) => r.url === BASE);
      expect(req.request.params.get('searchTerm')).toBe('cliente test');
      req.flush(apiResponse);
    });

    it('convierte dateRange en where a desde/hasta', () => {
      const pagination: PaginationFilter = {
        skip: 0,
        take: 20,
        searchTerm: '',
        where: {
          dateRange: [new Date('2026-01-01'), new Date('2026-12-31')],
        },
      };

      service.listar$(pagination).subscribe();

      const req = httpMock.expectOne((r) => r.url === BASE);
      expect(req.request.params.get('desde')).toBe('2026-01-01');
      expect(req.request.params.get('hasta')).toBe('2026-12-31');
      req.flush(apiResponse);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // crearManual$
  // ─────────────────────────────────────────────────────────────
  describe('crearManual$', () => {
    it('hace POST a /manual con el DTO', () => {
      const dto = { clienteNombre: 'Test', concepto: 'Servicio', baseImponible: 100 } as any;
      let result: any;

      service.crearManual$(dto).subscribe((r) => (result = r));

      const req = httpMock.expectOne(`${BASE}/manual`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(dto);
      req.flush({ id: 1, ...dto });

      expect(result.id).toBe(1);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // crearRectificativa$
  // ─────────────────────────────────────────────────────────────
  describe('crearRectificativa$', () => {
    it('hace POST a /:id/rectificativa con el motivo', () => {
      const dto = { motivo: 'Error en factura' };
      let result: any;

      service.crearRectificativa$(5, dto).subscribe((r) => (result = r));

      const req = httpMock.expectOne(`${BASE}/5/rectificativa`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(dto);
      req.flush({ id: 10, tipo: 'RECTIFICATIVA' });

      expect(result.tipo).toBe('RECTIFICATIVA');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // descargarPdf$
  // ─────────────────────────────────────────────────────────────
  describe('descargarPdf$', () => {
    it('hace GET a /:id/pdf con responseType blob', () => {
      service.descargarPdf$(3).subscribe();

      const req = httpMock.expectOne(`${BASE}/3/pdf`);
      expect(req.request.method).toBe('GET');
      expect(req.request.responseType).toBe('blob');
      req.flush(new Blob(['%PDF']));
    });
  });

  // ─────────────────────────────────────────────────────────────
  // misFacturas$
  // ─────────────────────────────────────────────────────────────
  describe('misFacturas$', () => {
    it('hace GET a /mis-facturas y mapea la respuesta', () => {
      const pagination: PaginationFilter = { skip: 0, take: 20, searchTerm: '' };
      let result: any;

      service.misFacturas$(pagination).subscribe((r) => (result = r));

      const req = httpMock.expectOne((r) => r.url.includes(`${BASE}/mis-facturas`));
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('pagina')).toBe('1');
      expect(req.request.params.get('porPagina')).toBe('20');
      req.flush(apiResponse);

      expect(result.data).toEqual(facturasMock);
      expect(result.pagination.count).toBe(1);
    });

    it('pasa searchTerm como query param', () => {
      service.misFacturas$({ skip: 0, take: 20, searchTerm: 'test' }).subscribe();

      const req = httpMock.expectOne((r) => r.url.includes(`${BASE}/mis-facturas`));
      expect(req.request.params.get('searchTerm')).toBe('test');
      req.flush(apiResponse);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // descargarMiPdf$
  // ─────────────────────────────────────────────────────────────
  describe('descargarMiPdf$', () => {
    it('hace GET a /mis-facturas/:id/pdf con responseType blob', () => {
      service.descargarMiPdf$(5).subscribe();

      const req = httpMock.expectOne(`${BASE}/mis-facturas/5/pdf`);
      expect(req.request.method).toBe('GET');
      expect(req.request.responseType).toBe('blob');
      req.flush(new Blob(['%PDF']));
    });
  });
});
