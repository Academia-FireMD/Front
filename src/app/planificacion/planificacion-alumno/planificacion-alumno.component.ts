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
import { catchError, firstValueFrom, of } from 'rxjs';
import { AutoasignacionService } from '../services/autoasignacion.service';
import { ConfiguracionPlanificacion } from '../models/autoasignacion.model';
import { PlanificacionBloqueadaComponent } from '../planificacion-bloqueada/planificacion-bloqueada.component';
import {
  PlanificacionConfiguracionWizardComponent,
  ResultadoConfiguracion,
} from '../planificacion-configuracion-wizard/planificacion-configuracion-wizard.component';

/**
 * Shell de la ruta de Planificación del alumno. Consulta
 * `GET /planificaciones/configuracion` y muestra, según `estado`:
 *
 * - `BLOQUEADA`   → pantalla de módulo bloqueado + CTA de mejora de tarifa
 * - `REQUIERE_CONFIGURACION` → asistente de configuración
 * - `ACTIVA`      → resumen de la variante vigente + accesos a la vista
 *                   legacy y al asistente en modo edición
 *
 * Sustituye la antigua expulsión a Perfil del `SubscriptionGuard`: el módulo
 * queda visible aunque el alumno no tenga plan activo.
 */
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
        <div class="flex flex-column align-items-center gap-3 py-6">
          <p-progressSpinner styleClass="w-3rem h-3rem" />
          <span class="text-500">Cargando tu planificación…</span>
        </div>
      } @else if (error) {
        <p-message severity="warn" [text]="error"></p-message>
      } @else if (configuracion?.estado === 'BLOQUEADA') {
        <app-planificacion-bloqueada></app-planificacion-bloqueada>
      } @else if (
        configuracion?.estado === 'REQUIERE_CONFIGURACION' &&
        configuracion?.oposicionesPermitidas?.length === 0
      ) {
        <div class="flex flex-column align-items-center gap-3 py-6 text-center">
          <i class="pi pi-clock text-4xl text-orange-500"></i>
          <h2 class="m-0">Tu planificación está pendiente de publicación</h2>
          <p class="text-600 m-0" style="max-width: 42rem">
            Se están preparando variantes compatibles con tu oposición. No
            necesitas completar el cuestionario todavía.
          </p>
        </div>
      } @else if (configuracion?.estado === 'REQUIERE_CONFIGURACION') {
        <app-planificacion-configuracion-wizard
          [configuracion]="configuracion"
          [preferenciasPrecargadas]="
            revisandoPreferencias
              ? (configuracion?.preferenciasPrecargadas ?? null)
              : null
          "
          (configurada)="onConfigurada($event)"
        ></app-planificacion-configuracion-wizard>
      } @else if (configuracion?.estado === 'PENDIENTE_PUBLICACION') {
        @if (editando) {
          <div class="mb-4 text-center">
            <p-message
              severity="info"
              text="Tus preferencias están guardadas. No necesitas repetirlas; puedes revisarlas antes de confirmar el cambio."
              styleClass="w-full"
            ></p-message>
          </div>
          <app-planificacion-configuracion-wizard
            [configuracion]="configuracion"
            [preferenciasPrecargadas]="
              revisandoPreferencias
                ? (configuracion?.preferenciasPrecargadas ?? null)
                : null
            "
            [modoEdicion]="true"
            (configurada)="onConfigurada($event)"
            (cancelado)="cancelarEdicion()"
          ></app-planificacion-configuracion-wizard>
        } @else {
          <div
            class="flex flex-column align-items-center gap-3 py-6 text-center"
          >
            <i class="pi pi-clock text-4xl text-orange-500"></i>
            <h2 class="m-0">Tu planificación está pendiente de publicación</h2>
            <p class="text-600 m-0" style="max-width: 42rem">
              Tus preferencias están guardadas. El equipo de la academia debe
              publicar el plan correspondiente antes de que puedas verlo aquí.
              No necesitas repetir tus datos.
            </p>
            <button
              pButton
              label="Cambiar preferencias"
              icon="pi pi-pencil"
              severity="secondary"
              (click)="editando = true"
            ></button>
          </div>
        }
      } @else if (configuracion?.estado === 'ACTIVA') {
        @if (editando) {
          <app-planificacion-configuracion-wizard
            [configuracion]="configuracion"
            [preferenciasPrecargadas]="
              revisandoPreferencias
                ? (configuracion?.preferenciasPrecargadas ?? null)
                : null
            "
            [modoEdicion]="true"
            (configurada)="onConfigurada($event)"
            (cancelado)="cancelarEdicion()"
          ></app-planificacion-configuracion-wizard>
        } @else {
          <div
            class="flex flex-column align-items-center gap-3 py-6 text-center"
          >
            <i class="pi pi-check-circle text-4xl text-green-500"></i>
            <h2 class="m-0">Tu planificación está activa</h2>
            <p class="text-600 m-0">
              Variante
              <strong>{{
                configuracion?.configuracionActiva?.variante?.codigo
              }}</strong>
              ·
              {{ configuracion?.configuracionActiva?.variante?.nivel }} ·
              {{ configuracion?.configuracionActiva?.variante?.franja }}
            </p>
            <div class="flex gap-2 mt-3">
              <button
                pButton
                label="Ver mi planificación"
                icon="pi pi-calendar"
                [disabled]="!planificacionMensualId"
                [routerLink]="[
                  '/app/planificacion/planificacion-mensual-alumno',
                  planificacionMensualId,
                ]"
              ></button>
              <button
                pButton
                label="Cambiar mi planificación"
                icon="pi pi-pencil"
                severity="secondary"
                (click)="editando = true"
              ></button>
            </div>
          </div>
        }
      }
    </div>
  `,
  styles: [
    `
      .planificacion-alumno-shell {
        padding: 1.5rem;
      }
    `,
  ],
})
export class PlanificacionAlumnoComponent implements OnInit {
  private readonly autoasignacionService = inject(AutoasignacionService);
  private readonly toast = inject(ToastrService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  cargando = true;
  error: string | null = null;
  configuracion: ConfiguracionPlanificacion | null = null;
  editando = false;
  revisandoPreferencias = false;

  get planificacionMensualId(): number | null {
    return (
      this.configuracion?.configuracionActiva?.planificacionMensual?.id ?? null
    );
  }

  ngOnInit(): void {
    // La entrada normal abre directamente el calendario si ya existe un plan.
    // Este query param conserva una ruta explícita y compartible de gestión.
    this.revisandoPreferencias =
      this.route.snapshot.queryParamMap.get('gestionar') === 'preferencias' ||
      this.route.snapshot.queryParamMap.get('revisar') === 'preferencias';
    this.editando = this.revisandoPreferencias;
    this.cargar();
  }

  private async cargar(): Promise<void> {
    this.cargando = true;
    this.error = null;
    try {
      this.configuracion = await firstValueFrom(
        this.autoasignacionService.getConfiguracion$().pipe(
          catchError((err) => {
            this.error =
              'No se pudo comprobar el estado de tu planificación. Inténtalo de nuevo.';
            return of(null as unknown as ConfiguracionPlanificacion);
          }),
        ),
      );
      if (
        this.configuracion?.estado === 'ACTIVA' &&
        this.planificacionMensualId &&
        !this.revisandoPreferencias
      ) {
        void this.router.navigate(
          [
            '/app/planificacion/planificacion-mensual-alumno',
            this.planificacionMensualId,
          ],
          { replaceUrl: true },
        );
      }
    } finally {
      this.cargando = false;
      // OnPush + async/await: sin esto la vista no se re-renderiza al
      // resolver la promesa y el shell se queda en "Cargando…".
      this.cdr.markForCheck();
    }
  }

  /** Tras guardar la configuración el estado pasa a ACTIVA: recargamos. */
  onConfigurada(resultado: ResultadoConfiguracion = 'EXITO'): void {
    if (resultado === 'CONFLICTO') {
      this.toast.warning(
        'La configuración cambió en otro dispositivo. Revisa el mensaje y vuelve a intentarlo.',
      );
      this.cdr.markForCheck();
      return;
    }
    this.editando = false;
    this.revisandoPreferencias = false;
    this.toast.success('Tu planificación se ha activado correctamente');
    void this.cargar();
  }

  cancelarEdicion(): void {
    this.editando = false;
    this.revisandoPreferencias = false;
  }
}
