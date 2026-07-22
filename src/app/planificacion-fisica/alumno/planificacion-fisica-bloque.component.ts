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
  MiPlanCompleto,
  PlanificacionFisicaService,
} from '../services/planificacion-fisica.service';

const ETIQUETAS_DIA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

/**
 * Vista de BLOQUE COMPLETO del alumno (Gap #12 de la petición de Sergio:
 * "visión más global" — todas las semanas del bloque de un vistazo, como la
 * página 1 de su PDF, en vez de solo la ventana rodante de 4 semanas).
 *
 * Es una vista de SOLO LECTURA visual: los días fuera de la ventana de 4
 * semanas (`enVentana === false`) se muestran atenuados y NO son clicables
 * — `dia/:fecha` los rechazaría con 403 por diseño, así que aquí ni se
 * ofrece el gesto. La interactividad real (marcar hecho, ver ejercicios)
 * sigue viviendo en el calendario (`/app/planificacion-fisica`).
 *
 * Misma carga/estados que el calendario (switcher multi-oposición, gate de
 * tier con píldora de upsell, error, sin plan) — calcados de
 * `planificacion-fisica-calendario.component.ts` para que el alumno no
 * perciba dos módulos distintos.
 */
@Component({
  selector: 'app-planificacion-fisica-bloque',
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
  templateUrl: './planificacion-fisica-bloque.component.html',
  styleUrl: './planificacion-fisica-bloque.component.scss',
})
export class PlanificacionFisicaBloqueComponent implements OnInit {
  private svc = inject(PlanificacionFisicaService);
  private toast = inject(ToastrService);
  private router = inject(Router);

  protected readonly etiquetasDia = ETIQUETAS_DIA;

  protected loading = signal(false);
  protected cargado = signal(false);
  protected miPlan = signal<MiPlanCompleto | null>(null);
  protected gated = signal<AccesoDenegadoPlanFisica | null>(null);
  protected error = signal(false);

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

  /** Mismo patrón de carga en paralelo que el calendario (ver su docstring). */
  private async cargar(): Promise<void> {
    this.loading.set(true);
    this.gated.set(null);
    this.error.set(false);
    try {
      const [bloques, plan] = await Promise.all([
        firstValueFrom(this.svc.misBloques()).catch((): BloqueOpcion[] => []),
        firstValueFrom(this.svc.miPlanCompleto()),
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

  protected reintentar(): void {
    void this.cargar();
  }

  protected cambiarBloque(bloqueId: number): void {
    this.bloqueSeleccionadoId.set(bloqueId);
    void this.cargarPlan(bloqueId);
  }

  private async cargarPlan(bloqueId?: number): Promise<void> {
    this.loading.set(true);
    this.gated.set(null);
    this.error.set(false);
    try {
      const plan = await firstValueFrom(this.svc.miPlanCompleto(bloqueId));
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

  /** Mismo cálculo de fondo por intensidad que el calendario de 4 semanas. */
  protected fondoSemana(intensidad: number): string {
    const clamped = Math.min(100, Math.max(0, intensidad));
    const lightness = 94 - (clamped / 100) * 42;
    return `hsl(210, 12%, ${lightness}%)`;
  }

  protected progresoPorcentaje(hechas: number, total: number): number {
    if (total <= 0) return 0;
    return Math.round((hechas / total) * 100);
  }

  /**
   * Solo los días dentro de la ventana navegan al detalle — fuera de ella el
   * backend responde 403 por diseño, así que el click ni se ofrece (el día se
   * pinta atenuado y sin cursor pointer desde el HTML/SCSS).
   */
  protected abrirDia(fecha: string, enVentana: boolean): void {
    if (!enVentana) return;
    this.router.navigate(['/app/planificacion-fisica', 'dia', fecha]);
  }

  /** Vuelta al calendario operativo (la ventana de 4 semanas). */
  protected volverAlCalendario(): void {
    this.router.navigate(['/app/planificacion-fisica']);
  }

  /** Mismo CTA que el calendario: abre la tienda WooCommerce para mejorar de plan. */
  protected mejorarSuscripcion(): void {
    window.open(environment.wooCommerceUrl, '_blank');
  }
}
