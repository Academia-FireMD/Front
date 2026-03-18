import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { COMMON_TEST_PROVIDERS } from '../../../testing';
import { FacturacionService } from '../../servicios/facturacion.service';
import { MisFacturasComponent } from './mis-facturas.component';

const mockFacturacionService = {
  misFacturas$: jest.fn(() =>
    of({
      data: [
        {
          id: 1,
          numero: '2026-0001',
          concepto: 'Suscripción',
          tipo: 'NORMAL',
          estado: 'EMITIDA',
          total: 121,
          contasimpleId: 'CS-001',
          createdAt: '2026-03-18',
        },
      ],
      pagination: { skip: 0, take: 20, searchTerm: '', count: 1 },
    })
  ),
  descargarMiPdf$: jest.fn(() => of(new Blob(['%PDF']))),
};

describe('MisFacturasComponent', () => {
  let component: MisFacturasComponent;
  let fixture: ComponentFixture<MisFacturasComponent>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MisFacturasComponent],
      providers: [
        ...COMMON_TEST_PROVIDERS,
        { provide: FacturacionService, useValue: mockFacturacionService },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(MisFacturasComponent);
    component = fixture.componentInstance;
  });

  it('debería crearse correctamente', () => {
    expect(component).toBeTruthy();
  });

  it('getEstadoChipClass devuelve la clase correcta por estado', () => {
    expect(component.getEstadoChipClass('EMITIDA')).toBe('estado-emitida-chip');
    expect(component.getEstadoChipClass('PENDIENTE')).toBe('estado-pendiente-chip');
    expect(component.getEstadoChipClass('ERROR')).toBe('estado-error-chip');
  });

  it('usa misFacturas$ en fetchItems$', (done) => {
    component.fetchItems$().subscribe(() => {
      expect(mockFacturacionService.misFacturas$).toHaveBeenCalled();
      done();
    });
  });

  it('descargarPdf llama a descargarMiPdf$ cuando la factura tiene contasimpleId', async () => {
    const factura = { id: 1, numero: '2026-0001', contasimpleId: 'CS-001' } as any;
    const event = { stopPropagation: jest.fn() } as any;

    await component.descargarPdf(factura, event);

    expect(event.stopPropagation).toHaveBeenCalled();
    expect(mockFacturacionService.descargarMiPdf$).toHaveBeenCalledWith(1);
  });

  it('descargarPdf muestra toast cuando la factura no tiene contasimpleId', async () => {
    const factura = { id: 1, numero: '2026-0001', contasimpleId: null } as any;
    const event = { stopPropagation: jest.fn() } as any;
    const warnSpy = jest.spyOn(component.toast, 'warning');

    await component.descargarPdf(factura, event);

    expect(warnSpy).toHaveBeenCalledWith('Esta factura aún no tiene PDF disponible');
    expect(mockFacturacionService.descargarMiPdf$).not.toHaveBeenCalled();
  });
});
