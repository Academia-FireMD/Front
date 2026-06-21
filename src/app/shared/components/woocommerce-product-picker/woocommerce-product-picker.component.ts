import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  forwardRef,
  inject,
  input,
  OnInit,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  ControlValueAccessor,
  FormsModule,
  NG_VALUE_ACCESSOR,
} from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { DropdownModule } from 'primeng/dropdown';
import { environment } from '../../../../environments/environment';
import { WooCommerceProductSummary } from '../../../cursos/models/curso.model';

/**
 * Refactor 2026-05-25 (T14 / D17) — Picker compartido de productos
 * WooCommerce. Sólo callsite en este PR: form admin de cursos. La migración
 * de `examen-detailview` al shared picker está apuntada como TODO P2.
 *
 * `endpoint` controla la categoría (sólo `'cursos'` en este PR). Implementa
 * ControlValueAccessor para integrarse con `formControlName` / `[(ngModel)]`.
 * Emite también el objeto completo via `selectionChange` para que el caller
 * pueda auto-llenar campos derivados (precio, título…).
 */
export type WooPickerEndpoint = 'cursos';

@Component({
  selector: 'app-woocommerce-product-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, DropdownModule],
  templateUrl: './woocommerce-product-picker.component.html',
  styleUrls: ['./woocommerce-product-picker.component.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => WooCommerceProductPickerComponent),
      multi: true,
    },
  ],
})
export class WooCommerceProductPickerComponent
  implements ControlValueAccessor, OnInit
{
  private http = inject(HttpClient);
  private toast = inject(ToastrService);
  private destroyRef = inject(DestroyRef);

  readonly endpoint = input.required<WooPickerEndpoint>();
  readonly placeholder = input<string>('Selecciona producto WooCommerce');
  readonly disabledInput = input<boolean>(false);

  readonly selectionChange = output<WooCommerceProductSummary | null>();

  readonly products = signal<WooCommerceProductSummary[]>([]);
  readonly loading = signal<boolean>(false);
  readonly error = signal<boolean>(false);
  readonly value = signal<number | null>(null);
  readonly disabled = signal<boolean>(false);

  readonly selectedProduct = computed<WooCommerceProductSummary | null>(() => {
    const id = this.value();
    if (id == null) return null;
    return this.products().find((p) => p.id === id) ?? null;
  });

  readonly precioFormateado = computed<string | null>(() => {
    const p = this.selectedProduct();
    if (!p) return null;
    const raw = p.regular_price ?? p.price;
    if (!raw) return null;
    const num = Number(raw);
    if (!Number.isFinite(num)) return raw;
    return num.toLocaleString('es-ES', {
      style: 'currency',
      currency: 'EUR',
    });
  });

  private onChange: (value: number | null) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  ngOnInit(): void {
    this.fetch();
  }

  /**
   * MED-5 (codex review):
   *  - `takeUntilDestroyed(destroyRef)` previene leaks si el componente se
   *    destruye mientras la petición HTTP está pendiente.
   *  - Removido `catchError(() => of([]))` que silenciaba el error y dejaba
   *    el handler `error:` como dead code. Ahora el handler real corre, el
   *    usuario ve un toast, y el state `error()` queda en true para UX.
   */
  private fetch(): void {
    this.loading.set(true);
    this.error.set(false);
    this.http
      .get<WooCommerceProductSummary[]>(
        `${environment.apiUrl}/woocommerce/products/${this.endpoint()}`,
        { withCredentials: true },
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (products) => {
          this.products.set(products);
          this.error.set(false);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(true);
          this.loading.set(false);
          this.toast.error(
            'No se pudo cargar la lista de productos WooCommerce',
          );
          console.error('WC products load failed:', err);
        },
      });
  }

  retry(): void {
    this.fetch();
  }

  onModelChange(id: number | string | null): void {
    // p-dropdown emite el valor de `optionValue="id"` tal cual. El backend
    // puede devolver el id como string → lo normalizamos a number para honrar
    // el contrato `number | null` (el form/DTO consumidor espera Int). Clear
    // (showClear) emite null/''; lo tratamos como null.
    const num =
      id === null || id === undefined || id === '' ? null : Number(id);
    const normalized = num !== null && Number.isFinite(num) ? num : null;
    this.value.set(normalized);
    this.onChange(normalized);
    this.onTouched();
    this.selectionChange.emit(this.selectedProduct());
  }

  // ControlValueAccessor implementation
  writeValue(value: number | null): void {
    this.value.set(value);
  }

  registerOnChange(fn: (value: number | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  get isDisabled(): boolean {
    return this.disabled() || this.disabledInput();
  }
}
