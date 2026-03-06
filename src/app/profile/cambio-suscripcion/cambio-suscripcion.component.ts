import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import {
  CambiarPlanDto,
  PlanDisponible,
  SuscripcionManagementService,
  ValidacionPlazo,
} from '../../services/suscripcion-management.service';
import { getPlanCssClass, getPlanLabel } from '../../shared/models/subscription.model';

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
  @Input() planActual?: { sku: string | null; tipo: string; precio: number | null };

  @Output() cerrar = new EventEmitter<void>();
  @Output() cambioRealizado = new EventEmitter<void>();

  cargando = signal(true);
  procesando = signal(false);
  mostrarConfirmacion = signal(false);

  validacion: ValidacionPlazo | null = null;
  planes: PlanDisponible[] = [];
  planSeleccionado: PlanDisponible | null = null;
  planActualNombre: string | null = null;
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
        this.errorMensaje = e.error?.message || 'No se pudo validar el plazo de modificación.';
        this.cargando.set(false);
      },
    });
  }

  private cargarPlanes(): void {
    this.suscripcionService.obtenerPlanesDisponibles(this.oposicion).subscribe({
      next: (planes) => {
        const planActualEnLista = planes.find(p => p.sku === this.planActual?.sku);
        if (planActualEnLista) {
          this.planActualNombre = planActualEnLista.nombre;
        }
        this.planes = planes.filter(p => p.sku !== this.planActual?.sku);
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
      },
    });
  }

  seleccionarPlan(plan: PlanDisponible): void {
    this.planSeleccionado = plan;
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

    const dto: CambiarPlanDto = {
      suscripcionId: this.suscripcionId,
      nuevoSku: this.planSeleccionado.sku,
      comentario: this.comentario || undefined,
    };

    this.suscripcionService.cambiarPlan(dto).subscribe({
      next: (res) => {
        this.procesando.set(false);
        this.messageService.add({ severity: 'success', summary: 'Plan actualizado', detail: res.mensaje, life: 6000 });
        setTimeout(() => { this.cambioRealizado.emit(); this.cerrar.emit(); }, 2000);
      },
      error: (e) => {
        this.procesando.set(false);
        const detalle = e.error?.descripcion || e.error?.message || 'No se pudo cambiar el plan.';
        this.messageService.add({ severity: 'error', summary: 'Error al cambiar plan', detail: detalle, life: 6000 });
      },
    });
  }

  cancelar(): void {
    this.cerrar.emit();
  }

  getTipoBadge = getPlanLabel;
  getTipoBadgeSeverity = getPlanCssClass;

  getPeriodoLabel(plan: PlanDisponible): string {
    const periodos: Record<string, string> = { month: 'mes', year: 'año', week: 'semana', day: 'día' };
    const periodo = periodos[plan.billingPeriod] || 'mes';
    return plan.billingInterval > 1 ? `${plan.billingInterval} ${periodo}s` : periodo;
  }

  getProximaFechaPermitida(): Date | null {
    if (!this.validacion?.proximoPago) return null;
    const d = new Date(this.validacion.proximoPago);
    d.setDate(d.getDate() - 5);
    return d;
  }

  readonly Math = Math;
}
