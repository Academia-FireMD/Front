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
import { ToastrService } from 'ngx-toastr';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { RadioButtonModule } from 'primeng/radiobutton';
import { StepperModule } from 'primeng/stepper';
import { firstValueFrom } from 'rxjs';
import { NivelOposicion } from '../../shared/models/pregunta.model';
import { Oposicion } from '../../shared/models/subscription.model';
import type { TipoDePlanificacionDeseada } from '../../shared/models/user.model';
import { PlanificacionPreferenciasComponent } from '../../shared/planificacion-preferencias/planificacion-preferencias.component';
import {
  ConfiguracionPlanificacion,
  CuestionarioNivel,
  GuardarConfiguracionDTO,
  PreferenciasPrecargadas,
  RecomendacionNivel,
} from '../models/autoasignacion.model';
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
    InputTextModule,
    MessageModule,
    RadioButtonModule,
    StepperModule,
    PlanificacionPreferenciasComponent,
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
  @Output() configurada = new EventEmitter<ResultadoConfiguracion>();
  @Output() cancelado = new EventEmitter<void>();

  private readonly autoasignacionService = inject(AutoasignacionService);
  private readonly toast = inject(ToastrService);
  private readonly cdr = inject(ChangeDetectorRef);

  cuestionario: CuestionarioNivel | null = null;
  preguntas: CuestionarioNivel['preguntas'] = [];
  cargandoCuestionario = signal(true);
  readonly Oposicion = Oposicion;
  readonly NivelOposicion = NivelOposicion;

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
  respuestas: Array<number | null> = [];
  recomendacion: RecomendacionNivel | null = null;
  enviandoRecomendacion = signal(false);
  errorCuestionario: string | null = null;

  // Paso 3: confirmación
  guardando = signal(false);
  errorGuardado: string | null = null;

  get oposicionesPermitidas(): Oposicion[] {
    return this.configuracion?.oposicionesPermitidas ?? [];
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
    return Boolean(
      this.preferencias.oposicion &&
      this.preferencias.nivel &&
      this.preferencias.franja &&
      (!this.requiereConfirmacionGCV || this.gcvConfirmado),
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
    this.cargarCuestionario();
  }

  onPreferenciasChange(prefs: {
    oposicion: Oposicion | Oposicion[] | null;
    nivel: string | null;
    franja: string | null;
  }): void {
    this.preferencias.oposicion = (prefs.oposicion as Oposicion) ?? null;
    this.preferencias.nivel = (prefs.nivel as NivelOposicion) ?? null;
    this.preferencias.franja = prefs.franja;
    this.gcvConfirmado = this.preferencias.oposicion !== Oposicion.GENERAL;
    this.recomendacion = null;
  }

  onRespuestaChange(indice: number, respuesta: number | string | null): void {
    const valor = respuesta === null ? null : Number(respuesta);
    this.respuestas = this.respuestas.map((actual, posicion) =>
      posicion === indice &&
      (valor === null || (Number.isInteger(valor) && valor >= 0 && valor <= 3))
        ? valor
        : actual,
    );
    this.errorCuestionario = null;
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

  async obtenerRecomendacion(): Promise<void> {
    if (!this.cuestionario) {
      this.errorCuestionario =
        'No se pudo cargar el cuestionario. Inténtalo de nuevo.';
      return;
    }
    if (!this.cuestionarioCompleto) {
      this.errorCuestionario = `Responde las ${this.preguntas.length} preguntas antes de obtener una recomendación.`;
      this.toast.error(this.errorCuestionario);
      return;
    }
    this.errorCuestionario = null;
    this.enviandoRecomendacion.set(true);
    try {
      this.recomendacion = await firstValueFrom(
        this.autoasignacionService.recomendarNivel$(
          this.respuestas.map((respuesta) => respuesta as number),
          this.cuestionario.version,
        ),
      );
    } catch (error) {
      if (
        error instanceof HttpErrorResponse &&
        error.status === 409 &&
        error.error?.codigo === 'CUESTIONARIO_DESACTUALIZADO'
      ) {
        this.cargarCuestionario(
          'El cuestionario cambió mientras respondías. Se ha recargado.',
        );
      } else {
        this.toast.error('No se pudo obtener la recomendación');
      }
    } finally {
      this.enviandoRecomendacion.set(false);
      this.cdr.markForCheck();
    }
  }

  aceptarRecomendacion(): void {
    if (this.recomendacion) {
      this.preferencias.nivel = this.recomendacion.nivelRecomendado;
    }
  }

  async guardarConfiguracion(): Promise<void> {
    if (!this.puedeGuardarConfiguracion) {
      this.errorGuardado =
        'Selecciona oposición, nivel y franja horaria antes de guardar.';
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

  get cuestionarioCompleto(): boolean {
    return (
      this.preguntas.length > 0 &&
      this.respuestas.length === this.preguntas.length &&
      this.respuestas.every(
        (respuesta): respuesta is number =>
          typeof respuesta === 'number' &&
          Number.isInteger(respuesta) &&
          respuesta >= 0 &&
          respuesta <= 3,
      )
    );
  }

  private cargarCuestionario(mensaje?: string): void {
    this.cargandoCuestionario.set(true);
    this.errorCuestionario = null;
    this.autoasignacionService.getCuestionarioNivel$().subscribe({
      next: (cuestionario) => {
        this.cuestionario = cuestionario;
        this.preguntas = cuestionario.preguntas;
        this.respuestas = Array.from(
          { length: cuestionario.preguntas.length },
          () => null,
        );
        this.recomendacion = null;
        this.cargandoCuestionario.set(false);
        if (mensaje) this.toast.warning(mensaje);
        this.cdr.markForCheck();
      },
      error: () => {
        this.cuestionario = null;
        this.preguntas = [];
        this.respuestas = [];
        this.cargandoCuestionario.set(false);
        this.errorCuestionario = 'No se pudo cargar el cuestionario.';
        this.cdr.markForCheck();
      },
    });
  }

  private fuentePreferencias(): PreferenciasPrecargadas | null {
    if (this.preferenciasPrecargadas !== null) {
      return this.preferenciasPrecargadas;
    }
    const activa = this.configuracion?.configuracionActiva?.variante;
    return activa ?? this.configuracion?.preferenciasPrecargadas ?? null;
  }
}
