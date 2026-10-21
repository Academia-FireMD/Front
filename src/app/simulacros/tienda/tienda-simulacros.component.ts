import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { ButtonModule } from 'primeng/button';
import { ChipModule } from 'primeng/chip';
import { DialogModule } from 'primeng/dialog';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { environment } from '../../../environments/environment';
import {
  SimulacroCompraIntento,
  SimulacroCompraIntentoService,
} from '../../compras/simulacro-compra-intento.service';
import {
  ComprarSimulacroCofResponse,
  SimulacroTienda,
} from '../../examen/models/examen.model';
import { ExamenesService } from '../../examen/servicios/examen.service';
import { AuthService } from '../../services/auth.service';

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
  private readonly authService = inject(AuthService);
  private readonly intentoService = inject(SimulacroCompraIntentoService);
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
  /** Intento durable (usuario+simulacro), compartido con la landing. */
  compraIntento = signal<SimulacroCompraIntento | null>(null);
  /** true mientras el backend cobra el COF (~2,5-5s). */
  comprando = signal(false);
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
    const usuarioId = this.authService.getCurrentUser()?.id;
    if (s.estado !== 'COMPRABLE' || !usuarioId || this.comprando()) return;
    try {
      this.compraIntento.set(
        this.intentoService.obtenerOCrear(usuarioId, s.id, s.precio),
      );
      this.seleccionado.set(s);
      this.confirmVisible.set(true);
    } catch (error) {
      this.toastr.error(
        error instanceof Error
          ? error.message
          : 'No se pudo recuperar el intento de compra.',
        'Compra no iniciada',
      );
    }
  }

  /** Confirma la compra: cobra el COF del alumno (tarjeta guardada). */
  confirmarCompra(): void {
    const s = this.seleccionado();
    const usuarioId = this.authService.getCurrentUser()?.id;
    if (!s || !usuarioId || this.comprando()) return;
    let intento: SimulacroCompraIntento;
    try {
      intento = this.intentoService.obtenerOCrear(usuarioId, s.id, s.precio);
      this.compraIntento.set(intento);
    } catch (error) {
      this.toastr.error(
        error instanceof Error
          ? error.message
          : 'No se pudo recuperar el intento de compra.',
        'Compra no iniciada',
      );
      return;
    }
    this.comprando.set(true);
    this.examenService
      .comprarSimulacroCof$(
        s.id,
        intento.idempotencyKey,
        intento.importeConfirmado,
        {
          omitirLecturaFiscalInicial: intento.enviado,
          antesDeEnviar: () => this.intentoService.marcarEnviado(intento),
        },
      )
      .pipe(finalize(() => this.comprando.set(false)))
      .subscribe({
        next: (res) => {
          this.manejarRespuesta(s, intento, res);
        },
        error: () => {
          this.toastr.error(
            'No se pudo procesar la compra, inténtalo de nuevo.',
            'Error',
          );
        },
      });
  }

  private manejarRespuesta(
    s: SimulacroTienda,
    intento: SimulacroCompraIntento,
    res: ComprarSimulacroCofResponse,
  ): void {
    if (res.success) {
      this.finalizarIntento(intento);
      this.confirmVisible.set(false);
      this.marcarComprado(s.id);
      this.toastr.success(
        res.mensaje || 'Compra realizada. Ya tienes acceso.',
        'Compra realizada',
      );
      return;
    }
    if ('requiereCheckout' in res) {
      // Esta respuesta neutral confirma que no se inició una captura.
      this.finalizarIntento(intento);
      this.abrirCheckout(res.wooProductId, res.mensaje, false);
      return;
    }
    switch (res.error) {
      case 'PAGO_RECHAZADO':
        this.finalizarIntento(intento);
        this.abrirCheckout(
          res.wooProductId ?? s.woocommerceProductId,
          res.mensaje ||
            'Tu tarjeta fue rechazada. Cómpralo en la tienda con otra tarjeta.',
          true,
        );
        return;
      case 'ERROR_TEMPORAL':
        // Ambiguo/reintentable: el intento durable conserva key e importe.
        this.toastr.warning(
          res.mensaje ||
            'Estamos verificando tu pago. Si se completó, tendrás acceso en unos minutos.',
          'Pago en verificación',
        );
        return;
    }
  }

  private finalizarIntento(intento: SimulacroCompraIntento): void {
    try {
      this.intentoService.finalizar(intento);
      if (this.compraIntento()?.idempotencyKey === intento.idempotencyKey) {
        this.compraIntento.set(null);
      }
    } catch {
      // Dejar la key durable; un retry seguro recibirá el replay del Server.
      this.toastr.warning(
        'La compra se confirmó, pero no se pudo cerrar el intento local. No inicies otra compra.',
        'Compra confirmada',
      );
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
}
