import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  inject,
  Input,
  OnInit,
  Output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DropdownModule } from 'primeng/dropdown';
import { MessageModule } from 'primeng/message';
import { StepperModule } from 'primeng/stepper';
import { firstValueFrom } from 'rxjs';
import { CuestionarioNivelComponent } from '../../shared/cuestionario-nivel/cuestionario-nivel.component';
import {
  nivelesDisponibles,
  NivelOposicion,
} from '../../shared/models/pregunta.model';
import {
  getPlanificacionOposicionLabel,
  Oposicion,
} from '../../shared/models/subscription.model';
import type { TipoDePlanificacionDeseada } from '../../shared/models/user.model';
import { PlanificacionPreferenciasComponent } from '../../shared/planificacion-preferencias/planificacion-preferencias.component';
import { OposicionPickerOption } from '../../shared/oposicion-picker/oposicion-picker.component';
import {
  ConfiguracionPlanificacion,
  GuardarConfiguracionDTO,
  PreferenciasPrecargadas,
} from '../models/autoasignacion.model';
import {
  obtenerOpcionesCascadaPlanificacion,
} from '../planificacion-opciones.util';
import { AutoasignacionService } from '../services/autoasignacion.service';

export type ResultadoConfiguracion = 'EXITO' | 'CONFLICTO';

@Component({
  selector: 'app-planificacion-configuracion-wizard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    CheckboxModule,
    DropdownModule,
    MessageModule,
    StepperModule,
    PlanificacionPreferenciasComponent,
    CuestionarioNivelComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './planificacion-configuracion-wizard.component.html',
  styleUrls: ['./planificacion-configuracion-wizard.component.scss'],
})
export class PlanificacionConfiguracionWizardComponent implements OnInit {
  @Input() configuracion!: ConfiguracionPlanificacion | null;
  @Input() modoEdicion = false;
  /**
   * Perfil usa esta entrada cuando acaba de guardar preferencias. Su valor
   * tiene prioridad explícita sobre la variante activa; la edición normal no
   * la informa y conserva la prioridad de la configuración activa.
   */
  @Input() preferenciasPrecargadas: PreferenciasPrecargadas | null = null;
  @Input() abrirEnNivel = false;
  @Output() configurada = new EventEmitter<ResultadoConfiguracion>();
  @Output() cancelado = new EventEmitter<void>();

  private readonly autoasignacionService = inject(AutoasignacionService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly Oposicion = Oposicion;
  readonly NivelOposicion = NivelOposicion;
  readonly opcionesNivelBase = nivelesDisponibles;
  readonly getPlanificacionOposicionLabel = getPlanificacionOposicionLabel;

  /** Paso actual del stepper (0-based). */
  activeStep = signal(0);

  // Paso 1: preferencias
  preferencias = {
    oposicion: null as Oposicion | null,
    nivel: null as NivelOposicion | null,
    franja: null as string | null,
  };
  gcvConfirmado = false;

  // Paso 2: nivel
  elegirCuestionario = signal(false);
  private nivelAntesTest: NivelOposicion | null = null;

  // Paso 3: confirmación
  guardando = signal(false);
  errorGuardado: string | null = null;

  get oposicionesPermitidas(): Oposicion[] {
    const desdeVariantes = this.opcionesCascada.oposiciones;
    return desdeVariantes.length > 0
      ? desdeVariantes
      : (this.configuracion?.oposicionesPermitidas ?? []);
  }

  get opcionesOposicion(): OposicionPickerOption[] {
    const disponibilidad = this.configuracion?.disponibilidadOposiciones;
    if (!disponibilidad?.length) {
      return this.oposicionesPermitidas.map((value) => ({ value }));
    }
    return disponibilidad.map(({ oposicion, estado }) => ({
      value: oposicion,
      disabled: estado !== 'DISPONIBLE',
      disabledReason:
        estado === 'SIN_VARIANTE_ACTIVA'
          ? 'Pendiente de configurar por la academia'
          : estado === 'SIN_PLANIFICACION_PUBLICADA'
            ? 'Pendiente de planificación publicada'
            : undefined,
    }));
  }

  get opcionesCascada() {
    return obtenerOpcionesCascadaPlanificacion(
      this.configuracion?.opcionesPermitidas ?? [],
      this.preferencias as PreferenciasPrecargadas,
    );
  }

  get nivelesPermitidos(): NivelOposicion[] {
    const opciones = this.configuracion?.opcionesPermitidas ?? [];
    if (opciones.length === 0) return this.opcionesCascada.niveles;
    if (!this.preferencias.oposicion) return [];
    return [
      ...new Set(
        opciones
          .filter(
            (opcion) =>
              opcion.oposicion === this.preferencias.oposicion &&
              (!this.preferencias.franja ||
                opcion.franja === this.preferencias.franja),
          )
          .map((opcion) => opcion.nivel),
      ),
    ];
  }

  get franjasPermitidas(): TipoDePlanificacionDeseada[] {
    const opciones = this.configuracion?.opcionesPermitidas ?? [];
    if (opciones.length === 0) return this.opcionesCascada.franjas;
    if (!this.preferencias.oposicion) return [];
    return [
      ...new Set(
        opciones
          .filter(
            (opcion) => opcion.oposicion === this.preferencias.oposicion,
          )
          .map((opcion) => opcion.franja),
      ),
    ];
  }

  get opcionesNivel() {
    const permitidos = this.nivelesPermitidos;
    return permitidos.length === 0
      ? []
      : this.opcionesNivelBase.filter((opcion) =>
          permitidos.includes(opcion.value as NivelOposicion),
        );
  }

  get generalPermitida(): boolean {
    return this.oposicionesPermitidas.includes(Oposicion.GENERAL);
  }

  get requiereConfirmacionGCV(): boolean {
    return this.preferencias.oposicion === Oposicion.GENERAL;
  }

  get puedeContinuarPasoPreferencias(): boolean {
    if (!this.preferencias.oposicion || !this.preferencias.franja) {
      return false;
    }
    if (this.requiereConfirmacionGCV && !this.gcvConfirmado) {
      return false;
    }
    return true;
  }

  /** El backend no aplica valores por defecto: los tres campos son obligatorios. */
  get puedeGuardarConfiguracion(): boolean {
    const opciones = this.configuracion?.opcionesPermitidas ?? [];
    const combinacionPublicada =
      opciones.length === 0 || this.opcionesCascada.seleccionada !== null;
    return Boolean(
      this.preferencias.oposicion &&
      this.preferencias.nivel &&
      this.preferencias.franja &&
      (!this.requiereConfirmacionGCV || this.gcvConfirmado) &&
      combinacionPublicada,
    );
  }

  get tieneNivelPrecargado(): boolean {
    return !!this.preferencias.nivel;
  }

  get hayConfiguracionAnterior(): boolean {
    return !!this.configuracion?.configuracionActiva;
  }

  get configuracionAnterior() {
    return this.configuracion?.configuracionActiva?.variante;
  }

  getNivelLabel(nivel: NivelOposicion | string | null | undefined): string {
    if (nivel === NivelOposicion.AVANZADO) return 'Avanzado';
    if (nivel === NivelOposicion.INICIACION) return 'Iniciación';
    return '—';
  }

  getFranjaLabel(franja: string | null | undefined): string {
    if (franja === 'FRANJA_SEIS_A_OCHO_HORAS') return '6-8 horas';
    if (franja === 'FRANJA_CUATRO_A_SEIS_HORAS') return '4-6 horas';
    return '—';
  }

  ngOnInit(): void {
    // Al editar, la variante activa es la fuente de verdad. Las preferencias
    // de onboarding solo sirven para la primera configuración o cuando todavía
    // no existe una variante activa.
    const prefs = this.fuentePreferencias();
    if (prefs) {
      this.preferencias = {
        oposicion: prefs.oposicion ?? null,
        nivel: prefs.nivel ?? null,
        franja: prefs.franja ?? null,
      };
      this.gcvConfirmado = prefs.oposicion !== Oposicion.GENERAL;
    }
    if (this.abrirEnNivel && this.puedeContinuarPasoPreferencias) {
      this.activeStep.set(1);
    }
  }

  onPreferenciasChange(prefs: {
    oposicion: Oposicion | Oposicion[] | null;
    nivel: string | null;
    franja: string | null;
  }): void {
    this.preferencias = this.normalizarPreferencias({
      oposicion: (prefs.oposicion as Oposicion) ?? null,
      nivel: prefs.nivel as NivelOposicion | null,
      franja: prefs.franja as TipoDePlanificacionDeseada | null,
    });
    this.gcvConfirmado = this.preferencias.oposicion !== Oposicion.GENERAL;
  }

  /** Al elegir oposición, el usuario "acepta" la confirmación GCV si no es GCV. */
  onOposicionChange(op: Oposicion | null): void {
    if (op !== Oposicion.GENERAL) {
      this.gcvConfirmado = false;
    }
  }

  confirmarGCV(): void {
    this.gcvConfirmado = true;
  }

  irAPasoNivel(): void {
    this.activeStep.set(1);
  }

  irAPasoConfirmacion(): void {
    // El paso final solo puede abrirse con una selección completa; el mismo
    // guard se repite en guardarConfiguracion para impedir un POST inválido.
    if (!this.puedeGuardarConfiguracion) return;
    this.activeStep.set(2);
  }

  aplicarNivelRecomendado(nivel: NivelOposicion): void {
    this.preferencias.nivel = nivel;
    this.preferencias = this.normalizarPreferencias(
      this.preferencias as PreferenciasPrecargadas,
    );
    this.elegirCuestionario.set(false);
    this.nivelAntesTest = null;
  }

  iniciarCuestionario(): void {
    this.nivelAntesTest = this.preferencias.nivel;
    this.elegirCuestionario.set(true);
  }

  cancelarCuestionario(): void {
    this.preferencias.nivel = this.nivelAntesTest;
    this.nivelAntesTest = null;
    this.elegirCuestionario.set(false);
  }

  async guardarConfiguracion(): Promise<void> {
    if (!this.puedeGuardarConfiguracion) {
      this.errorGuardado =
        'Selecciona oposición, nivel y horas disponibles para el estudio antes de guardar.';
      return;
    }
    this.guardando.set(true);
    this.errorGuardado = null;
    try {
      const body: GuardarConfiguracionDTO = {
        oposicion: this.preferencias.oposicion as Oposicion,
        nivel: this.preferencias.nivel as NivelOposicion,
        franja: this.preferencias.franja as TipoDePlanificacionDeseada,
        version: this.configuracion?.configuracionActiva?.version ?? 0,
      };

      await firstValueFrom(
        this.autoasignacionService.guardarConfiguracion$(body),
      );
      this.configurada.emit('EXITO');
    } catch (err) {
      if (err instanceof HttpErrorResponse) {
        if (err.status === 409) {
          this.errorGuardado =
            'Tu configuración ha cambiado en otro dispositivo. Recargando…';
          this.configurada.emit('CONFLICTO');
        } else if (err.status === 422) {
          this.errorGuardado =
            'Tu combinación no tiene planificación disponible, contacta con la academia.';
        } else if (err.status === 403) {
          this.errorGuardado =
            'No tienes acceso a la planificación. Mejora tu tarifa para continuar.';
        } else {
          this.errorGuardado = 'No se pudo guardar la configuración.';
        }
      } else {
        this.errorGuardado = 'No se pudo guardar la configuración.';
      }
    } finally {
      this.guardando.set(false);
      this.cdr.markForCheck();
    }
  }

  cancelar(): void {
    this.cancelado.emit();
  }

  private fuentePreferencias(): PreferenciasPrecargadas | null {
    if (this.preferenciasPrecargadas !== null) {
      return this.preferenciasPrecargadas;
    }
    const activa = this.configuracion?.configuracionActiva?.variante;
    return this.configuracion?.estado === 'ACTIVA' && activa
      ? activa
      : (this.configuracion?.preferenciasPrecargadas ?? null);
  }

  private normalizarPreferencias(
    preferencias: PreferenciasPrecargadas,
  ): PreferenciasPrecargadas {
    const opciones = this.configuracion?.opcionesPermitidas ?? [];
    if (opciones.length === 0) return preferencias;

    const opcionesOposicion = preferencias.oposicion
      ? opciones.filter(
          (opcion) => opcion.oposicion === preferencias.oposicion,
        )
      : [];
    if (!preferencias.oposicion || opcionesOposicion.length === 0) {
      return { oposicion: null, nivel: null, franja: null };
    }

    // El asistente pide la franja antes que el nivel. Por eso se valida la
    // franja contra toda la oposición y después se acotan los niveles
    // compatibles, en vez de aplicar la cascada administrativa nivel→franja.
    const franja = opcionesOposicion.some(
      (opcion) => opcion.franja === preferencias.franja,
    )
      ? preferencias.franja
      : null;
    const nivel = opcionesOposicion.some(
      (opcion) =>
        opcion.nivel === preferencias.nivel &&
        (!franja || opcion.franja === franja),
    )
      ? preferencias.nivel
      : null;

    return { oposicion: preferencias.oposicion, nivel, franja };
  }
}
