import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { environment } from '../../../environments/environment';
import {
  AnadirPlanResponse,
  PlanDisponible,
  SuscripcionManagementService,
} from '../../services/suscripcion-management.service';
import {
  getPlanCssClass,
  getPlanLabel,
  Oposicion,
  OPOSICION_LABELS,
} from '../../shared/models/subscription.model';

/** Opción del dropdown de oposición (valor + etiqueta legible). */
interface OposicionOption {
  value: Oposicion;
  label: string;
}

/**
 * Contenido del diálogo "Añadir más planes": permite al alumno darse de alta en una
 * oposición que aún NO tiene, eligiendo oposición (no contratada) + tier mensual, y
 * activando el plan en 1 clic con su tarjeta guardada (COF Redsys). El `p-dialog` que
 * lo hospeda lo pone el componente padre (ProfileComponent).
 *
 * Solo planes MENSUALES: `obtenerPlanesDisponibles` excluye los genéricos/anuales.
 */
@Component({
  selector: 'app-anadir-plan',
  standalone: true,
  providers: [MessageService],
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    DropdownModule,
    ProgressSpinnerModule,
  ],
  templateUrl: './anadir-plan.component.html',
  styleUrls: ['./anadir-plan.component.scss'],
})
export class AnadirPlanComponent {
  /** Oposiciones que el alumno ya tiene activas: se excluyen del selector. */
  @Input() oposicionesContratadas: Oposicion[] = [];

  @Output() cerrar = new EventEmitter<void>();
  @Output() planAnadido = new EventEmitter<void>();

  oposicionSeleccionada: Oposicion | null = null;
  tierSeleccionado: PlanDisponible | null = null;

  planes: PlanDisponible[] = [];

  cargandoPlanes = signal(false);
  procesando = signal(false);
  /** true cuando el backend responde requiereCheckout (alumno sin COF usable). */
  requiereCheckout = signal(false);

  getTipoBadge = getPlanLabel;
  getTipoBadgeSeverity = getPlanCssClass;

  constructor(
    private suscripcionService: SuscripcionManagementService,
    private messageService: MessageService,
  ) {}

  /** Oposiciones del enum MENOS las que el alumno ya tiene activas. */
  get oposicionesDisponibles(): OposicionOption[] {
    return (Object.values(Oposicion) as Oposicion[])
      .filter((op) => !this.oposicionesContratadas.includes(op))
      .map((op) => ({ value: op, label: OPOSICION_LABELS[op] }));
  }

  /** Planes encontrados pero sin ninguno utilizable (lista vacía tras cargar). */
  get sinPlanes(): boolean {
    return (
      !!this.oposicionSeleccionada &&
      !this.cargandoPlanes() &&
      this.planes.length === 0
    );
  }

  onOposicionChange(): void {
    this.tierSeleccionado = null;
    this.planes = [];
    this.requiereCheckout.set(false);
    if (!this.oposicionSeleccionada) return;

    this.cargandoPlanes.set(true);
    this.suscripcionService
      .obtenerPlanesDisponibles(this.oposicionSeleccionada)
      .subscribe({
        next: (planes) => {
          this.planes = planes;
          this.cargandoPlanes.set(false);
        },
        error: () => {
          this.planes = [];
          this.cargandoPlanes.set(false);
          this.messageService.add({
            severity: 'error',
            summary: 'No se pudieron cargar los planes',
            detail: 'Inténtalo de nuevo en unos segundos.',
            life: 6000,
          });
        },
      });
  }

  onTierChange(): void {
    // Si cambian de tier después de un fallback a tienda, reseteamos el panel.
    this.requiereCheckout.set(false);
  }

  /** Etiqueta del periodo del plan (siempre mensual aquí, pero derivada por robustez). */
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

  /** Texto del botón principal con el precio del tier elegido. */
  labelBotonActivar(): string {
    const precio = this.tierSeleccionado?.precio;
    if (precio == null) return 'Activar plan';
    return `Activar plan (${precio.toFixed(2).replace('.', ',')} €)`;
  }

  puedeActivar(): boolean {
    return !!this.tierSeleccionado?.sku && !this.procesando();
  }

  activarPlan(): void {
    const plan = this.tierSeleccionado;
    if (!plan?.sku) return;

    this.procesando.set(true);
    this.requiereCheckout.set(false);

    this.suscripcionService.anadirPlan(plan.sku).subscribe({
      next: (res: AnadirPlanResponse) => {
        this.procesando.set(false);
        if (res.requiereCheckout) {
          // Alumno sin COF usable → panel explicativo + botón a la tienda.
          this.requiereCheckout.set(true);
          return;
        }
        if (res.success) {
          this.messageService.add({
            severity: 'success',
            summary: 'Plan activado',
            detail: res.mensaje || 'Tu nuevo plan ya está activo.',
            life: 6000,
          });
          this.planAnadido.emit();
          this.cerrar.emit();
          return;
        }
        // success === false sin requiereCheckout: tratar como error de negocio.
        this.messageService.add({
          severity: 'error',
          summary: 'No se pudo activar el plan',
          detail: res.mensaje || 'Inténtalo de nuevo en unos segundos.',
          life: 6000,
        });
      },
      error: (e) => {
        this.procesando.set(false);
        const detalle =
          e.error?.descripcion ||
          e.error?.message ||
          'No se pudo activar el plan.';
        this.messageService.add({
          severity: 'error',
          summary: 'Error al activar el plan',
          detail: detalle,
          life: 6000,
        });
      },
    });
  }

  /** Abre el checkout de WC pre-cargado con el plan elegido (fallback sin COF). */
  completarEnTienda(): void {
    const plan = this.tierSeleccionado;
    if (!plan) return;
    window.open(
      `${environment.wooCommerceUrl}?add-to-cart=${plan.id}`,
      '_blank',
    );
  }

  cancelar(): void {
    this.cerrar.emit();
  }
}
