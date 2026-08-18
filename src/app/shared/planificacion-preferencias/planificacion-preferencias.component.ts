import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
} from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { DropdownModule } from 'primeng/dropdown';
import { FloatLabelModule } from 'primeng/floatlabel';
import { MultiSelectModule } from 'primeng/multiselect';
import {
  duracionesDisponibles,
  nivelesDisponibles,
} from '../models/pregunta.model';
import { Oposicion, OPOSICION_LABELS } from '../models/subscription.model';

/**
 * Preferencias de planificación (oposición, nivel y franja horaria).
 * `oposicion` es `Oposicion[]` en modo `multiple` (onboarding) o
 * `Oposicion` único en modo simple (asistente de planificación).
 */
export interface PreferenciasPlanificacion {
  oposicion: Oposicion | Oposicion[] | null;
  nivel: string | null;
  franja: string | null;
}

/** Opciones de oposición con label humano. */
function oposicionOptions(permitidas: Oposicion[]): {
  label: string;
  value: Oposicion;
}[] {
  return permitidas.map((o) => ({
    label: OPOSICION_LABELS[o] ?? o,
    value: o,
  }));
}

/**
 * Subcomponente compartido de oposición/nivel/franja, extraído del
 * onboarding (regla: reutilizar antes de crear). El onboarding lo usa en
 * modo `multiple` (oposición multi-select, payload intacto); el asistente
 * de planificación lo usa en modo simple con `oposicionesPermitidas`.
 */
@Component({
  selector: 'app-planificacion-preferencias',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    DropdownModule,
    MultiSelectModule,
    FloatLabelModule,
  ],
  template: `
    <div [formGroup]="formGroup">
      <div class="grid">
        <div class="col-12 md:col-6">
          <p-floatLabel>
            @if (multiple) {
              <p-multiSelect
                [options]="opcionesOposicion"
                formControlName="oposicion"
                defaultLabel="Selecciona oposiciones"
                class="w-full"
                [id]="formIdPrefix + 'Oposicion'"
                [style]="{ width: '100%' }"
                optionLabel="label"
                optionValue="value"
                display="chip"
              />
            } @else {
              <p-dropdown
                [options]="opcionesOposicion"
                formControlName="oposicion"
                placeholder="Selecciona oposición"
                class="w-full"
                [id]="formIdPrefix + 'Oposicion'"
                [style]="{ width: '100%' }"
                optionLabel="label"
                optionValue="value"
              />
            }
            <label [for]="formIdPrefix + 'Oposicion'">Oposición *</label>
          </p-floatLabel>
        </div>

        <div class="col-12 md:col-6">
          <p-floatLabel>
            <p-dropdown
              [options]="niveles"
              formControlName="nivel"
              placeholder="Selecciona nivel"
              class="w-full"
              [id]="formIdPrefix + 'Nivel'"
              [style]="{ width: '100%' }"
              optionLabel="label"
              optionValue="value"
            />
            <label [for]="formIdPrefix + 'Nivel'">Nivel</label>
          </p-floatLabel>
        </div>

        <div class="col-12 md:col-6">
          <p-floatLabel>
            <p-dropdown
              [options]="duraciones"
              formControlName="franja"
              placeholder="Selecciona duración"
              class="w-full"
              [id]="formIdPrefix + 'Franja'"
              [style]="{ width: '100%' }"
              optionLabel="label"
              optionValue="value"
            />
            <label [for]="formIdPrefix + 'Franja'">Franja horaria *</label>
          </p-floatLabel>
        </div>
      </div>
    </div>
  `,
})
export class PlanificacionPreferenciasComponent implements OnInit, OnChanges {
  /** Valores iniciales para precargar los controles. */
  @Input() valoresIniciales?: Partial<PreferenciasPlanificacion>;
  /** Si se define, solo se listan estas oposiciones. */
  @Input() oposicionesPermitidas?: Oposicion[];
  /** Modo multi-select (onboarding, payload Oposicion[]) vs dropdown simple. */
  @Input() multiple = false;
  /** Prefijo para los id de los inputs (evita colisiones si hay varios). */
  @Input() formIdPrefix = 'planificacion-preferencias';
  /** Emite cada cambio de los tres controles (y el valor inicial). */
  @Output() cambios = new EventEmitter<PreferenciasPlanificacion>();

  private fb = new FormBuilder();

  formGroup: FormGroup = this.fb.group({
    oposicion: [null as Oposicion | Oposicion[] | null],
    nivel: [null as string | null],
    franja: [null as string | null],
  });

  niveles = nivelesDisponibles;
  duraciones = duracionesDisponibles;

  get opcionesOposicion(): { label: string; value: Oposicion }[] {
    const permitidas = this.oposicionesPermitidas?.length
      ? this.oposicionesPermitidas
      : Object.values(Oposicion);
    return oposicionOptions(permitidas);
  }

  ngOnInit(): void {
    this.precargar();
    this.formGroup.valueChanges.subscribe(() => this.emitirCambios());
  }

  ngOnChanges(): void {
    this.precargar();
  }

  private precargar(): void {
    const siguiente = {
      oposicion: this.valoresIniciales?.oposicion ?? null,
      nivel: this.valoresIniciales?.nivel ?? null,
      franja: this.valoresIniciales?.franja ?? null,
    };
    // Sin este guard, un @Input con identidad inestable (objeto inline o getter
    // en el padre) dispara ngOnChanges → patchValue → CD → ngOnChanges… y
    // bloquea el main thread (bug detectado en /app/profile, e2e 2026-08-18).
    if (this.valoresIguales(this.formGroup.value, siguiente)) return;
    this.formGroup.patchValue(siguiente, { emitEvent: false });
  }

  private valoresIguales(
    a: PreferenciasPlanificacion,
    b: PreferenciasPlanificacion,
  ): boolean {
    const normalizar = (v: unknown): unknown[] =>
      v == null ? [] : Array.isArray(v) ? v : [v];
    const ao = normalizar(a.oposicion);
    const bo = normalizar(b.oposicion);
    const mismaOposicion =
      ao.length === bo.length && ao.every((v, i) => v === bo[i]);
    return (
      mismaOposicion &&
      (a.nivel ?? null) === (b.nivel ?? null) &&
      (a.franja ?? null) === (b.franja ?? null)
    );
  }

  private emitirCambios(): void {
    this.cambios.emit(this.formGroup.value as PreferenciasPlanificacion);
  }
}
