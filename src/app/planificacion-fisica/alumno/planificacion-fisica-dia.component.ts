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
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { CheckboxModule } from 'primeng/checkbox';
import { ProgressBarModule } from 'primeng/progressbar';
import { ToastrService } from 'ngx-toastr';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AccesoDenegadoPlanFisica,
  DiaDetalle,
  DisciplinaDia,
  MiPlan,
  PlanificacionFisicaService,
} from '../services/planificacion-fisica.service';

/**
 * Detalle de un día de entrenamiento (Task 12, Fase 1b): el alumno ve cada
 * disciplina asignada ese día (color, contenido, comentario) y marca las que
 * ha completado. La semana anterior (`soloLectura`) se muestra en modo
 * consulta — sin checks activos, aunque el backend igual la rechazaría.
 *
 * `soloLectura` no viene en `GET /dia/:fecha` (contrato del backend), así
 * que se deduce cruzando con `GET /mi-plan` (busca a qué semana pertenece
 * esta fecha) — la opción más simple sin tocar el contrato del backend.
 */
@Component({
  selector: 'app-planificacion-fisica-dia',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    CardModule,
    CheckboxModule,
    ProgressBarModule,
  ],
  templateUrl: './planificacion-fisica-dia.component.html',
  styleUrl: './planificacion-fisica-dia.component.scss',
})
export class PlanificacionFisicaDiaComponent implements OnInit {
  private svc = inject(PlanificacionFisicaService);
  private toast = inject(ToastrService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  protected loading = signal(false);
  protected detalle = signal<DiaDetalle | null>(null);
  protected soloLectura = signal(false);
  protected gated = signal<AccesoDenegadoPlanFisica | null>(null);
  /**
   * `asignacionId` de las disciplinas con un PUT `marcarProgreso` en vuelo.
   * Deshabilita SU checkbox mientras dura la petición: sin esto, un
   * doble-click rápido lee el mismo `realizado` obsoleto dos veces y dispara
   * dos PUTs con el mismo valor (perdiendo el segundo click, que el usuario
   * querría que revirtiera).
   */
  protected guardandoIds = signal<ReadonlySet<number>>(new Set());

  protected readonly progreso = computed(() => {
    const disciplinas = this.detalle()?.disciplinas ?? [];
    const hechas = disciplinas.filter((d) => d.realizado).length;
    return { hechas, total: disciplinas.length };
  });

  protected readonly progresoPorcentaje = computed(() => {
    const { hechas, total } = this.progreso();
    return total > 0 ? Math.round((hechas / total) * 100) : 0;
  });

  async ngOnInit(): Promise<void> {
    const fecha = this.route.snapshot.paramMap.get('fecha');
    if (!fecha) {
      this.toast.error('Fecha inválida.');
      this.volver();
      return;
    }
    await this.cargar(fecha);
  }

  private async cargar(fecha: string): Promise<void> {
    this.loading.set(true);
    this.gated.set(null);
    try {
      // Ambas llamadas son independientes (ninguna depende del resultado de
      // la otra) — se lanzan en paralelo. `mi-plan` es best-effort: solo se
      // usa para deducir `soloLectura`; si falla (p.ej. condición de carrera
      // rarísima con `dia()` ya en éxito) no bloqueamos la vista — se trata
      // como editable, y el backend sigue siendo la fuente de verdad que
      // rechaza el PUT si de verdad es solo lectura.
      const [dia, miPlan] = await Promise.all([
        firstValueFrom(this.svc.dia(fecha)),
        firstValueFrom(this.svc.miPlan()).catch(() => null),
      ]);
      this.detalle.set(dia);
      this.soloLectura.set(this.deducirSoloLectura(miPlan, fecha));
    } catch (err) {
      const httpErr = err as HttpErrorResponse;
      const body = httpErr?.error as AccesoDenegadoPlanFisica | undefined;
      if (httpErr?.status === 403 && body?.reason === 'TIER_TOO_LOW') {
        this.gated.set(body);
      } else {
        this.toast.error('No se ha podido cargar el día.');
      }
    } finally {
      this.loading.set(false);
    }
  }

  private deducirSoloLectura(miPlan: MiPlan | null, fecha: string): boolean {
    if (!miPlan) return false;
    const semana = miPlan.semanas.find((s) =>
      s.dias.some((d) => d.fecha === fecha),
    );
    return semana?.soloLectura ?? false;
  }

  protected async toggle(disciplina: DisciplinaDia): Promise<void> {
    if (this.soloLectura()) return;
    if (this.estaGuardando(disciplina.asignacionId)) return;
    const nuevoValor = !disciplina.realizado;
    this.marcarGuardando(disciplina.asignacionId, true);
    try {
      const res = await firstValueFrom(
        this.svc.marcarProgreso(disciplina.asignacionId, nuevoValor),
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
    this.router.navigate(['/app/planificacion-fisica']);
  }

  /** Mismo CTA que `ai-assistant-widget`: abre la tienda WooCommerce para mejorar de plan. */
  protected mejorarSuscripcion(): void {
    window.open(environment.wooCommerceUrl, '_blank');
  }
}
