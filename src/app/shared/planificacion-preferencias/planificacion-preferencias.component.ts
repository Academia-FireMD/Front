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
import { ButtonModule } from 'primeng/button';
import {
  duracionesDisponibles,
  nivelesDisponibles,
  NivelOposicion,
} from '../models/pregunta.model';
import { Oposicion } from '../models/subscription.model';
import type { TipoDePlanificacionDeseada } from '../models/user.model';
import {
  OposicionPickerComponent,
  OposicionPickerContext,
  OposicionPickerOption,
} from '../oposicion-picker/oposicion-picker.component';

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
    ButtonModule,
    OposicionPickerComponent,
  ],
  template: `
    <div [formGroup]="formGroup">
      <div class="grid">
        @if (mostrarOposicion) {
          <div class="col-12 md:col-6 planificacion-field">
            <label
              class="block font-medium mb-2"
              [for]="formIdPrefix + 'Oposicion'"
              >{{ etiquetaOposicion }} *</label
            >
            <app-oposicion-picker
              class="block w-full"
              presentation="field"
              [multiple]="multiple"
              [context]="oposicionContext"
              [opciones]="opcionesSelector"
              [inputId]="formIdPrefix + 'Oposicion'"
              [ariaDescribedBy]="
                ayudaOposicion ? formIdPrefix + 'OposicionAyuda' : undefined
              "
              [ariaLabel]="etiquetaOposicionAccesible"
              [placeholder]="
                multiple ? 'Selecciona oposiciones' : 'Selecciona oposición'
              "
              formControlName="oposicion"
            />
            @if (ayudaOposicion) {
              <small
                class="block text-500 mt-2 line-height-3"
                [id]="formIdPrefix + 'OposicionAyuda'"
              >
                {{ ayudaOposicion }}
              </small>
            }
            @if (tieneOpcionesNoDisponibles) {
              <small class="block text-500 mt-2">
                Las opciones no disponibles se muestran con el motivo
                correspondiente.
              </small>
            }
          </div>
        }

        @if (mostrarNivel) {
          <div class="col-12 md:col-6 planificacion-field">
            <label
              class="block font-medium mb-2"
              [for]="formIdPrefix + 'Nivel'"
            >
              Nivel *
            </label>
            <p-dropdown
              [options]="opcionesNivel"
              formControlName="nivel"
              placeholder="Selecciona nivel"
              class="w-full"
              styleClass="planificacion-dropdown"
              [inputId]="formIdPrefix + 'Nivel'"
              [style]="{ width: '100%' }"
              optionLabel="label"
              optionValue="value"
            />
            @if (formGroup.controls['nivel'].disabled) {
              <small class="block text-500 mt-2" role="status"
                >Elige primero un plan de estudio.</small
              >
            }
            @if (permitirTestNivel) {
              <p-button
                type="button"
                styleClass="planificacion-test-button mt-2"
                [outlined]="true"
                icon="pi pi-check-square"
                label="Hacer test de nivel"
                (onClick)="testNivelSolicitado.emit()"
              />
            }
          </div>
        }

        <div class="col-12 md:col-6 planificacion-field">
          <label class="block font-medium mb-2" [for]="formIdPrefix + 'Franja'">
            Horas disponibles para el estudio *
          </label>
          <p-dropdown
            [options]="opcionesFranja"
            formControlName="franja"
            placeholder="Selecciona tus horas de estudio"
            class="w-full"
            styleClass="planificacion-dropdown"
            [inputId]="formIdPrefix + 'Franja'"
            [style]="{ width: '100%' }"
            optionLabel="label"
            optionValue="value"
            [attr.aria-describedby]="formIdPrefix + 'FranjaAyuda'"
          />
          @if (formGroup.controls['franja'].disabled) {
            <small class="block text-500 mt-2" role="status"
              >Completa primero las opciones anteriores.</small
            >
          }
          <small
            class="block text-500 mt-2"
            [id]="formIdPrefix + 'FranjaAyuda'"
          >
            Únicamente horas de estudio, no incluye el tiempo dedicado a la
            preparación física.
          </small>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      :host ::ng-deep .planificacion-test-button {
        min-height: 44px;
      }

      .planificacion-field {
        min-width: 0;
      }

      :host ::ng-deep .planificacion-dropdown.p-dropdown {
        min-height: 44px;
      }

      @media (max-width: 575px) {
        :host ::ng-deep .planificacion-test-button {
          justify-content: center;
          width: 100%;
        }
      }
    `,
  ],
})
export class PlanificacionPreferenciasComponent implements OnInit, OnChanges {
  /** Valores iniciales para precargar los controles. */
  @Input() valoresIniciales?: Partial<PreferenciasPlanificacion>;
  /** Si se define, solo se listan estas oposiciones. */
  @Input() oposicionesPermitidas?: Oposicion[];
  /** Opciones contextualizadas, incluidas las no disponibles con su motivo. */
  @Input() opcionesOposicion?: OposicionPickerOption[];
  /** Opciones de nivel que devuelve el backend para el actor/alcance actual. */
  @Input() nivelesPermitidos?: NivelOposicion[];
  /** Opciones de franja que devuelve el backend para el actor/alcance actual. */
  @Input() franjasPermitidas?: TipoDePlanificacionDeseada[];
  /** Modo multi-select (onboarding, payload Oposicion[]) vs dropdown simple. */
  @Input() multiple = false;
  /** Semántica explícita del selector; no se deduce de `multiple`. */
  @Input({ required: true }) oposicionContext: OposicionPickerContext =
    'planificacion';
  /** Explica en el asistente por qué el catálogo depende de la suscripción. */
  @Input() mostrarAyudaSuscripciones = false;
  /** Oculta el selector para reutilizar oposición y horas en el primer paso. */
  @Input() mostrarNivel = true;
  /** El plan común ya queda elegido en la tarjeta; no duplica su selector. */
  @Input() mostrarOposicion = true;
  /** Muestra el acceso al test únicamente en superficies de alumno. */
  @Input() permitirTestNivel = false;
  /** Prefijo para los id de los inputs (evita colisiones si hay varios). */
  @Input() formIdPrefix = 'planificacion-preferencias';
  /** Emite cada cambio de los tres controles (y el valor inicial). */
  @Output() cambios = new EventEmitter<PreferenciasPlanificacion>();
  @Output() testNivelSolicitado = new EventEmitter<void>();

  private fb = new FormBuilder();

  formGroup: FormGroup = this.fb.group({
    oposicion: [null as Oposicion | Oposicion[] | null],
    nivel: [null as string | null],
    franja: [null as string | null],
  });

  niveles = nivelesDisponibles;
  duraciones = duracionesDisponibles;
  get etiquetaOposicion(): string {
    if (this.oposicionContext === 'catalogo' && this.multiple) {
      return 'Oposiciones de interés';
    }
    return this.oposicionContext === 'planificacion' &&
      this.opcionesSelector.some((opcion) => opcion.value === Oposicion.GENERAL)
      ? 'Plan de estudio'
      : 'Oposición';
  }

  get ayudaOposicion(): string | null {
    if (this.oposicionContext === 'catalogo' && this.multiple) {
      return 'Esta preferencia no modifica tus suscripciones ni concede acceso a una planificación.';
    }
    if (
      this.oposicionContext === 'planificacion' &&
      this.opcionesSelector.some((opcion) => opcion.value === Oposicion.GENERAL)
    ) {
      return 'El plan común de Comunidad Valenciana sirve para Valencia y Alicante; no añade otra suscripción ni otro calendario.';
    }
    return this.mostrarAyudaSuscripciones
      ? 'Solo aparecen planes de estudio permitidos por tus suscripciones activas.'
      : null;
  }

  get etiquetaOposicionAccesible(): string {
    return this.ayudaOposicion
      ? `${this.etiquetaOposicion}. ${this.ayudaOposicion}`
      : this.etiquetaOposicion;
  }
  private opcionesNivelCache: { label: string; value: NivelOposicion }[] = [];
  private opcionesNivelKey: string | null = null;
  private opcionesFranjaCache: {
    label: string;
    value: TipoDePlanificacionDeseada;
  }[] = [];
  private opcionesFranjaKey: string | null = null;
  private opcionesSelectorCache: OposicionPickerOption[] = [];
  private opcionesSelectorKey: string | null = null;

  get opcionesNivel(): { label: string; value: NivelOposicion }[] {
    const siguientes = this.crearOpcionesNivel();
    const key = JSON.stringify(siguientes);
    if (key !== this.opcionesNivelKey) {
      this.opcionesNivelCache = siguientes;
      this.opcionesNivelKey = key;
    }
    return this.opcionesNivelCache;
  }

  get opcionesFranja(): {
    label: string;
    value: TipoDePlanificacionDeseada;
  }[] {
    const siguientes = this.crearOpcionesFranja();
    const key = JSON.stringify(siguientes);
    if (key !== this.opcionesFranjaKey) {
      this.opcionesFranjaCache = siguientes;
      this.opcionesFranjaKey = key;
    }
    return this.opcionesFranjaCache;
  }

  get opcionesSelector(): OposicionPickerOption[] {
    const siguientes = this.crearOpcionesSelector();
    const key = JSON.stringify(siguientes);
    if (key !== this.opcionesSelectorKey) {
      this.opcionesSelectorCache = siguientes;
      this.opcionesSelectorKey = key;
    }
    return this.opcionesSelectorCache;
  }

  private crearOpcionesNivel(): { label: string; value: NivelOposicion }[] {
    const permitidos =
      this.nivelesPermitidos ??
      nivelesDisponibles.map((opcion) => opcion.value as NivelOposicion);
    return permitidos.map((value) => ({
      label:
        nivelesDisponibles.find((opcion) => opcion.value === value)?.label ??
        value,
      value,
    }));
  }

  private crearOpcionesFranja(): {
    label: string;
    value: TipoDePlanificacionDeseada;
  }[] {
    const permitidas =
      this.franjasPermitidas ??
      duracionesDisponibles.map(
        (opcion) => opcion.value as TipoDePlanificacionDeseada,
      );
    return permitidas.map((value) => ({
      label:
        duracionesDisponibles.find((opcion) => opcion.value === value)?.label ??
        value,
      value,
    }));
  }

  private crearOpcionesSelector(): OposicionPickerOption[] {
    if (this.opcionesOposicion) return this.opcionesOposicion;
    return (this.oposicionesPermitidas ?? Object.values(Oposicion)).map(
      (value) => ({ value }),
    );
  }

  get tieneOpcionesNoDisponibles(): boolean {
    return this.opcionesSelector.some((opcion) => opcion.disabled);
  }

  ngOnInit(): void {
    this.precargar();
    this.actualizarCamposDependientes();
    this.formGroup.valueChanges.subscribe(() => {
      this.actualizarCamposDependientes();
      this.emitirCambios();
    });
  }

  ngOnChanges(): void {
    this.precargar();
    this.actualizarCamposDependientes();
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
    if (this.valoresIguales(this.formGroup.getRawValue(), siguiente)) return;
    this.formGroup.patchValue(siguiente, { emitEvent: false });
    this.actualizarCamposDependientes();
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
    this.cambios.emit(
      this.formGroup.getRawValue() as PreferenciasPlanificacion,
    );
  }

  private actualizarCamposDependientes(): void {
    const { oposicion, nivel } = this.formGroup.getRawValue();
    const hayOposicion = Array.isArray(oposicion)
      ? oposicion.length > 0
      : !!oposicion;
    const nivelHabilitado = hayOposicion && this.opcionesNivel.length > 0;
    const franjaHabilitada =
      hayOposicion &&
      (!this.mostrarNivel || !!nivel) &&
      this.opcionesFranja.length > 0;
    for (const [control, habilitado] of [
      [this.formGroup.controls['nivel'], nivelHabilitado],
      [this.formGroup.controls['franja'], franjaHabilitada],
    ] as const) {
      if (habilitado && control.disabled) control.enable({ emitEvent: false });
      if (!habilitado && control.enabled) control.disable({ emitEvent: false });
    }
  }
}
