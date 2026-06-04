import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  OnInit,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { AccordionModule } from 'primeng/accordion';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { environment } from '../../../environments/environment';
import {
  ComprarCursoCofResponse,
  CursoSlugResponse,
  Leccion,
  TipoLeccion,
} from '../models/curso.model';
import { CursosAlumnoService } from '../services/cursos-alumno.service';

/**
 * Refactor 2026-05-25 (T12 / D4): acepta input opcional `previewData` para
 * que el admin renderice el curso-detail SIN hacer fetch HTTP ni verificar
 * AccesoCurso. Cuando preview, muestra banner explicativo para evitar
 * false-confidence (parece un alumno pero no lo es).
 *
 * HIGH-4 (codex review): el modo preview requiere un **opt-in explícito**
 * via `previewMode=true`. Si un caller pasa sólo `previewData` por error,
 * el componente NO bypasea el fetch HTTP — comportamiento normal aplica.
 * Esto evita que un consumer accidental active el bypass de AccesoCurso.
 */
@Component({
  selector: 'app-curso-detail-page',
  standalone: true,
  imports: [
    AccordionModule,
    ButtonModule,
    DialogModule,
    TagModule,
    TooltipModule,
    RouterLink,
    DecimalPipe,
  ],
  templateUrl: './curso-detail-page.component.html',
  styleUrl: './curso-detail-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CursoDetailPageComponent implements OnInit {
  private readonly service = inject(CursosAlumnoService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastrService);

  /**
   * Datos pre-construidos para el preview. Solo se usan si `previewMode=true`.
   * Si el caller pasa `previewData` pero NO `previewMode`, el componente
   * ignora `previewData` y hace el fetch HTTP normal (con AccesoCurso check).
   */
  readonly previewData = input<CursoSlugResponse | null>(null);
  /**
   * HIGH-4 (codex review): opt-in explícito al modo preview. Sin este flag
   * a `true`, `previewData` no activa el bypass de AccesoCurso. Esto evita
   * que un consumer accidental que solo pase `previewData` skipee el check.
   */
  readonly previewMode = input<boolean>(false);

  cursoData = signal<CursoSlugResponse | null>(null);
  loading = signal(true);
  error = signal(false);

  /** true mientras el backend cobra el COF (~2,5-5s). Botón spinner/disabled. */
  comprando = signal(false);

  /**
   * Panel "completa en la tienda" (reusa el patrón `requiereCheckout` de
   * GestionarPlanComponent). Se abre cuando el alumno no tiene COF usable o la
   * tarjeta fue rechazada (decline → empujar a la tienda con otra tarjeta).
   */
  checkoutDialogVisible = signal(false);
  checkoutMensaje = signal('');
  checkoutWooProductId = signal<number | null>(null);
  /** true → tarjeta rechazada (mensaje + cabecera distintos del sin-COF). */
  checkoutEsRechazo = signal(false);

  readonly isPreview = computed(
    () => this.previewMode() && this.previewData() !== null,
  );

  tipoIconos: Record<TipoLeccion, string> = {
    VIDEO: 'pi pi-play-circle',
    TEXTO: 'pi pi-file',
    TEST: 'pi pi-question-circle',
    FLASHCARDS: 'pi pi-clone',
  };

  tipoLabels: Record<TipoLeccion, string> = {
    VIDEO: 'Vídeo',
    TEXTO: 'Lectura',
    TEST: 'Test',
    FLASHCARDS: 'Flashcards',
  };

  constructor() {
    // Si llega previewData en runtime (admin lo cambia con toggle), refleja
    // el cambio en el state local. Sirve para re-render sin reinstanciar.
    // Solo aplica si `previewMode=true` (HIGH-4 codex review).
    //
    // `allowSignalWrites: true` — Angular 18 prohibe writes a signals dentro
    // de effects por default; aquí necesitamos sincronizar el input
    // (previewData) con el signal local (cursoData) que el template lee.
    effect(
      () => {
        if (!this.previewMode()) return;
        const preview = this.previewData();
        if (preview) {
          this.cursoData.set(preview);
          this.loading.set(false);
          this.error.set(false);
        }
      },
      { allowSignalWrites: true },
    );
  }

  ngOnInit(): void {
    if (this.isPreview()) {
      // El effect arriba ya cubre este caso.
      return;
    }
    const slug = this.route.snapshot.paramMap.get('slug') ?? '';
    this.service.getCurso(slug).subscribe({
      next: (data) => {
        this.cursoData.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }

  openLeccion(leccion: Leccion): void {
    if (this.isPreview()) {
      // En modo preview no navegamos; el admin no debería poder pegar
      // navegación encima del form.
      return;
    }
    const slug = this.route.snapshot.paramMap.get('slug') ?? '';
    this.router.navigate(['/app/cursos', slug, 'leccion', leccion.id]);
  }

  totalLecciones(): number {
    return (
      this.cursoData()?.curso.secciones?.flatMap((s) => s.lecciones).length ?? 0
    );
  }

  // ── Compra 1-clic (COF) ──────────────────────────────────────────

  /** Compra el curso en 1 clic contra el COF del alumno (tarjeta guardada). */
  comprar(): void {
    if (this.isPreview() || this.comprando()) return;
    const data = this.cursoData();
    const cursoId = data?.curso.id;
    if (!cursoId || !data?.curso.wooProductId) return;

    this.comprando.set(true);
    this.service.comprarCursoCof(cursoId).subscribe({
      next: (res: ComprarCursoCofResponse) => {
        this.comprando.set(false);
        this.manejarRespuesta(res);
      },
      error: () => {
        // Fallo HTTP no clasificado (red/500). Reintentable: re-habilita.
        this.comprando.set(false);
        this.toast.error('No se pudo procesar, inténtalo de nuevo.');
      },
    });
  }

  private manejarRespuesta(res: ComprarCursoCofResponse): void {
    if (res.success) {
      this.concederAcceso();
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
        this.concederAcceso();
        this.toast.info(res.mensaje || 'Ya tienes este curso.');
        return;
      case 'PAGO_RECHAZADO':
        // Decline: NO re-habilitar 1-clic; empujar a la tienda con otra tarjeta.
        this.abrirCheckout(
          this.cursoData()?.curso.wooProductId ?? null,
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

  /** Marca el curso como accesible en el state local (grant in-app inmediato). */
  private concederAcceso(): void {
    this.cursoData.update((prev) =>
      prev ? { ...prev, tieneAcceso: true } : prev,
    );
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
