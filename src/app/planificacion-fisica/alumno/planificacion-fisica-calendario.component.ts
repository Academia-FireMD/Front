import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
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
 * disciplina) más los añadidos de la vista alumno (intensidad de semana,
 * hoy, solo-lectura de la semana anterior, progreso).
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
    await this.cargar();
  }

  /**
   * Carga inicial: `misBloques()` (para el selector) y `miPlan()` (sin
   * `bloqueId`, el más específico por defecto — el mismo que marca
   * `esActivo` en `misBloques()`) EN PARALELO, mismo patrón que
   * `planificacion-fisica-marcas.component.ts`. No hace falta esperar a
   * `misBloques()` para saber qué bloque pedir: el default del backend
   * coincide siempre con el `esActivo` de `misBloques()`.
   *
   * `misBloques()` es best-effort (Fase 2, solo alimenta el selector): si
   * falla, el `.catch()` encadenado se traga el error y cae a `[]`, así
   * que el selector simplemente no aparece — nunca rompe la carga de `plan`.
   */
  private async cargar(): Promise<void> {
    this.loading.set(true);
    this.gated.set(null);
    this.error.set(false);
    try {
      // Defensivo (misBloques best-effort): `.catch()` encadenado en el
      // mismo nivel que `firstValueFrom`, sin envolver en una función async
      // aparte, para que ambas promesas del `Promise.all` tengan la misma
      // profundidad — si `misBloques()` falla, cae a `[]` sin romper `plan`.
      const [bloques, plan] = await Promise.all([
        firstValueFrom(this.svc.misBloques()).catch((): BloqueOpcion[] => []),
        firstValueFrom(this.svc.miPlan()),
      ]);
      this.misBloques.set(bloques);
      const activo = bloques.find((b) => b.esActivo) ?? bloques[0] ?? null;
      this.bloqueSeleccionadoId.set(activo?.id ?? null);
      this.miPlan.set(plan);
    } catch (err) {
      const httpErr = err as HttpErrorResponse;
      const body = httpErr?.error as AccesoDenegadoPlanFisica | undefined;
      if (httpErr?.status === 403 && body?.reason === 'TIER_TOO_LOW') {
        this.gated.set(body);
      } else {
        this.error.set(true);
        this.toast.error('No se ha podido cargar tu planificación física.');
      }
    } finally {
      this.loading.set(false);
      this.cargado.set(true);
    }
  }

  /** Botón "Reintentar" del estado de error: recarga bloques + plan desde cero. */
  protected reintentar(): void {
    void this.cargar();
  }

  /** Cambio en el selector del switcher: recarga solo el plan con el bloque elegido. */
  protected cambiarBloque(bloqueId: number): void {
    this.bloqueSeleccionadoId.set(bloqueId);
    void this.cargarPlan(bloqueId);
  }

  private async cargarPlan(bloqueId?: number): Promise<void> {
    this.loading.set(true);
    this.gated.set(null);
    this.error.set(false);
    try {
      const plan = await firstValueFrom(this.svc.miPlan(bloqueId));
      this.miPlan.set(plan);
    } catch (err) {
      const httpErr = err as HttpErrorResponse;
      const body = httpErr?.error as AccesoDenegadoPlanFisica | undefined;
      if (httpErr?.status === 403 && body?.reason === 'TIER_TOO_LOW') {
        this.gated.set(body);
      } else {
        this.error.set(true);
        this.toast.error('No se ha podido cargar tu planificación física.');
      }
    } finally {
      this.loading.set(false);
      this.cargado.set(true);
    }
  }

  protected esHoy(fecha: string): boolean {
    return fecha === this.hoy();
  }

  protected etiquetaDia(diaSemana: number): string {
    return this.etiquetasDia[diaSemana - 1] ?? '';
  }

  /**
   * Fondo gris de la tarjeta de semana en función de la intensidad (0-100):
   * a más intensidad, tono más oscuro — mismo lenguaje visual que el Excel
   * del entrenador.
   */
  protected fondoSemana(intensidad: number): string {
    const clamped = Math.min(100, Math.max(0, intensidad));
    const lightness = 94 - (clamped / 100) * 42;
    return `hsl(210, 12%, ${lightness}%)`;
  }

  protected progresoPorcentaje(hechas: number, total: number): number {
    if (total <= 0) return 0;
    return Math.round((hechas / total) * 100);
  }

  protected abrirDia(fecha: string): void {
    this.router.navigate(['/app/planificacion-fisica', 'dia', fecha]);
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
