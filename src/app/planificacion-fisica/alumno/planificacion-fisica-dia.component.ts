import { CommonModule, formatDate } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ProgressBarModule } from 'primeng/progressbar';
import { ToastrService } from 'ngx-toastr';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { getPlanLabel } from '../../shared/models/subscription.model';
import {
  AccesoDenegadoPlanFisica,
  DiaDetalle,
  DisciplinaDia,
  esDisciplinaCompletable,
  PlanificacionFisicaService,
} from '../services/planificacion-fisica.service';

/** Etiqueta estable para los límites inclusivos de intensidad del plan. */
export function formatearIntensidad(intensidad: number): string {
  const valor = Number.isFinite(intensidad)
    ? Math.min(100, Math.max(0, Math.round(intensidad)))
    : 0;
  const nivel = valor < 40 ? 'baja' : valor < 70 ? 'media' : 'alta';
  return `Intensidad ${nivel} (${valor}%)`;
}

/**
 * Detalle de un día de entrenamiento (Task 12, Fase 1b): el alumno ve cada
 * disciplina asignada ese día (color, contenido, comentario) y marca las que
 * ha completado. La semana anterior (`soloLectura`) se muestra en modo
 * consulta — sin checks activos, aunque el backend igual la rechazaría.
 *
 * `GET /dia/:fecha` es la fuente de verdad de `soloLectura` y `esHoy`: así
 * el botón nunca queda editable porque el `GET /mi-plan` best-effort falle.
 * Este último solo conserva el bloque efectivo al volver al calendario.
 */
@Component({
  selector: 'app-planificacion-fisica-dia',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ButtonModule, CardModule, ProgressBarModule],
  templateUrl: './planificacion-fisica-dia.component.html',
  styleUrl: './planificacion-fisica-dia.component.scss',
})
export class PlanificacionFisicaDiaComponent implements OnInit {
  private svc = inject(PlanificacionFisicaService);
  private toast = inject(ToastrService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private locale = inject(LOCALE_ID);

  protected loading = signal(false);
  protected detalle = signal<DiaDetalle | null>(null);
  protected soloLectura = signal(false);
  protected gated = signal<AccesoDenegadoPlanFisica | null>(null);
  protected errorCarga = signal(false);
  private fechaCargada: string | null = null;
  private bloqueIdEfectivo: number | undefined;
  /**
   * `asignacionId` de las disciplinas con un PUT `marcarProgreso` en vuelo.
   * Deshabilita SU botón "Marcar como hecho" mientras dura la petición: sin
   * esto, un doble-click rápido lee el mismo `realizado` obsoleto dos veces y
   * dispara dos PUTs con el mismo valor (perdiendo el segundo click, que el
   * usuario querría que revirtiera).
   */
  protected guardandoIds = signal<ReadonlySet<number>>(new Set());

  protected readonly progreso = computed(() => {
    const disciplinas = (this.detalle()?.disciplinas ?? []).filter(
      (disciplina) => !this.esDescanso(disciplina),
    );
    const hechas = disciplinas.filter((d) => d.realizado).length;
    return { hechas, total: disciplinas.length };
  });

  /**
   * Cabecera del día, "Viernes, 17 de julio". En español el `date` pipe
   * devuelve el día de la semana en minúscula ("viernes, 17 de julio") y la
   * cabecera lo arreglaba con `text-transform: capitalize`, que capitaliza
   * TODAS las palabras: salía "Viernes, 17 De Julio". Se formatea aquí y solo
   * se sube la primera letra.
   */
  protected readonly tituloFecha = computed(() => {
    const fecha = this.detalle()?.fecha;
    if (!fecha) return '';
    const texto = formatDate(fecha, "EEEE, d 'de' MMMM", this.locale);
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  });

  protected readonly progresoPorcentaje = computed(() => {
    const { hechas, total } = this.progreso();
    return total > 0 ? Math.round((hechas / total) * 100) : 0;
  });

  protected readonly esDiaDeDescanso = computed(() => {
    const disciplinas = this.detalle()?.disciplinas ?? [];
    return (
      disciplinas.length > 0 &&
      disciplinas.every((disciplina) => this.esDescanso(disciplina))
    );
  });

  protected readonly subtituloDia = computed(() => {
    const detalle = this.detalle();
    if (!detalle) return '';
    return `Semana ${detalle.numeroSemana} · ${formatearIntensidad(detalle.intensidad)}`;
  });

  protected readonly subtituloCabecera = computed(() => {
    const detalle = this.detalle();
    if (!detalle) return '';
    const texto = formatDate(detalle.fecha, 'EEEE d MMM', this.locale);
    return `${texto.charAt(0).toUpperCase() + texto.slice(1)} · Semana ${detalle.numeroSemana}`;
  });

  protected readonly badgePlan = computed(() => {
    const tipoPlan = this.detalle()?.tipoPlan;
    return tipoPlan ? `Plan ${getPlanLabel(tipoPlan)}` : '';
  });

  protected readonly etiquetaProgreso = computed(() => {
    return this.detalle()?.esHoy ? 'Hoy' : 'Progreso del día';
  });

  async ngOnInit(): Promise<void> {
    const fecha = this.route.snapshot.paramMap.get('fecha');
    if (!fecha) {
      this.toast.error('Fecha inválida.');
      this.volver();
      return;
    }
    const bloqueId = this.bloqueIdDeQuery();
    await this.cargar(fecha, bloqueId);
  }

  private bloqueIdDeQuery(): number | undefined {
    const raw = this.route.snapshot.queryParamMap.get('bloqueId');
    if (!raw || !/^\d+$/.test(raw)) return undefined;
    const bloqueId = Number(raw);
    return Number.isSafeInteger(bloqueId) && bloqueId > 0
      ? bloqueId
      : undefined;
  }

  private async cargar(fecha: string, bloqueId?: number): Promise<void> {
    this.loading.set(true);
    this.gated.set(null);
    this.errorCarga.set(false);
    this.fechaCargada = fecha;
    this.bloqueIdEfectivo = bloqueId;
    try {
      // Ambas llamadas son independientes y se lanzan en paralelo. `dia` es
      // la fuente de verdad para soloLectura; `mi-plan` queda best-effort
      // únicamente para conservar el bloque efectivo al navegar de vuelta.
      const [resultadoDia, miPlan] = await Promise.all([
        firstValueFrom(this.svc.dia(fecha, bloqueId)).then(
          (dia) => ({ ok: true as const, dia }),
          (error: unknown) => ({ ok: false as const, error }),
        ),
        firstValueFrom(this.svc.miPlan(bloqueId)).catch(() => null),
      ]);
      if (!resultadoDia.ok) throw resultadoDia.error;
      const dia = resultadoDia.dia;
      this.detalle.set(dia);
      this.soloLectura.set(dia.soloLectura);
      this.bloqueIdEfectivo = miPlan?.bloque.id ?? bloqueId;
    } catch (err) {
      const httpErr = err as HttpErrorResponse;
      const body = httpErr?.error as AccesoDenegadoPlanFisica | undefined;
      if (httpErr?.status === 403 && body?.reason === 'TIER_TOO_LOW') {
        this.gated.set(body);
      } else {
        this.errorCarga.set(true);
        this.toast.error('No se ha podido cargar el día.');
      }
    } finally {
      this.loading.set(false);
    }
  }

  protected async toggle(disciplina: DisciplinaDia): Promise<void> {
    if (this.soloLectura()) return;
    if (this.estaGuardando(disciplina.asignacionId)) return;
    const nuevoValor = !disciplina.realizado;
    this.marcarGuardando(disciplina.asignacionId, true);
    try {
      const res = await firstValueFrom(
        this.svc.marcarProgreso(
          disciplina.asignacionId,
          nuevoValor,
          this.bloqueIdEfectivo,
        ),
      );
      this.actualizarLocal(disciplina.asignacionId, res.realizado);
    } catch {
      this.toast.error(
        `No se ha podido actualizar "${disciplina.nombre}". Inténtalo de nuevo.`,
      );
    } finally {
      this.marcarGuardando(disciplina.asignacionId, false);
    }
  }

  protected estaGuardando(asignacionId: number): boolean {
    return this.guardandoIds().has(asignacionId);
  }

  protected esDescanso(disciplina: DisciplinaDia): boolean {
    return !esDisciplinaCompletable(disciplina.grupo);
  }

  private marcarGuardando(asignacionId: number, guardando: boolean): void {
    this.guardandoIds.update((ids) => {
      const next = new Set(ids);
      if (guardando) {
        next.add(asignacionId);
      } else {
        next.delete(asignacionId);
      }
      return next;
    });
  }

  private actualizarLocal(asignacionId: number, realizado: boolean): void {
    this.detalle.update((detalle) =>
      detalle
        ? {
            ...detalle,
            disciplinas: detalle.disciplinas.map((d) =>
              d.asignacionId === asignacionId ? { ...d, realizado } : d,
            ),
          }
        : detalle,
    );
  }

  protected volver(): void {
    const bloqueId = this.bloqueIdEfectivo;
    this.router.navigate(['/app/planificacion-fisica'], {
      queryParams: bloqueId ? { bloqueId } : {},
    });
  }

  protected reintentar(): void {
    if (!this.fechaCargada) return;
    void this.cargar(this.fechaCargada, this.bloqueIdEfectivo);
  }

  /** Mismo CTA que `ai-assistant-widget`: abre la tienda WooCommerce para mejorar de plan. */
  protected mejorarSuscripcion(): void {
    window.open(environment.wooCommerceUrl, '_blank');
  }
}
