import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import {
  DetalleSuscripcion,
  PlanDisponible,
  PreviewCambioResponse,
  SuscripcionManagementService,
  SwitchOperationProgramada,
  ValidacionPlazo,
} from '../../services/suscripcion-management.service';
import { environment } from '../../../environments/environment';
import {
  getPlanCssClass,
  getPlanLabel,
} from '../../shared/models/subscription.model';

@Component({
  selector: 'app-cambio-suscripcion',
  standalone: true,
  providers: [MessageService],
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    DialogModule,
    InputTextareaModule,
    ProgressSpinnerModule,
  ],
  templateUrl: './cambio-suscripcion.component.html',
  styleUrls: ['./cambio-suscripcion.component.scss'],
})
export class CambioSuscripcionComponent implements OnInit {
  @Input() suscripcionId!: number;
  @Input() oposicion?: string;
  @Input() planActual?: {
    sku: string | null;
    tipo: string;
    precio: number | null;
  };

  @Output() cerrar = new EventEmitter<void>();
  @Output() cambioRealizado = new EventEmitter<void>();

  wpBaseUrl = environment.wordpressUrl;

  cargando = signal(true);
  procesando = signal(false);
  mostrarConfirmacion = signal(false);
  mostrarConfirmacionCancelar = signal(false);
  cancelando = signal(false);

  /** Cambio programado pendiente (downgrade diferido). null si no hay ninguno. */
  cambioProgramado = signal<SwitchOperationProgramada | null>(null);

  preview = signal<PreviewCambioResponse | null>(null);
  cargandoPreview = signal(false);

  validacion: ValidacionPlazo | null = null;
  planes: PlanDisponible[] = [];
  planSeleccionado: PlanDisponible | null = null;
  planActualNombre: string | null = null;
  /** Plan actual completo (de planes-disponibles) — para el periodo de facturación real. */
  planActualPlan: PlanDisponible | null = null;
  comentario = '';
  errorMensaje = '';

  constructor(
    private suscripcionService: SuscripcionManagementService,
    private messageService: MessageService,
  ) {}

  ngOnInit(): void {
    this.cargarDatos();
  }

  private cargarDatos(): void {
    this.cargando.set(true);
    this.cargarCambioProgramado();
    this.suscripcionService.validarPlazo(this.suscripcionId).subscribe({
      next: (v) => {
        this.validacion = v;
        if (v.valido) {
          this.cargarPlanes();
        } else {
          this.cargando.set(false);
        }
      },
      error: (e) => {
        this.errorMensaje =
          e.error?.message || 'No se pudo validar el plazo de modificación.';
        this.cargando.set(false);
      },
    });
  }

  /** Carga el detalle para detectar si hay un cambio programado (downgrade diferido). */
  private cargarCambioProgramado(): void {
    this.suscripcionService
      .obtenerDetalleSuscripcion(this.suscripcionId)
      .subscribe({
        next: (detalle: DetalleSuscripcion) => {
          this.cambioProgramado.set(detalle.switchOperationProgramada);
        },
        // Silencioso: el banner es informativo, no debe bloquear el flujo de cambio.
        error: () => this.cambioProgramado.set(null),
      });
  }

  private cargarPlanes(): void {
    this.suscripcionService.obtenerPlanesDisponibles(this.oposicion).subscribe({
      next: (planes) => {
        const planActualEnLista = planes.find(
          (p) => p.sku === this.planActual?.sku,
        );
        if (planActualEnLista) {
          this.planActualNombre = planActualEnLista.nombre;
          this.planActualPlan = planActualEnLista;
        }
        this.planes = planes.filter((p) => p.sku !== this.planActual?.sku);
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
      },
    });
  }

  seleccionarPlan(plan: PlanDisponible): void {
    this.planSeleccionado = plan;
    this.preview.set(null);
    if (!plan.sku) return;
    this.cargandoPreview.set(true);
    this.suscripcionService
      .previewCambioSuscripcion(this.suscripcionId, plan.sku)
      .subscribe({
        next: (p) => {
          this.preview.set(p);
          this.cargandoPreview.set(false);
        },
        error: () => {
          this.cargandoPreview.set(false);
          this.messageService.add({
            severity: 'error',
            summary: 'No se pudo calcular el cambio',
            detail: 'Inténtalo de nuevo en unos segundos.',
            life: 6000,
          });
        },
      });
  }

  esPlanSeleccionado(plan: PlanDisponible): boolean {
    return this.planSeleccionado?.sku === plan.sku;
  }

  get diferenciaPrecio(): number | null {
    if (!this.planSeleccionado?.precio || !this.planActual?.precio) return null;
    return this.planSeleccionado.precio - this.planActual.precio;
  }

  abrirConfirmacion(): void {
    if (!this.planSeleccionado) return;
    this.mostrarConfirmacion.set(true);
  }

  confirmarCambio(): void {
    if (!this.planSeleccionado?.sku) return;
    this.procesando.set(true);
    this.mostrarConfirmacion.set(false);

    this.suscripcionService
      .cambiarSuscripcion(
        this.suscripcionId,
        this.planSeleccionado.sku,
        this.comentario || undefined,
      )
      .subscribe({
        next: (res) => {
          this.procesando.set(false);
          const summary =
            res.modo === 'INMEDIATO'
              ? 'Tu plan ya está activo'
              : 'Cambio programado';
          const detail =
            res.modo === 'PROGRAMADO' && res.fechaAplicacion
              ? `Se aplicará el ${new Date(res.fechaAplicacion).toLocaleDateString('es-ES')}. ${res.mensaje}`
              : res.mensaje;
          this.messageService.add({
            severity: 'success',
            summary,
            detail,
            life: 6000,
          });
          setTimeout(() => {
            this.cambioRealizado.emit();
            this.cerrar.emit();
          }, 2000);
        },
        error: (e) => {
          this.procesando.set(false);
          const detalle =
            e.error?.descripcion ||
            e.error?.message ||
            'No se pudo cambiar el plan.';
          this.messageService.add({
            severity: 'error',
            summary: 'Error al cambiar plan',
            detail: detalle,
            life: 6000,
          });
        },
      });
  }

  // ── Cancelar cambio programado ──────────────────
  abrirConfirmacionCancelar(): void {
    if (!this.cambioProgramado()) return;
    this.mostrarConfirmacionCancelar.set(true);
  }

  confirmarCancelarCambioProgramado(): void {
    const op = this.cambioProgramado();
    if (!op) return;
    this.cancelando.set(true);

    this.suscripcionService.cancelarCambioProgramado(op.id).subscribe({
      next: (res) => {
        this.cancelando.set(false);
        this.mostrarConfirmacionCancelar.set(false);
        this.cambioProgramado.set(null);
        this.messageService.add({
          severity: 'success',
          summary: 'Cambio cancelado',
          detail: res.mensaje,
          life: 6000,
        });
        // Refrescar el detalle para reflejar el estado real (el banner ya desapareció).
        this.cargarCambioProgramado();
      },
      error: (e) => {
        this.cancelando.set(false);
        const detalle =
          e.error?.descripcion ||
          e.error?.message ||
          'No se pudo cancelar el cambio programado.';
        this.messageService.add({
          severity: 'error',
          summary: 'Error al cancelar',
          detail: detalle,
          life: 6000,
        });
      },
    });
  }

  cancelar(): void {
    this.cerrar.emit();
  }

  getTipoBadge = getPlanLabel;
  getTipoBadgeSeverity = getPlanCssClass;

  getPeriodoLabel(plan: PlanDisponible): string {
    const periodos: Record<string, string> = {
      month: 'mes',
      year: 'año',
      week: 'semana',
      day: 'día',
    };
    const periodo = periodos[plan.billingPeriod] || 'mes';
    return plan.billingInterval > 1
      ? `${plan.billingInterval} ${periodo}s`
      : periodo;
  }

  getProximaFechaPermitida(): Date | null {
    if (!this.validacion?.proximoPago) return null;
    const d = new Date(this.validacion.proximoPago);
    d.setDate(d.getDate() - 5);
    return d;
  }

  puedeConfirmar(): boolean {
    const p = this.preview();
    if (!p) return false;
    if (p.switchType === 'UPGRADE') {
      // No dejar confirmar un upgrade cuyo coste no se pudo calcular (precio
      // destino o fechas de ciclo no disponibles): requiereCobro:false NO es "gratis".
      if (!p.costeCalculable) return false;
      if (p.requiereCobro && !p.metodoPago.usable) return false;
    }
    return true;
  }

  labelBotonConfirmar(): string {
    const p = this.preview();
    if (!p) return 'Confirmar';
    if (p.credito && p.credito > 0) return 'Cambiar (sin coste ahora)';
    if (p.switchType === 'UPGRADE' && p.requiereCobro && p.prorrateo) {
      return `Pagar ${p.prorrateo.importe
        .toFixed(2)
        .replace('.', ',')} € y cambiar`;
    }
    if (p.modo === 'PROGRAMADO') return 'Programar cambio';
    return 'Cambiar';
  }

  readonly Math = Math;
}
