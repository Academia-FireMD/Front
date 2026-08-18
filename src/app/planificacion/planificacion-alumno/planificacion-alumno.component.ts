import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { catchError, firstValueFrom, of } from 'rxjs';
import { AutoasignacionService } from '../services/autoasignacion.service';
import { ConfiguracionPlanificacion } from '../models/autoasignacion.model';
import { PlanificacionBloqueadaComponent } from '../planificacion-bloqueada/planificacion-bloqueada.component';
import { PlanificacionConfiguracionWizardComponent } from '../planificacion-configuracion-wizard/planificacion-configuracion-wizard.component';

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
      } @else if (configuracion?.estado === 'REQUIERE_CONFIGURACION') {
        <app-planificacion-configuracion-wizard
          [configuracion]="configuracion"
          (configurada)="onConfigurada()"
        ></app-planificacion-configuracion-wizard>
      } @else if (configuracion?.estado === 'ACTIVA') {
        @if (editando) {
          <app-planificacion-configuracion-wizard
            [configuracion]="configuracion"
            [modoEdicion]="true"
            (configurada)="onConfigurada()"
            (cancelado)="editando = false"
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
                [routerLink]="[
                  '/app/planificacion/planificacion-mensual-alumno',
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

  cargando = true;
  error: string | null = null;
  configuracion: ConfiguracionPlanificacion | null = null;
  editando = false;

  ngOnInit(): void {
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
    } finally {
      this.cargando = false;
    }
  }

  /** Tras guardar la configuración el estado pasa a ACTIVA: recargamos. */
  onConfigurada(): void {
    this.editando = false;
    this.toast.success('Tu planificación se ha activado correctamente');
    void this.cargar();
  }
}
