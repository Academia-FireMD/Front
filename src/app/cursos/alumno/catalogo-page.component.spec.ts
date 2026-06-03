import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ToastrService } from 'ngx-toastr';
import { of, Subject, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { COMMON_TEST_PROVIDERS } from '../../testing/common-providers';
import { ComprarCursoCofResponse, CursoPublico } from '../models/curso.model';
import { CursosAlumnoService } from '../services/cursos-alumno.service';
import { CatalogoPageComponent } from './catalogo-page.component';

describe('CatalogoPageComponent (compra COF 1-clic)', () => {
  let fixture: ComponentFixture<CatalogoPageComponent>;
  let component: CatalogoPageComponent;
  let serviceMock: {
    listCatalogo: jest.Mock;
    comprarCursoCof: jest.Mock;
  };
  let toast: { success: jest.Mock; error: jest.Mock; info: jest.Mock };

  const CURSO: CursoPublico = {
    id: 7,
    titulo: 'Curso Online',
    slug: 'curso-online',
    estado: 'PUBLICADO',
    wooProductId: 4321,
  };

  beforeEach(async () => {
    serviceMock = {
      listCatalogo: jest.fn().mockReturnValue(of([CURSO])),
      comprarCursoCof: jest.fn(),
    };
    await TestBed.configureTestingModule({
      imports: [CatalogoPageComponent],
      providers: [
        ...COMMON_TEST_PROVIDERS,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CursosAlumnoService, useValue: serviceMock },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(CatalogoPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    toast = TestBed.inject(ToastrService) as unknown as typeof toast;
    toast.success.mockClear();
    toast.error.mockClear();
    toast.info.mockClear();
    jest.spyOn(window, 'open').mockImplementation(() => null);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('carga el catálogo en ngOnInit', () => {
    expect(component.cursos()).toEqual([CURSO]);
    expect(component.loading()).toBe(false);
  });

  it('success → marca comprado (botón pasa a "Ver curso") + toast éxito', () => {
    const res: ComprarCursoCofResponse = {
      success: true,
      accesoId: 99,
      mensaje: 'Ya tienes acceso a este curso',
    };
    serviceMock.comprarCursoCof.mockReturnValue(of(res));

    component.comprar(CURSO);

    expect(serviceMock.comprarCursoCof).toHaveBeenCalledWith(CURSO.id);
    expect(component.yaComprado(CURSO)).toBe(true);
    expect(component.comprandoId()).toBeNull();
    expect(toast.success).toHaveBeenCalled();
    expect(component.checkoutDialogVisible()).toBe(false);
  });

  it('requiereCheckout → abre diálogo y "Completar en la tienda" abre WC con add-to-cart=wooProductId', () => {
    const res: ComprarCursoCofResponse = {
      success: false,
      requiereCheckout: true,
      wooProductId: 555,
      mensaje: 'No tienes tarjeta guardada',
    };
    serviceMock.comprarCursoCof.mockReturnValue(of(res));

    component.comprar(CURSO);

    expect(component.checkoutDialogVisible()).toBe(true);
    expect(component.checkoutEsRechazo()).toBe(false);
    expect(component.checkoutWooProductId()).toBe(555);
    // No se marca comprado: aún no tiene acceso.
    expect(component.yaComprado(CURSO)).toBe(false);

    component.completarEnTienda();
    expect(window.open).toHaveBeenCalledWith(
      `${environment.wooCommerceUrl}?add-to-cart=555`,
      '_blank',
    );
    expect(component.checkoutDialogVisible()).toBe(false);
  });

  it('PAGO_RECHAZADO → diálogo de rechazo + CTA tienda (add-to-cart del curso), NO marca comprado', () => {
    const res: ComprarCursoCofResponse = {
      success: false,
      error: 'PAGO_RECHAZADO',
      mensaje: 'Tu tarjeta fue rechazada',
    };
    serviceMock.comprarCursoCof.mockReturnValue(of(res));

    component.comprar(CURSO);

    expect(component.checkoutDialogVisible()).toBe(true);
    expect(component.checkoutEsRechazo()).toBe(true);
    expect(component.checkoutWooProductId()).toBe(CURSO.wooProductId);
    expect(component.yaComprado(CURSO)).toBe(false);

    component.completarEnTienda();
    expect(window.open).toHaveBeenCalledWith(
      `${environment.wooCommerceUrl}?add-to-cart=${CURSO.wooProductId}`,
      '_blank',
    );
  });

  it('ERROR_TEMPORAL → toast error, reintentable (no marca comprado, no abre diálogo)', () => {
    const res: ComprarCursoCofResponse = {
      success: false,
      error: 'ERROR_TEMPORAL',
      mensaje: 'No se pudo procesar',
    };
    serviceMock.comprarCursoCof.mockReturnValue(of(res));

    component.comprar(CURSO);

    expect(toast.error).toHaveBeenCalled();
    expect(component.comprandoId()).toBeNull();
    expect(component.yaComprado(CURSO)).toBe(false);
    expect(component.checkoutDialogVisible()).toBe(false);
    // Reintentable: una segunda llamada vuelve a invocar el servicio.
    component.comprar(CURSO);
    expect(serviceMock.comprarCursoCof).toHaveBeenCalledTimes(2);
  });

  it('YA_TIENES → marca comprado + toast info', () => {
    const res: ComprarCursoCofResponse = {
      success: false,
      error: 'YA_TIENES',
      mensaje: 'Ya tienes este curso',
    };
    serviceMock.comprarCursoCof.mockReturnValue(of(res));

    component.comprar(CURSO);

    expect(component.yaComprado(CURSO)).toBe(true);
    expect(toast.info).toHaveBeenCalled();
  });

  it('error HTTP no clasificado → toast error + re-habilita', () => {
    serviceMock.comprarCursoCof.mockReturnValue(
      throwError(() => new Error('network')),
    );

    component.comprar(CURSO);

    expect(toast.error).toHaveBeenCalled();
    expect(component.comprandoId()).toBeNull();
  });

  it('no dispara compra sin wooProductId', () => {
    component.comprar({ ...CURSO, wooProductId: null });
    expect(serviceMock.comprarCursoCof).not.toHaveBeenCalled();
  });

  it('no dispara una 2ª compra mientras hay una en vuelo', () => {
    // Subject que nunca emite → comprandoId queda set (cobro en vuelo).
    serviceMock.comprarCursoCof.mockReturnValue(
      new Subject<ComprarCursoCofResponse>().asObservable(),
    );
    component.comprar(CURSO);
    expect(component.comprandoId()).toBe(CURSO.id);
    component.comprar(CURSO);
    expect(serviceMock.comprarCursoCof).toHaveBeenCalledTimes(1);
  });
});
