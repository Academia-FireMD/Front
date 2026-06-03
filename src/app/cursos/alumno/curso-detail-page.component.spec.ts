import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ToastrService } from 'ngx-toastr';
import { of, throwError } from 'rxjs';
import { COMMON_TEST_PROVIDERS } from '../../testing/common-providers';
import {
  ComprarCursoCofResponse,
  CursoSlugResponse,
} from '../models/curso.model';
import { CursosAlumnoService } from '../services/cursos-alumno.service';
import { CursoDetailPageComponent } from './curso-detail-page.component';

/**
 * Cobertura HIGH-4 (codex review):
 *  - `previewData` solo activa el bypass cuando `previewMode=true`.
 *  - Sin `previewMode`, el componente hace fetch HTTP (AccesoCurso check).
 */
describe('CursoDetailPageComponent (HIGH-4 preview guard)', () => {
  let fixture: ComponentFixture<CursoDetailPageComponent>;
  let component: CursoDetailPageComponent;
  let serviceMock: { getCurso: jest.Mock };

  const PREVIEW: CursoSlugResponse = {
    curso: {
      id: 0,
      titulo: 'Borrador admin',
      slug: 'preview',
      estado: 'BORRADOR',
      secciones: [],
    },
    tieneAcceso: true,
  };

  beforeEach(async () => {
    serviceMock = { getCurso: jest.fn().mockReturnValue(of(PREVIEW)) };
    await TestBed.configureTestingModule({
      imports: [CursoDetailPageComponent],
      providers: [
        ...COMMON_TEST_PROVIDERS,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CursosAlumnoService, useValue: serviceMock },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();
    fixture = TestBed.createComponent(CursoDetailPageComponent);
    component = fixture.componentInstance;
  });

  it('previewMode=true + previewData → NO fetch HTTP, usa previewData', () => {
    fixture.componentRef.setInput('previewMode', true);
    fixture.componentRef.setInput('previewData', PREVIEW);
    fixture.detectChanges();
    expect(serviceMock.getCurso).not.toHaveBeenCalled();
    expect(component.isPreview()).toBe(true);
    expect(component.cursoData()).toEqual(PREVIEW);
  });

  it('Solo previewData sin previewMode=true → HTTP fetch normal (no bypass)', () => {
    // HIGH-4: si un consumer accidental olvida previewMode, NO debe activar
    // el bypass de AccesoCurso. Debe correr la ruta HTTP normal.
    fixture.componentRef.setInput('previewData', PREVIEW);
    // previewMode queda en su default (false)
    fixture.detectChanges();
    expect(serviceMock.getCurso).toHaveBeenCalled();
    expect(component.isPreview()).toBe(false);
  });

  it('Sin previewData ni previewMode → fetch HTTP normal', () => {
    fixture.detectChanges();
    expect(serviceMock.getCurso).toHaveBeenCalled();
    expect(component.isPreview()).toBe(false);
  });
});

describe('CursoDetailPageComponent (compra COF 1-clic)', () => {
  let fixture: ComponentFixture<CursoDetailPageComponent>;
  let component: CursoDetailPageComponent;
  let serviceMock: { getCurso: jest.Mock; comprarCursoCof: jest.Mock };
  let toast: { success: jest.Mock; error: jest.Mock; info: jest.Mock };

  const SIN_ACCESO: CursoSlugResponse = {
    curso: {
      id: 7,
      titulo: 'Curso Online',
      slug: 'curso-online',
      estado: 'PUBLICADO',
      wooProductId: 4321,
      secciones: [],
    },
    tieneAcceso: false,
  };

  const WOO_URL = 'https://staging2.tecnikafire.com/tienda';

  beforeEach(async () => {
    serviceMock = {
      getCurso: jest.fn().mockReturnValue(of(SIN_ACCESO)),
      comprarCursoCof: jest.fn(),
    };
    await TestBed.configureTestingModule({
      imports: [CursoDetailPageComponent],
      providers: [
        ...COMMON_TEST_PROVIDERS,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CursosAlumnoService, useValue: serviceMock },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();
    fixture = TestBed.createComponent(CursoDetailPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges(); // ngOnInit → getCurso → cursoData = SIN_ACCESO
    toast = TestBed.inject(ToastrService) as unknown as typeof toast;
    toast.success.mockClear();
    toast.error.mockClear();
    toast.info.mockClear();
    jest.spyOn(window, 'open').mockImplementation(() => null);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('arranca sin acceso (tieneAcceso=false)', () => {
    expect(component.cursoData()?.tieneAcceso).toBe(false);
  });

  it('success → concede acceso (tieneAcceso=true) + toast éxito', () => {
    const res: ComprarCursoCofResponse = {
      success: true,
      accesoId: 11,
      mensaje: 'Ya tienes acceso a este curso',
    };
    serviceMock.comprarCursoCof.mockReturnValue(of(res));

    component.comprar();

    expect(serviceMock.comprarCursoCof).toHaveBeenCalledWith(7);
    expect(component.cursoData()?.tieneAcceso).toBe(true);
    expect(component.comprando()).toBe(false);
    expect(toast.success).toHaveBeenCalled();
  });

  it('requiereCheckout → diálogo + "Completar en la tienda" abre WC con add-to-cart=wooProductId', () => {
    const res: ComprarCursoCofResponse = {
      success: false,
      requiereCheckout: true,
      wooProductId: 999,
      mensaje: 'Sin tarjeta guardada',
    };
    serviceMock.comprarCursoCof.mockReturnValue(of(res));

    component.comprar();

    expect(component.checkoutDialogVisible()).toBe(true);
    expect(component.checkoutEsRechazo()).toBe(false);
    expect(component.checkoutWooProductId()).toBe(999);
    expect(component.cursoData()?.tieneAcceso).toBe(false);

    component.completarEnTienda();
    expect(window.open).toHaveBeenCalledWith(
      `${WOO_URL}?add-to-cart=999`,
      '_blank',
    );
  });

  it('PAGO_RECHAZADO → diálogo de rechazo + CTA tienda del curso, sin conceder acceso', () => {
    const res: ComprarCursoCofResponse = {
      success: false,
      error: 'PAGO_RECHAZADO',
      mensaje: 'Tarjeta rechazada',
    };
    serviceMock.comprarCursoCof.mockReturnValue(of(res));

    component.comprar();

    expect(component.checkoutDialogVisible()).toBe(true);
    expect(component.checkoutEsRechazo()).toBe(true);
    expect(component.checkoutWooProductId()).toBe(4321);
    expect(component.cursoData()?.tieneAcceso).toBe(false);

    component.completarEnTienda();
    expect(window.open).toHaveBeenCalledWith(
      `${WOO_URL}?add-to-cart=4321`,
      '_blank',
    );
  });

  it('ERROR_TEMPORAL → toast error, reintentable', () => {
    const res: ComprarCursoCofResponse = {
      success: false,
      error: 'ERROR_TEMPORAL',
      mensaje: 'Inténtalo de nuevo',
    };
    serviceMock.comprarCursoCof.mockReturnValue(of(res));

    component.comprar();

    expect(toast.error).toHaveBeenCalled();
    expect(component.comprando()).toBe(false);
    expect(component.checkoutDialogVisible()).toBe(false);
    component.comprar();
    expect(serviceMock.comprarCursoCof).toHaveBeenCalledTimes(2);
  });

  it('YA_TIENES → concede acceso + toast info', () => {
    const res: ComprarCursoCofResponse = {
      success: false,
      error: 'YA_TIENES',
      mensaje: 'Ya tienes este curso',
    };
    serviceMock.comprarCursoCof.mockReturnValue(of(res));

    component.comprar();

    expect(component.cursoData()?.tieneAcceso).toBe(true);
    expect(toast.info).toHaveBeenCalled();
  });

  it('error HTTP no clasificado → toast error + re-habilita', () => {
    serviceMock.comprarCursoCof.mockReturnValue(
      throwError(() => new Error('boom')),
    );
    component.comprar();
    expect(toast.error).toHaveBeenCalled();
    expect(component.comprando()).toBe(false);
  });

  it('modo preview → no dispara compra', () => {
    fixture.componentRef.setInput('previewMode', true);
    fixture.componentRef.setInput('previewData', SIN_ACCESO);
    fixture.detectChanges();
    component.comprar();
    expect(serviceMock.comprarCursoCof).not.toHaveBeenCalled();
  });
});
