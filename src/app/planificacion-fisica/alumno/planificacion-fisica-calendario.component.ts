import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DropdownModule } from 'primeng/dropdown';
import { ProgressBarModule } from 'primeng/progressbar';
import { ToastrService } from 'ngx-toastr';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AccesoDenegadoPlanFisica,
  BloqueOpcion,
  DiaCalendario,
  esDisciplinaCompletable,
  MiPlan,
  PlanificacionFisicaService,
} from '../services/planificacion-fisica.service';

const ETIQUETAS_DIA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

/**
 * Calendario de entrenamiento del alumno (Task 11, Fase 1b): sus 4 semanas
 * del bloque de planificación física vigente para su oposición, con las
 * disciplinas de cada día en forma de "chips" de color.
 *
 * NO es un calendario tipo `angular-calendar` (esto no es un calendario de
 * eventos genérico): es una rejilla de semanas propia, calcando el patrón
 * visual de `planificacion-fisica-detalles.component` (color por grupo de
 * disciplina) más los añadidos de la vista alumno (hoy, solo-lectura de la
 * semana anterior, progreso).
 */
@Component({
  selector: 'app-planificacion-fisica-calendario',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    CardModule,
    DropdownModule,
    ProgressBarModule,
  ],
  templateUrl: './planificacion-fisica-calendario.component.html',
  styleUrl: './planificacion-fisica-calendario.component.scss',
})
export class PlanificacionFisicaCalendarioComponent implements OnInit {
  private svc = inject(PlanificacionFisicaService);
  private toast = inject(ToastrService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);

  protected readonly etiquetasDia = ETIQUETAS_DIA;

  protected loading = signal(false);
  /** Distingue "aún no ha respondido" de "respondió y no hay plan" (null real). */
  protected cargado = signal(false);
  protected miPlan = signal<MiPlan | null>(null);
  protected gated = signal<AccesoDenegadoPlanFisica | null>(null);
  /**
   * Fallo genérico (500, red caída) al cargar `/mi-plan`, distinto de "sin
   * plan" (null real) y de "gated" (403 TIER_TOO_LOW). Si no se distingue,
   * la vista miente al alumno mostrando permanentemente "no tienes plan"
   * cuando en realidad hubo un error de backend.
   */
  protected error = signal(false);

  /**
   * Fase 2, switcher multi-oposición: bloques que le aplican al alumno.
   * Vacío/1 elemento en v1 (un solo bloque general) — el selector solo se
   * pinta cuando hay más de uno (`mostrarSwitcher`).
   */
  protected misBloques = signal<BloqueOpcion[]>([]);
  protected bloqueSeleccionadoId = signal<number | null>(null);
  private cargaActual = 0;
  private destruido = false;
  private ultimoBloqueSolicitado: number | undefined;

  protected readonly hoy = computed(() => this.miPlan()?.hoy ?? null);
  protected readonly sinPlan = computed(
    () =>
      this.cargado() &&
      !this.gated() &&
      !this.error() &&
      this.miPlan() === null,
  );
  protected readonly mostrarSwitcher = computed(
    () => this.misBloques().length > 1,
  );

  async ngOnInit(): Promise<void> {
    this.destroyRef.onDestroy(() => {
      this.destruido = true;
    });
    const bloqueInicial = this.bloqueIdDeParametro(
      this.route.snapshot.queryParamMap.get('bloqueId'),
    );
    this.ultimoBloqueSolicitado = bloqueInicial;
    const cargaInicial = this.cargar(bloqueInicial);
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const bloqueId = this.bloqueIdDeParametro(params.get('bloqueId'));
        if (this.ultimoBloqueSolicitado === bloqueId) return;
        this.ultimoBloqueSolicitado = bloqueId;
        void this.cargar(bloqueId);
      });
    await cargaInicial;
  }

  /**
   * Carga inicial: `misBloques()` (para el selector) y `miPlan()` (sin
   * `bloqueId`, el más específico por defecto — el mismo que marca
   * `esActivo` en `misBloques()`) EN PARALELO, mismo patrón que
   * `planificacion-fisica-marcas.component.ts`. No hace falta esperar a
   * `misBloques()` para saber qué bloque pedir: el default del backend
   * coincide siempre con el `esActivo` de `misBloques()`.
   *
   * `misBloques()` es best-effort (Fase 2, solo alimenta el selector): un
   * fallo transitorio no rompe la carga de `plan` ni invalida el último
   * selector que sí se pudo cargar.
   */
  private async cargar(bloqueIdQuery?: number): Promise<void> {
    const carga = ++this.cargaActual;
    this.loading.set(true);
    this.gated.set(null);
    this.error.set(false);
    try {
      const [resultadoBloques, resultadoPlan] = await Promise.all([
        firstValueFrom(
          this.svc.misBloques().pipe(takeUntilDestroyed(this.destroyRef)),
        ).then(
          (bloques) => ({ ok: true as const, bloques }),
          () => ({ ok: false as const }),
        ),
        firstValueFrom(
          this.svc
            .miPlan(bloqueIdQuery)
            .pipe(takeUntilDestroyed(this.destroyRef)),
        ).then(
          (plan) => ({ ok: true as const, plan }),
          (error: unknown) => ({ ok: false as const, error }),
        ),
      ]);
      if (this.destruido || carga !== this.cargaActual) return;
      if (!resultadoPlan.ok) throw resultadoPlan.error;
      const plan = resultadoPlan.plan;
      if (resultadoBloques.ok) this.misBloques.set(resultadoBloques.bloques);
      const bloques = this.misBloques();
      const activo = bloques.find((b) => b.esActivo) ?? bloques[0] ?? null;
      this.miPlan.set(plan);
      const bloqueEfectivo = plan?.bloque.id;
      this.bloqueSeleccionadoId.set(bloqueEfectivo ?? null);
      if (
        bloqueEfectivo &&
        (bloqueIdQuery !== bloqueEfectivo ||
          (bloques.length === 0 && !bloqueIdQuery))
      ) {
        this.normalizarBloqueEnUrl(bloqueEfectivo);
      } else if (!bloqueEfectivo) {
        this.bloqueSeleccionadoId.set(activo?.id ?? null);
      }
    } catch (err) {
      if (this.destruido || carga !== this.cargaActual) return;
      const httpErr = err as HttpErrorResponse;
      const body = httpErr?.error as AccesoDenegadoPlanFisica | undefined;
      if (httpErr?.status === 403 && body?.reason === 'TIER_TOO_LOW') {
        this.gated.set(body);
      } else {
        this.error.set(true);
        this.toast.error('No se ha podido cargar tu planificación física.');
      }
    } finally {
      if (this.destruido || carga !== this.cargaActual) return;
      this.loading.set(false);
      this.cargado.set(true);
    }
  }

  /** Botón "Reintentar" del estado de error: recarga bloques + plan desde cero. */
  protected reintentar(): void {
    void this.cargar(
      this.bloqueIdDeParametro(
        this.route.snapshot.queryParamMap.get('bloqueId'),
      ),
    );
  }

  /** Cambio en el selector del switcher: recarga solo el plan con el bloque elegido. */
  protected cambiarBloque(bloqueId: number): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { bloqueId },
      queryParamsHandling: 'merge',
    });
  }

  private bloqueIdDeParametro(raw: string | null): number | undefined {
    if (!raw || !/^\d+$/.test(raw)) return undefined;
    const bloqueId = Number(raw);
    return Number.isSafeInteger(bloqueId) && bloqueId > 0
      ? bloqueId
      : undefined;
  }

  private normalizarBloqueEnUrl(bloqueId: number): void {
    // La emisión de esta navegación se ignora por igualdad. Actualizar antes
    // de navegar también evita que una navegación cancelada deje un latch
    // pendiente que pueda suprimir una navegación posterior del usuario.
    this.ultimoBloqueSolicitado = bloqueId;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { bloqueId },
      replaceUrl: true,
    });
  }

  protected esHoy(fecha: string): boolean {
    return fecha === this.hoy();
  }

  protected etiquetaDia(diaSemana: number): string {
    return this.etiquetasDia[diaSemana - 1] ?? '';
  }

  protected progresoPorcentaje(hechas: number, total: number): number {
    if (total <= 0) return 0;
    return Math.round((hechas / total) * 100);
  }

  /**
   * Progreso del día (disciplinas hechas / asignadas), derivado de los chips
   * que ya trae `mi-plan` — no hace falta otro endpoint. Es la barra "diaria"
   * que pedía Sergio (prioridad por encima de la semanal).
   */
  protected progresoDia(dia: DiaCalendario): { hechas: number; total: number } {
    const completables = dia.chips.filter((chip) =>
      esDisciplinaCompletable(chip.grupo),
    );
    return {
      hechas: completables.filter((chip) => chip.realizado).length,
      total: completables.length,
    };
  }

  // La mini-barra diaria ya no calcula color en TS: seguía la escala semáforo
  // del temario y al 100% se pintaba verde brillante — el color que el cliente
  // tiene reservado a "Específico SPEIS" en el calendario de estudio, y encima
  // distinto del naranja que ya usaba el detalle de día para la misma barra.
  // Ahora el color es fijo y vive en el .scss (`$pf-naranja-barra`), única
  // fuente compartida con la vista de detalle.

  protected abrirDia(fecha: string): void {
    const bloqueId = this.bloqueSeleccionadoId();
    this.router.navigate(['/app/planificacion-fisica', 'dia', fecha], {
      queryParams: bloqueId ? { bloqueId } : {},
    });
  }

  /** Entrada al histórico de marcas personales (Fase 2), independiente del plan del entrenador. */
  protected irAMarcas(): void {
    this.router.navigate(['/app/planificacion-fisica', 'marcas']);
  }

  /** Mismo CTA que `ai-assistant-widget`: abre la tienda WooCommerce para mejorar de plan. */
  protected mejorarSuscripcion(): void {
    window.open(environment.wooCommerceUrl, '_blank');
  }
}
