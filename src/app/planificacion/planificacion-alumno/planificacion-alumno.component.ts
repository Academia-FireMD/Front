import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  inject,
  OnInit,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { firstValueFrom } from 'rxjs';
import { ConfiguracionPlanificacion } from '../models/autoasignacion.model';
import { PlanificacionBloqueadaComponent } from '../planificacion-bloqueada/planificacion-bloqueada.component';
import {
  PlanificacionConfiguracionWizardComponent,
  ResultadoConfiguracion,
} from '../planificacion-configuracion-wizard/planificacion-configuracion-wizard.component';
import { AutoasignacionService } from '../services/autoasignacion.service';
import { getPlanificacionOposicionLabel } from '../../shared/models/subscription.model';
import {
  getFranjaPlanificacionLabel,
  getNivelOposicionLabel,
} from '../../shared/utils/planificacion-labels.util';

@Component({
  selector: 'app-planificacion-alumno',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ButtonModule,
    MessageModule,
    ProgressSpinnerModule,
    PlanificacionBloqueadaComponent,
    PlanificacionConfiguracionWizardComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="planificacion-alumno-shell">
      @if (cargando) {
        <div
          class="flex flex-column align-items-center gap-3 py-6"
          role="status"
        >
          <p-progressSpinner styleClass="w-3rem h-3rem" />
          <span>Cargando tu planificación…</span>
        </div>
      } @else if (error) {
        <div role="alert" aria-live="assertive">
          <p-message severity="warn" [text]="error" />
        </div>
        <button
          pButton
          label="Reintentar"
          (click)="cargar()"
          class="mt-3"
        ></button>
      } @else if (configuracion?.estado === 'BLOQUEADA') {
        <app-planificacion-bloqueada />
      } @else if (editando) {
        <app-planificacion-configuracion-wizard
          [configuracion]="configuracion"
          [modoEdicion]="!!configuracion?.planActual"
          (configurada)="onConfigurada($event)"
          (cancelado)="onCancelado()"
        />
      } @else {
        <div class="planificacion-resumen">
          <h1 class="mt-0">Mi planificación</h1>
          @if (configuracion?.planActual; as plan) {
            <p class="text-600">
              Ya tienes una planificación en curso.
              @if (configuracion?.planificacionManual) {
                Es una planificación personal preparada para ti.
              }
            </p>
            <a
              pButton
              label="Ver mi calendario"
              icon="pi pi-calendar"
              [routerLink]="[
                '/app/planificacion/planificacion-mensual-alumno',
                plan.id,
              ]"
            ></a>
          } @else if ((configuracion?.planesPrevios?.length ?? 0) > 1) {
            <p class="text-600">
              Tienes planificaciones anteriores. Elige una nueva para ver un
              único calendario activo; tu progreso se conservará.
            </p>
            <a
              pButton
              label="Ver planificaciones anteriores"
              icon="pi pi-calendar"
              [routerLink]="['/app/planificacion/planificacion-mensual-alumno']"
            ></a>
          } @else {
            <p class="text-600">Todavía no has elegido una planificación.</p>
          }
          @if (configuracion?.configuracionActiva?.variante; as variante) {
            <p class="text-600">
              {{ getPlanificacionOposicionLabel(variante.oposicion) }} ·
              {{ getNivelOposicionLabel(variante.nivel) }} ·
              {{ getFranjaPlanificacionLabel(variante.franja) }}
            </p>
          }
          <button
            pButton
            [label]="
              configuracion?.planActual
                ? 'Cambiar mi planificación'
                : 'Solicitar planificación'
            "
            icon="pi pi-pencil"
            severity="secondary"
            (click)="editando = true"
          ></button>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .planificacion-alumno-shell {
        max-width: 78rem;
        margin-inline: auto;
        padding: clamp(1rem, 3vw, 2rem);
      }
      .planificacion-resumen {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 1rem;
      }
      .planificacion-resumen p {
        margin: 0;
      }
      @media (max-width: 480px) {
        .planificacion-resumen {
          align-items: stretch;
        }
        :host ::ng-deep .planificacion-resumen .p-button {
          justify-content: center;
          min-height: 44px;
          width: 100%;
        }
      }
    `,
  ],
})
export class PlanificacionAlumnoComponent implements OnInit {
  private readonly autoasignacionService = inject(AutoasignacionService);
  private readonly toast = inject(ToastrService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private modoCambioExplicito =
    this.activatedRoute.snapshot.queryParamMap.get('modo') === 'cambiar';

  readonly getPlanificacionOposicionLabel = getPlanificacionOposicionLabel;
  readonly getNivelOposicionLabel = getNivelOposicionLabel;
  readonly getFranjaPlanificacionLabel = getFranjaPlanificacionLabel;

  cargando = true;
  error: string | null = null;
  configuracion: ConfiguracionPlanificacion | null = null;
  editando = false;

  ngOnInit(): void {
    void this.cargar();
  }

  async cargar(): Promise<void> {
    this.cargando = true;
    this.error = null;
    try {
      this.configuracion = await firstValueFrom(
        this.autoasignacionService.getConfiguracion$(),
      );
      const planActivo =
        this.configuracion.estado === 'ACTIVA' &&
        this.configuracion.planActual?.id;
      if (planActivo && !this.modoCambioExplicito) {
        await this.router.navigate(
          ['/app/planificacion/planificacion-mensual-alumno', planActivo],
          { replaceUrl: true },
        );
        return;
      }
      this.editando =
        this.modoCambioExplicito ||
        (!this.configuracion.planActual &&
          !this.configuracion.planesPrevios?.length);
    } catch {
      this.error = 'No se pudo comprobar tu planificación. Inténtalo de nuevo.';
    } finally {
      this.cargando = false;
      this.cdr.markForCheck();
    }
  }

  onConfigurada(resultado: ResultadoConfiguracion): void {
    this.editando = false;
    this.modoCambioExplicito = false;
    if (resultado === 'EXITO') {
      this.toast.success('Tu planificación está lista');
    } else {
      this.toast.warning(
        'El estado cambió; revisa de nuevo antes de confirmar',
      );
    }
    void this.cargar();
  }

  onCancelado(): void {
    this.editando = false;
    if (
      this.modoCambioExplicito &&
      this.configuracion?.estado === 'ACTIVA' &&
      this.configuracion.planActual?.id
    ) {
      const planId = this.configuracion.planActual.id;
      this.modoCambioExplicito = false;
      void this.router.navigate(
        ['/app/planificacion/planificacion-mensual-alumno', planId],
        { replaceUrl: true },
      );
    }
  }
}
