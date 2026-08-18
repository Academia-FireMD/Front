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
  GuardarConfiguracionDTO,
  RecomendacionNivel,
} from '../models/autoasignacion.model';
import { AutoasignacionService } from '../services/autoasignacion.service';
/** Textos del cuestionario de recomendación. TODO(textos): validar con Sergio. */
const PREGUNTAS_CUESTIONARIO: string[] = [
  '¿Cuánto tiempo llevas estudiando el temario?',
  '¿Cómo valoras tu dominio actual del temario?',
  '¿Has aprobado algún examen o parcial recientemente?',
  '¿Cuántas horas a la semana dedicas al estudio?',
  '¿Cómo te sientes con los simulacros y tests?',
];

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
  @Output() configurada = new EventEmitter<void>();
  @Output() cancelado = new EventEmitter<void>();

  private readonly autoasignacionService = inject(AutoasignacionService);
  private readonly toast = inject(ToastrService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly preguntas = PREGUNTAS_CUESTIONARIO;
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
  respuestas: number[] = [0, 0, 0, 0, 0];
  recomendacion: RecomendacionNivel | null = null;
  enviandoRecomendacion = signal(false);

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

  get tieneNivelPrecargado(): boolean {
    return !!this.configuracion?.preferenciasPrecargadas?.nivel;
  }

  get hayConfiguracionAnterior(): boolean {
    return !!this.configuracion?.configuracionActiva;
  }

  get configuracionAnterior() {
    return this.configuracion?.configuracionActiva?.variante;
  }

  ngOnInit(): void {
    const prefs = this.configuracion?.preferenciasPrecargadas;
    if (prefs) {
      this.preferencias = {
        oposicion: prefs.oposicion,
        nivel: prefs.nivel,
        franja: prefs.franja,
      };
      this.gcvConfirmado = prefs.oposicion !== Oposicion.GENERAL;
    }
  }

  onPreferenciasChange(prefs: {
    oposicion: Oposicion | Oposicion[] | null;
    nivel: string | null;
    franja: string | null;
  }): void {
    this.preferencias.oposicion = (prefs.oposicion as Oposicion) ?? null;
    this.preferencias.nivel = (prefs.nivel as NivelOposicion) ?? null;
    this.preferencias.franja = prefs.franja;
    this.recomendacion = null;
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
    // Si no hay nivel (ni elegido ni recomendado) y no se decide el
    // cuestionario, dejamos continuar con nivel nulo (el backend decide).
    this.activeStep.set(2);
  }

  async obtenerRecomendacion(): Promise<void> {
    if (this.respuestas.some((r) => r < 0 || r > 3)) {
      this.toast.error('Revisa las respuestas del cuestionario (0-3)');
      return;
    }
    this.enviandoRecomendacion.set(true);
    try {
      this.recomendacion = await firstValueFrom(
        this.autoasignacionService.recomendarNivel$(this.respuestas),
      );
      this.preferencias.nivel = this.recomendacion.nivelRecomendado;
    } catch {
      this.toast.error('No se pudo obtener la recomendación');
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
    this.guardando.set(true);
    this.errorGuardado = null;
    try {
      const body: GuardarConfiguracionDTO = {
        oposicion: this.preferencias.oposicion as Oposicion,
        nivel:
          (this.preferencias.nivel as NivelOposicion) ??
          NivelOposicion.INICIACION,
        franja: this.preferencias.franja as TipoDePlanificacionDeseada,
        version: this.configuracion?.configuracionActiva?.version ?? 0,
      };

      await firstValueFrom(
        this.autoasignacionService.guardarConfiguracion$(body),
      );
      this.configurada.emit();
    } catch (err) {
      if (err instanceof HttpErrorResponse) {
        if (err.status === 409) {
          this.errorGuardado =
            'Tu configuración ha cambiado en otro dispositivo. Recargando…';
          this.configurada.emit();
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
}
