import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { firstValueFrom } from 'rxjs';
import { NivelOposicion } from '../../shared/models/pregunta.model';
import { Oposicion } from '../../shared/models/subscription.model';
import type { TipoDePlanificacionDeseada } from '../../shared/models/user.model';
import { PlanificacionPreferenciasComponent } from '../../shared/planificacion-preferencias/planificacion-preferencias.component';
import type {
  AlumnoPlanificacionTutor,
  OpcionPlanificacionPermitida,
  PreferenciasPrecargadas,
} from '../models/autoasignacion.model';
import { AutoasignacionService } from '../services/autoasignacion.service';
import {
  esCombinacionPublicada,
  normalizarPreferenciasPlanificacion,
  obtenerOpcionesCascadaPlanificacion,
} from '../planificacion-opciones.util';

/**
 * Panel acotado de tutor dentro de Planificación.
 *
 * El backend limita la colección al tutor autenticado (o al admin) y entrega
 * las opciones permitidas. Este componente no consulta ni abre el dashboard
 * administrativo de usuarios.
 */
@Component({
  selector: 'app-planificacion-tutor',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    DropdownModule,
    InputTextareaModule,
    MessageModule,
    ProgressSpinnerModule,
    PlanificacionPreferenciasComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="planificacion-tutor p-3">
      <header class="mb-4">
        <h2 class="mt-0 mb-2">Panel tutor</h2>
        <p class="text-600 m-0">
          Revisa las preferencias de tus alumnos y solicita cambios con un
          motivo. Solo aparecen los alumnos que el servidor te permite
          gestionar.
        </p>
      </header>

      @if (cargando()) {
        <div class="flex justify-content-center py-6">
          <p-progressSpinner styleClass="w-3rem h-3rem" />
        </div>
      } @else if (error()) {
        <p-message severity="warn" [text]="error()!" />
      } @else if (!alumnos().length) {
        <p-message
          severity="info"
          text="No tienes alumnos de planificación disponibles."
        />
      } @else {
        <div class="flex flex-column gap-4">
          <p-dropdown
            [options]="alumnos()"
            [ngModel]="alumnoSeleccionado()"
            (ngModelChange)="seleccionarAlumno($event)"
            optionLabel="alumno.email"
            placeholder="Selecciona un alumno"
            [showClear]="true"
            styleClass="w-full"
          >
            <ng-template pTemplate="selectedItem" let-item>
              @if (item) {
                <span>{{ nombreAlumno(item) }}</span>
              }
            </ng-template>
            <ng-template pTemplate="item" let-item>
              <div class="flex flex-column">
                <span class="font-medium">{{ nombreAlumno(item) }}</span>
                <small class="text-500">{{ item.alumno.email }}</small>
              </div>
            </ng-template>
          </p-dropdown>

          @if (alumnoSeleccionado(); as alumno) {
            <div class="p-3 border-1 border-round surface-100">
              <div class="flex justify-content-between gap-3 mb-3">
                <div>
                  <h3 class="m-0">{{ nombreAlumno(alumno) }}</h3>
                  <small class="text-500">{{ alumno.alumno.email }}</small>
                </div>
                @if (alumno.configuracion; as activa) {
                  <span class="text-green-600 font-medium">
                    {{ activa.variante.codigo }}
                  </span>
                } @else {
                  <span class="text-500">Sin configuración activa</span>
                }
              </div>

              <app-planificacion-preferencias
                [valoresIniciales]="preferenciasEditadas"
                [oposicionesPermitidas]="opciones.oposiciones"
                [nivelesPermitidos]="opciones.niveles"
                [franjasPermitidas]="opciones.franjas"
                [multiple]="false"
                formIdPrefix="tutorPreferencias"
                (cambios)="onPreferenciasChange($event)"
              />

              @if (preferenciasCompletas && !opcionSeleccionada) {
                <p-message
                  severity="warn"
                  styleClass="w-full mt-3"
                  text="La combinación seleccionada no está permitida para este alumno."
                />
              } @else if (
                preferenciasCompletas &&
                opcionSeleccionada &&
                !opcionSeleccionada.planificacionMensual
              ) {
                <p-message
                  severity="warn"
                  styleClass="w-full mt-3"
                  text="La combinación seleccionada todavía no tiene una planificación mensual publicada."
                />
              }

              @if (alumno.recomendacion; as recomendacion) {
                <p-message
                  severity="info"
                  styleClass="w-full mt-3"
                  [text]="
                    'Recomendación del servidor: ' +
                    recomendacion.nivelRecomendado +
                    ' (puntuación ' +
                    recomendacion.puntuacion +
                    ').'
                  "
                />
              }

              <div class="mt-3">
                <label for="motivoCambioTutor" class="font-medium block mb-2"
                  >Motivo del cambio *</label
                >
                <textarea
                  pInputTextarea
                  id="motivoCambioTutor"
                  [(ngModel)]="motivo"
                  rows="3"
                  class="w-full"
                  placeholder="Explica por qué solicitas este cambio"
                ></textarea>
              </div>

              <div class="flex justify-content-end mt-3">
                <p-button
                  label="Guardar preferencias"
                  icon="pi pi-check"
                  [loading]="guardando()"
                  [disabled]="!puedeGuardar"
                  (onClick)="guardar()"
                />
              </div>
            </div>
          }
        </div>
      }
    </section>
  `,
})
export class PlanificacionTutorComponent implements OnInit {
  private readonly autoasignacionService = inject(AutoasignacionService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly toast = inject(ToastrService);

  readonly alumnos = signal<AlumnoPlanificacionTutor[]>([]);
  readonly alumnoSeleccionado = signal<AlumnoPlanificacionTutor | null>(null);
  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly error = signal<string | null>(null);

  preferenciasEditadas: PreferenciasPrecargadas = {
    oposicion: null,
    nivel: null,
    franja: null,
  };
  motivo = '';

  get opciones(): {
    oposiciones: Oposicion[];
    niveles: NivelOposicion[];
    franjas: TipoDePlanificacionDeseada[];
  } {
    const cascada = obtenerOpcionesCascadaPlanificacion(
      this.alumnoSeleccionado()?.opcionesPermitidas ?? [],
      this.preferenciasEditadas,
    );
    return {
      oposiciones: cascada.oposiciones,
      niveles: cascada.niveles,
      franjas: cascada.franjas,
    };
  }

  get puedeGuardar(): boolean {
    return Boolean(
      this.preferenciasCompletas &&
      this.opcionSeleccionada?.planificacionMensual &&
      this.motivo.trim(),
    );
  }

  get preferenciasCompletas(): boolean {
    return Boolean(
      this.preferenciasEditadas.oposicion &&
      this.preferenciasEditadas.nivel &&
      this.preferenciasEditadas.franja,
    );
  }

  get opcionSeleccionada(): OpcionPlanificacionPermitida | null {
    return obtenerOpcionesCascadaPlanificacion(
      this.alumnoSeleccionado()?.opcionesPermitidas ?? [],
      this.preferenciasEditadas,
    ).seleccionada;
  }

  get combinacionPublicada(): boolean {
    return esCombinacionPublicada(this.opcionSeleccionada);
  }

  ngOnInit(): void {
    void this.cargar();
  }

  nombreAlumno(alumno: AlumnoPlanificacionTutor): string {
    const nombre =
      `${alumno.alumno.nombre ?? ''} ${alumno.alumno.apellidos ?? ''}`.trim();
    return nombre || alumno.alumno.email;
  }

  seleccionarAlumno(alumno: AlumnoPlanificacionTutor | null): void {
    this.alumnoSeleccionado.set(alumno);
    this.motivo = '';
    this.preferenciasEditadas = normalizarPreferenciasPlanificacion(
      alumno?.opcionesPermitidas ?? [],
      this.preferenciasIniciales(alumno),
    );
    this.cdr.markForCheck();
  }

  onPreferenciasChange(preferencias: {
    oposicion: Oposicion | Oposicion[] | null;
    nivel: string | null;
    franja: string | null;
  }): void {
    this.preferenciasEditadas = normalizarPreferenciasPlanificacion(
      this.alumnoSeleccionado()?.opcionesPermitidas ?? [],
      {
        oposicion: Array.isArray(preferencias.oposicion)
          ? (preferencias.oposicion[0] ?? null)
          : preferencias.oposicion,
        nivel: preferencias.nivel as NivelOposicion | null,
        franja: preferencias.franja as TipoDePlanificacionDeseada | null,
      },
    );
    this.cdr.markForCheck();
  }

  async guardar(): Promise<void> {
    const alumno = this.alumnoSeleccionado();
    if (!alumno || !this.puedeGuardar) return;

    this.guardando.set(true);
    try {
      await firstValueFrom(
        this.autoasignacionService.forzarConfiguracionTutor$(alumno.alumno.id, {
          oposicion: this.preferenciasEditadas.oposicion as Oposicion,
          nivel: this.preferenciasEditadas.nivel as NivelOposicion,
          franja: this.preferenciasEditadas
            .franja as TipoDePlanificacionDeseada,
          motivo: this.motivo.trim(),
        }),
      );
      await this.cargar(alumno.alumno.id);
    } catch {
      this.error.set('No se pudieron guardar las preferencias del alumno.');
      this.toast.error('No se pudieron guardar las preferencias del alumno.');
    } finally {
      this.guardando.set(false);
      this.cdr.markForCheck();
    }
  }

  private async cargar(alumnoId?: number): Promise<void> {
    this.cargando.set(true);
    this.error.set(null);
    try {
      const alumnos = await firstValueFrom(
        this.autoasignacionService.getTutorAlumnos$(),
      );
      this.alumnos.set(alumnos ?? []);
      const seleccionado =
        (alumnoId != null
          ? alumnos?.find((item) => item.alumno.id === alumnoId)
          : undefined) ??
        alumnos?.[0] ??
        null;
      this.seleccionarAlumno(seleccionado);
    } catch {
      this.error.set('No se pudieron cargar los alumnos de planificación.');
    } finally {
      this.cargando.set(false);
      this.cdr.markForCheck();
    }
  }

  private preferenciasIniciales(
    alumno: AlumnoPlanificacionTutor | null,
  ): PreferenciasPrecargadas {
    const configuracionActiva = alumno?.configuracion?.variante;
    const preferencias = alumno?.preferencias;
    return {
      oposicion:
        configuracionActiva?.oposicion ?? preferencias?.oposicion ?? null,
      nivel: configuracionActiva?.nivel ?? preferencias?.nivel ?? null,
      franja: configuracionActiva?.franja ?? preferencias?.franja ?? null,
    };
  }
}
