import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { ButtonModule } from 'primeng/button';
import { ChipModule } from 'primeng/chip';
import { DialogModule } from 'primeng/dialog';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { environment } from '../../../environments/environment';
import {
  ComprarSimulacroCofResponse,
  SimulacroTienda,
} from '../../examen/models/examen.model';
import { ExamenesService } from '../../examen/servicios/examen.service';

/**
 * Tienda de simulacros: catálogo de simulacros comprables por el alumno, con
 * compra in-app 1-clic por COF. Sigue el patrón de UI/UX de "cambiar suscripción"
 * (header + grid de cards + diálogo de confirmación). Reusa la misma mecánica de
 * cobro money-critical que la landing del simulacro (`comprarSimulacroCof$`):
 * idempotencyKey estable por intento, manejo de requiereCheckout/decline/error.
 */
@Component({
  selector: 'app-tienda-simulacros',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    DialogModule,
    ChipModule,
    ProgressSpinnerModule,
  ],
  templateUrl: './tienda-simulacros.component.html',
  styleUrl: './tienda-simulacros.component.scss',
})
export class TiendaSimulacrosComponent implements OnInit {
  private readonly examenService = inject(ExamenesService);
  private readonly router = inject(Router);
  private readonly toastr = inject(ToastrService);

  cargando = signal(true);
  error = signal(false);
  simulacros = signal<SimulacroTienda[]>([]);

  // ── Compra (1-clic COF) ───────────────────────────────────────────────────
  /** Diálogo de confirmación de compra. */
  confirmVisible = signal(false);
  /** Simulacro objetivo de la compra en curso. */
  seleccionado = signal<SimulacroTienda | null>(null);
  /** true mientras el backend cobra el COF (~2,5-5s). */
  comprando = signal(false);
  /**
   * Clave de idempotencia del intento en curso: se genera al abrir la
   * confirmación y se reutiliza en reintentos (ERROR_TEMPORAL) para deduplicar y
   * no doble-cobrar; se limpia en estados terminales.
   */
  private idempotencyKey = '';

  // ── Fallback "completa en la tienda" ──────────────────────────────────────
  checkoutVisible = signal(false);
  checkoutMensaje = signal('');
  checkoutEsRechazo = signal(false);
  checkoutWooProductId = signal<string | null>(null);

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set(false);
    this.examenService.listarSimulacrosTienda$().subscribe({
      next: (lista) => {
        this.simulacros.set(lista);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set(true);
        this.cargando.set(false);
      },
    });
  }

  /** Abre la confirmación de compra (solo para simulacros COMPRABLE). */
  abrirCompra(s: SimulacroTienda): void {
    if (s.estado !== 'COMPRABLE' || this.comprando()) return;
    this.seleccionado.set(s);
    this.idempotencyKey = this.generarIdempotencyKey();
    this.confirmVisible.set(true);
  }

  /** Confirma la compra: cobra el COF del alumno (tarjeta guardada). */
  confirmarCompra(): void {
    const s = this.seleccionado();
    if (!s || this.comprando()) return;
    if (!this.idempotencyKey) {
      this.idempotencyKey = this.generarIdempotencyKey();
    }
    this.comprando.set(true);
    this.examenService
      .comprarSimulacroCof$(s.id, this.idempotencyKey)
      .subscribe({
        next: (res) => {
          this.comprando.set(false);
          this.manejarRespuesta(s, res);
        },
        error: () => {
          this.comprando.set(false);
          this.toastr.error(
            'No se pudo procesar la compra, inténtalo de nuevo.',
            'Error',
          );
        },
      });
  }

  private manejarRespuesta(
    s: SimulacroTienda,
    res: ComprarSimulacroCofResponse,
  ): void {
    if (res.success) {
      this.idempotencyKey = '';
      this.confirmVisible.set(false);
      this.marcarComprado(s.id);
      this.toastr.success(
        res.mensaje || 'Compra realizada. Ya tienes acceso.',
        'Compra realizada',
      );
      return;
    }
    if ('requiereCheckout' in res) {
      this.idempotencyKey = '';
      this.abrirCheckout(res.wooProductId, res.mensaje, false);
      return;
    }
    switch (res.error) {
      case 'PAGO_RECHAZADO':
        this.idempotencyKey = '';
        this.abrirCheckout(
          res.wooProductId ?? s.woocommerceProductId,
          res.mensaje ||
            'Tu tarjeta fue rechazada. Cómpralo en la tienda con otra tarjeta.',
          true,
        );
        return;
      case 'ERROR_TEMPORAL':
        // Reintentable: NO se limpia la clave (un retry debe deduplicar).
        this.toastr.warning(
          res.mensaje ||
            'Estamos verificando tu pago. Si se completó, tendrás acceso en unos minutos.',
          'Pago en verificación',
        );
        return;
    }
  }

  /** Marca un simulacro como COMPRADO en el state local (grant inmediato). */
  private marcarComprado(id: number): void {
    this.simulacros.update((lista) =>
      lista.map((x) => (x.id === id ? { ...x, estado: 'COMPRADO' } : x)),
    );
  }

  private abrirCheckout(
    wooProductId: string | null,
    mensaje: string,
    esRechazo: boolean,
  ): void {
    this.confirmVisible.set(false);
    this.checkoutWooProductId.set(wooProductId);
    this.checkoutMensaje.set(mensaje);
    this.checkoutEsRechazo.set(esRechazo);
    this.checkoutVisible.set(true);
  }

  /** Abre el checkout de WC con el producto del simulacro (fallback sin COF). */
  completarEnTienda(): void {
    const woo = this.checkoutWooProductId();
    if (!woo) return;
    window.open(`${environment.wooCommerceUrl}?add-to-cart=${woo}`, '_blank');
    this.checkoutVisible.set(false);
  }

  /** Navega a la landing del simulacro para realizarlo. */
  realizar(s: SimulacroTienda): void {
    this.router.navigate(['/simulacros/realizar-simulacro', s.id]);
  }

  private generarIdempotencyKey(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }
    return `sim_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }
}
