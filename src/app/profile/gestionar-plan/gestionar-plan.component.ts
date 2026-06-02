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
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { environment } from '../../../environments/environment';
import {
  AnadirPlanResponse,
  PlanDisponible,
  PreviewCambioResponse,
  SuscripcionManagementService,
} from '../../services/suscripcion-management.service';
import {
  getPlanCssClass,
  getPlanLabel,
  Oposicion,
  OPOSICION_LABELS,
  Suscripcion,
} from '../../shared/models/subscription.model';

/** Modo de operación del diálogo unificado. */
export type GestionarPlanModo = 'cambiar' | 'anadir';

/** Chip de oposición seleccionable (valor + etiqueta legible). */
interface ChipOposicion {
  value: Oposicion;
  label: string;
}

/** Planes agrupados por periodo de facturación para el render (Mensual / Anual). */
interface GrupoPeriodo {
  /** Clave estable de billingPeriod ('month' | 'year' | ...). */
  periodo: PlanDisponible['billingPeriod'];
  /** Etiqueta de cabecera del grupo ("Mensual" / "Anual"). */
  titulo: string;
  planes: PlanDisponible[];
}

/**
 * Diálogo UNIFICADO de gestión de plan. Sirve para:
 *  - `cambiar`: cambiar el plan de una suscripción existente (preview prorrateo,
 *    crédito/cobertura, gating money-critical). Lógica COPIADA 1:1 de
 *    `CambioSuscripcionComponent` — flujo de dinero recién validado, NO reinventar.
 *  - `anadir`: dar de alta al alumno en una oposición que aún NO tiene (COF Redsys
 *    en 1 clic, con fallback a la tienda). Lógica de `AnadirPlanComponent`.
 *
 * UX común: chips de oposición (excluye GENERAL) + planes agrupados por periodo
 * (Mensual / Anual) como tarjetas seleccionables. El `p-dialog` que lo hospeda lo
 * pone el componente padre (ProfileComponent).
 */
@Component({
  selector: 'app-gestionar-plan',
  standalone: true,
  providers: [MessageService],
  imports: [CommonModule, FormsModule, ButtonModule, ProgressSpinnerModule],
  templateUrl: './gestionar-plan.component.html',
  styleUrls: ['./gestionar-plan.component.scss'],
})
export class GestionarPlanComponent implements OnInit {
  @Input() modo: GestionarPlanModo = 'cambiar';
  /** Suscripción a cambiar (REQUERIDO en modo `cambiar`): id, oposicion, sku, tipo, monthlyPrice. */
  @Input() suscripcion: Suscripcion | null = null;
  /** Oposiciones ya contratadas (ACTIVE/PENDING_CANCEL): se excluyen de los chips en modo `anadir`. */
  @Input() oposicionesContratadas: Oposicion[] = [];

  @Output() cerrar = new EventEmitter<void>();
  @Output() realizado = new EventEmitter<void>();

  wpBaseUrl = environment.wordpressUrl;

  // ── Estado de chips de oposición ────────────────────────────────
  /** Oposición actualmente seleccionada (chip activo). null hasta que el alumno elige. */
  oposicionSeleccionada: Oposicion | null = null;

  // ── Estado de planes ────────────────────────────────────────────
  /** Planes de la oposición elegida agrupados por periodo (Mensual / Anual). */
  gruposPeriodo: GrupoPeriodo[] = [];
  planSeleccionado: PlanDisponible | null = null;
  cargandoPlanes = signal(false);
  procesando = signal(false);

  // ── Modo `anadir` ───────────────────────────────────────────────
  /** true cuando el backend responde requiereCheckout (alumno sin COF usable). */
  requiereCheckout = signal(false);

  // ── Modo `cambiar` (preview prorrateo) ──────────────────────────
  preview = signal<PreviewCambioResponse | null>(null);
  cargandoPreview = signal(false);

  getTipoBadge = getPlanLabel;
  getTipoBadgeSeverity = getPlanCssClass;

  constructor(
    private suscripcionService: SuscripcionManagementService,
    private messageService: MessageService,
  ) {}

  ngOnInit(): void {
    // En modo cambiar preseleccionamos la oposición de la suscripción y cargamos sus planes.
    if (this.modo === 'cambiar' && this.suscripcion) {
      this.seleccionarOposicion(this.suscripcion.oposicion);
    }
  }

  // ── Chips de oposición ──────────────────────────────────────────

  /**
   * Chips a mostrar según el modo:
   *  - SIEMPRE se excluye `Oposicion.GENERAL` (comodín, no es destino).
   *  - `anadir`: oposiciones del enum MENOS las ya contratadas.
   *  - `cambiar`: la oposición de la sub (preseleccionada) + las demás no contratadas
   *    (crossgrade permitido). La actual NUNCA se excluye.
   */
  get chipsOposicion(): ChipOposicion[] {
    const todas = (Object.values(Oposicion) as Oposicion[]).filter(
      (op) => op !== Oposicion.GENERAL,
    );

    let disponibles: Oposicion[];
    if (this.modo === 'anadir') {
      disponibles = todas.filter(
        (op) => !this.oposicionesContratadas.includes(op),
      );
    } else {
      // cambiar: la actual + las no contratadas (crossgrade). La actual no se "excluye"
      // aunque esté contratada.
      const actual = this.suscripcion?.oposicion ?? null;
      disponibles = todas.filter(
        (op) => op === actual || !this.oposicionesContratadas.includes(op),
      );
    }

    return disponibles.map((op) => ({
      value: op,
      label: OPOSICION_LABELS[op],
    }));
  }

  esChipSeleccionado(op: Oposicion): boolean {
    return this.oposicionSeleccionada === op;
  }

  /** true si la oposición elegida cargó pero no devolvió ningún plan utilizable. */
  get sinPlanes(): boolean {
    return (
      !!this.oposicionSeleccionada &&
      !this.cargandoPlanes() &&
      this.gruposPeriodo.length === 0
    );
  }

  /** Selecciona un chip de oposición y carga sus planes agrupados por periodo. */
  seleccionarOposicion(op: Oposicion): void {
    this.oposicionSeleccionada = op;
    // Reset de estado dependiente al cambiar de oposición.
    this.planSeleccionado = null;
    this.gruposPeriodo = [];
    this.preview.set(null);
    this.requiereCheckout.set(false);

    this.cargandoPlanes.set(true);
    this.suscripcionService.obtenerPlanesDisponibles(op).subscribe({
      next: (planes) => {
        // En modo cambiar, el plan actual no es un destino seleccionable.
        const planesDestino =
          this.modo === 'cambiar'
            ? planes.filter((p) => p.sku !== this.suscripcion?.sku)
            : planes;
        this.gruposPeriodo = this.agruparPorPeriodo(planesDestino);
        this.cargandoPlanes.set(false);
      },
      error: () => {
        this.gruposPeriodo = [];
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

  /** Agrupa los planes por billingPeriod en grupos Mensual (month) y Anual (year). */
  private agruparPorPeriodo(planes: PlanDisponible[]): GrupoPeriodo[] {
    const mensuales = planes.filter((p) => p.billingPeriod === 'month');
    const anuales = planes.filter((p) => p.billingPeriod === 'year');
    // Resto de periodos (week/day) son raros; los agrupamos en Mensual por robustez.
    const otros = planes.filter(
      (p) => p.billingPeriod !== 'month' && p.billingPeriod !== 'year',
    );

    const grupos: GrupoPeriodo[] = [];
    const grupoMensual = [...mensuales, ...otros];
    if (grupoMensual.length > 0) {
      grupos.push({
        periodo: 'month',
        titulo: 'Mensual',
        planes: grupoMensual,
      });
    }
    if (anuales.length > 0) {
      grupos.push({ periodo: 'year', titulo: 'Anual', planes: anuales });
    }
    return grupos;
  }

  // ── Selección de plan ───────────────────────────────────────────

  seleccionarPlan(plan: PlanDisponible): void {
    this.planSeleccionado = plan;
    // Reset de estado dependiente del plan anterior.
    this.preview.set(null);
    this.requiereCheckout.set(false);

    if (this.modo === 'cambiar') {
      this.cargarPreview(plan);
    }
  }

  esPlanSeleccionado(plan: PlanDisponible): boolean {
    return this.planSeleccionado?.sku === plan.sku;
  }

  /** Etiqueta del periodo del plan (mes/año/...) — idéntica a la de los componentes originales. */
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

  // ── Modo `anadir` ───────────────────────────────────────────────

  /** Texto del botón principal de alta con el precio del plan elegido. */
  labelBotonActivar(): string {
    const precio = this.planSeleccionado?.precio;
    if (precio == null) return 'Activar plan';
    return `Activar plan (${precio.toFixed(2).replace('.', ',')} €)`;
  }

  puedeActivar(): boolean {
    return !!this.planSeleccionado?.sku && !this.procesando();
  }

  activarPlan(): void {
    const plan = this.planSeleccionado;
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
          this.realizado.emit();
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
    const plan = this.planSeleccionado;
    if (!plan) return;
    window.open(
      `${environment.wooCommerceUrl}?add-to-cart=${plan.id}`,
      '_blank',
    );
  }

  // ── Modo `cambiar` (lógica money-critical COPIADA de CambioSuscripcionComponent) ──

  private cargarPreview(plan: PlanDisponible): void {
    if (!plan.sku || !this.suscripcion) return;
    this.cargandoPreview.set(true);
    this.suscripcionService
      .previewCambioSuscripcion(this.suscripcion.id, plan.sku)
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

  /** Diferencia de precio entre el plan elegido y el actual (para el resumen). */
  get diferenciaPrecio(): number | null {
    const precioActual = this.suscripcion?.monthlyPrice ?? null;
    if (!this.planSeleccionado?.precio || precioActual == null) return null;
    return this.planSeleccionado.precio - precioActual;
  }

  /**
   * Gating money-critical del cambio. COPIADO 1:1 de CambioSuscripcionComponent.
   * Bloquea ante avisos COOLDOWN/LIMITE_CAMBIOS/FUERA_DE_PLAZO/CAMBIO_NO_DISPONIBLE,
   * y en UPGRADE cuando el coste no es calculable o requiere cobro sin tarjeta usable.
   */
  puedeConfirmar(): boolean {
    const p = this.preview();
    if (!p) return false;
    const bloqueado = p.avisos?.some(
      (a) =>
        a.codigo === 'COOLDOWN' ||
        a.codigo === 'LIMITE_CAMBIOS' ||
        a.codigo === 'FUERA_DE_PLAZO' ||
        a.codigo === 'CAMBIO_NO_DISPONIBLE',
    );
    if (bloqueado) return false;
    if (p.switchType === 'UPGRADE') {
      // No dejar confirmar un upgrade cuyo coste no se pudo calcular (precio
      // destino o fechas de ciclo no disponibles): requiereCobro:false NO es "gratis".
      if (!p.costeCalculable) return false;
      if (p.requiereCobro && !p.metodoPago.usable) return false;
    }
    return true;
  }

  /** Etiqueta del botón de confirmar cambio. COPIADO 1:1 de CambioSuscripcionComponent. */
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

  /** Ejecuta el cambio de plan. Mismo flujo de toast/éxito que CambioSuscripcionComponent. */
  confirmarCambio(): void {
    if (!this.planSeleccionado?.sku || !this.suscripcion) return;
    this.procesando.set(true);

    this.suscripcionService
      .cambiarSuscripcion(this.suscripcion.id, this.planSeleccionado.sku)
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
            this.realizado.emit();
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

  cancelar(): void {
    this.cerrar.emit();
  }

  readonly Math = Math;
}
