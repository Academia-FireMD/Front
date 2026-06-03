import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { ToastrService } from 'ngx-toastr';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { TagModule } from 'primeng/tag';
import { environment } from '../../../environments/environment';
import { CursosAlumnoService } from '../services/cursos-alumno.service';
import { ComprarCursoCofResponse, CursoPublico } from '../models/curso.model';

@Component({
  selector: 'app-catalogo-page',
  standalone: true,
  imports: [ButtonModule, DialogModule, TagModule, RouterLink, DecimalPipe],
  templateUrl: './catalogo-page.component.html',
  styleUrl: './catalogo-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogoPageComponent implements OnInit {
  private readonly service = inject(CursosAlumnoService);
  private readonly toast = inject(ToastrService);

  cursos = signal<CursoPublico[]>([]);
  loading = signal(true);
  error = signal(false);

  /** Id del curso cuyo cobro 1-clic está en vuelo (botón spinner/disabled). */
  comprandoId = signal<number | null>(null);
  /**
   * Cursos que el alumno ya posee tras una compra 1-clic exitosa (o YA_TIENES)
   * en esta sesión. El botón "Comprar" pasa a "Ver curso" para estos.
   */
  comprados = signal<Set<number>>(new Set<number>());

  /**
   * Curso cuyo COF no es usable → panel "completa en la tienda". Reusa el
   * patrón `requiereCheckout` de GestionarPlanComponent (panel + botón tienda).
   * Guardamos el `wooProductId` que devuelve el backend para el `?add-to-cart=`.
   */
  checkoutDialogVisible = signal(false);
  checkoutMensaje = signal('');
  checkoutWooProductId = signal<number | null>(null);
  /** true → fallo de tarjeta rechazada (mensaje distinto + CTA a la tienda). */
  checkoutEsRechazo = signal(false);

  ngOnInit(): void {
    this.service.listCatalogo().subscribe({
      next: (data) => {
        this.cursos.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }

  /** true si el alumno ya posee el curso (compra de esta sesión). */
  yaComprado(curso: CursoPublico): boolean {
    return this.comprados().has(curso.id);
  }

  /** Compra en 1 clic contra el COF. Estado de carga mientras el backend cobra. */
  comprar(curso: CursoPublico): void {
    if (!curso.wooProductId || this.comprandoId() !== null) return;
    this.comprandoId.set(curso.id);

    this.service.comprarCursoCof(curso.id).subscribe({
      next: (res: ComprarCursoCofResponse) => {
        this.comprandoId.set(null);
        this.manejarRespuesta(curso, res);
      },
      error: () => {
        // Fallo HTTP no clasificado (red/500). Reintentable: re-habilita.
        this.comprandoId.set(null);
        this.toast.error('No se pudo procesar, inténtalo de nuevo.');
      },
    });
  }

  private manejarRespuesta(
    curso: CursoPublico,
    res: ComprarCursoCofResponse,
  ): void {
    if (res.success) {
      this.marcarComprado(curso.id);
      this.toast.success(res.mensaje || 'Ya tienes acceso a este curso.');
      return;
    }
    if ('requiereCheckout' in res) {
      // Alumno sin COF usable → panel explicativo + botón a la tienda.
      this.abrirCheckout(res.wooProductId, res.mensaje, false);
      return;
    }
    switch (res.error) {
      case 'YA_TIENES':
        this.marcarComprado(curso.id);
        this.toast.info(res.mensaje || 'Ya tienes este curso.');
        return;
      case 'PAGO_RECHAZADO':
        // Decline: NO re-habilitar 1-clic; empujar a la tienda con otra tarjeta.
        this.abrirCheckout(
          curso.wooProductId ?? null,
          res.mensaje ||
            'Tu tarjeta fue rechazada (fondos/banco). Cómpralo en la tienda con otra tarjeta.',
          true,
        );
        return;
      case 'ERROR_TEMPORAL':
        // Técnico: reintentable (el botón ya está re-habilitado).
        this.toast.error(
          res.mensaje || 'No se pudo procesar, inténtalo de nuevo.',
        );
        return;
    }
  }

  private marcarComprado(cursoId: number): void {
    this.comprados.update((prev) => {
      const next = new Set(prev);
      next.add(cursoId);
      return next;
    });
  }

  private abrirCheckout(
    wooProductId: number | null,
    mensaje: string,
    esRechazo: boolean,
  ): void {
    this.checkoutWooProductId.set(wooProductId);
    this.checkoutMensaje.set(mensaje);
    this.checkoutEsRechazo.set(esRechazo);
    this.checkoutDialogVisible.set(true);
  }

  /** Abre el checkout de WC pre-cargado con el producto del curso (fallback sin COF). */
  completarEnTienda(): void {
    const wooProductId = this.checkoutWooProductId();
    if (!wooProductId) return;
    window.open(
      `${environment.wooCommerceUrl}?add-to-cart=${wooProductId}`,
      '_blank',
    );
    this.checkoutDialogVisible.set(false);
  }
}
