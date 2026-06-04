import { Component } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { COMMON_TEST_PROVIDERS } from '../../../testing/common-providers';
import { WooCommerceProductSummary } from '../../../cursos/models/curso.model';
import { WooCommerceProductPickerComponent } from './woocommerce-product-picker.component';
import { environment } from '../../../../environments/environment';

@Component({
  standalone: true,
  imports: [WooCommerceProductPickerComponent, ReactiveFormsModule],
  template: `<app-woocommerce-product-picker
    endpoint="cursos"
    [formControl]="control"
    (selectionChange)="onSelect($event)"
  ></app-woocommerce-product-picker>`,
})
class HostComponent {
  control = new FormControl<number | null>(null);
  lastSelection: WooCommerceProductSummary | null = null;
  onSelect(p: WooCommerceProductSummary | null) {
    this.lastSelection = p;
  }
}

describe('WooCommerceProductPickerComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let httpMock: HttpTestingController;

  const PRODUCTS = [
    {
      id: 11,
      name: 'Curso Bombero Madrid',
      sku: 'CURSO-MAD',
      price: '49.00',
      regular_price: '49.00',
      sale_price: null,
      status: 'publish',
    },
    {
      id: 12,
      name: 'Curso Alicante',
      sku: 'CURSO-ALI',
      price: '69.00',
      regular_price: '69.00',
      sale_price: null,
      status: 'publish',
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        ...COMMON_TEST_PROVIDERS,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('debe crearse', () => {
    expect(host).toBeTruthy();
    // El picker dispara HTTP en init; flushamos para no dejar open request.
    httpMock
      .expectOne(`${environment.apiUrl}/woocommerce/products/cursos`)
      .flush([]);
  });

  it('hace fetch a /woocommerce/products/cursos al inicializar', () => {
    const req = httpMock.expectOne(
      `${environment.apiUrl}/woocommerce/products/cursos`,
    );
    expect(req.request.method).toBe('GET');
    req.flush(PRODUCTS);
    fixture.detectChanges();
    const picker = fixture.debugElement.children[0].componentInstance;
    expect(picker.products()).toEqual(PRODUCTS);
  });

  it('ControlValueAccessor: cambiar la selección actualiza el FormControl', () => {
    const req = httpMock.expectOne(
      `${environment.apiUrl}/woocommerce/products/cursos`,
    );
    req.flush(PRODUCTS);
    fixture.detectChanges();
    const picker = fixture.debugElement.children[0].componentInstance;
    picker.onModelChange(12);
    expect(host.control.value).toBe(12);
  });

  it('selectionChange emite el producto completo, no sólo el id', () => {
    const req = httpMock.expectOne(
      `${environment.apiUrl}/woocommerce/products/cursos`,
    );
    req.flush(PRODUCTS);
    fixture.detectChanges();
    const picker = fixture.debugElement.children[0].componentInstance;
    picker.onModelChange(11);
    expect(host.lastSelection).toEqual(PRODUCTS[0]);
  });

  it('precioFormateado devuelve euros formateados', () => {
    const req = httpMock.expectOne(
      `${environment.apiUrl}/woocommerce/products/cursos`,
    );
    req.flush(PRODUCTS);
    fixture.detectChanges();
    const picker = fixture.debugElement.children[0].componentInstance;
    picker.onModelChange(11);
    expect(picker.precioFormateado()).toContain('49');
  });

  it('marca error si el endpoint falla', () => {
    const req = httpMock.expectOne(
      `${environment.apiUrl}/woocommerce/products/cursos`,
    );
    req.error(new ErrorEvent('Network error'));
    fixture.detectChanges();
    const picker = fixture.debugElement.children[0].componentInstance;
    expect(picker.error()).toBe(true);
  });

  // MED-5 (codex review): HTTP error muestra toast + apaga loading.
  it('HTTP 500 → toast.error visible + loading=false', () => {
    const toast = TestBed.inject(ToastrService);
    (toast.error as jest.Mock).mockClear();
    const req = httpMock.expectOne(
      `${environment.apiUrl}/woocommerce/products/cursos`,
    );
    req.flush(
      { message: 'Internal error' },
      { status: 500, statusText: 'Server Error' },
    );
    fixture.detectChanges();
    const picker = fixture.debugElement.children[0].componentInstance;
    expect(picker.error()).toBe(true);
    expect(picker.loading()).toBe(false);
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining('WooCommerce'),
    );
  });
});
