import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import {
  FormBuilder,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { ConfirmationService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputSwitchModule } from 'primeng/inputswitch';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TableModule } from 'primeng/table';
import { TabViewModule } from 'primeng/tabview';
import { firstValueFrom } from 'rxjs';
import { PlanificacionesService } from '../../services/planificaciones.service';
import { NivelOposicion } from '../../shared/models/pregunta.model';
import {
  Oposicion,
  OPOSICION_LABELS,
} from '../../shared/models/subscription.model';
import type { TipoDePlanificacionDeseada } from '../../shared/models/user.model';
import type { PlanificacionMensual } from '../../shared/models/planificacion.model';
import {
  AlumnoSinCoincidencia,
  ReglaOposicionAdmin,
  ReconciliacionPlanificaciones,
  VarianteAdmin,
} from '../models/autoasignacion.model';
import { AutoasignacionService } from '../services/autoasignacion.service';

@Component({
  selector: 'app-planificacion-admin',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ButtonModule,
    ConfirmDialogModule,
    DropdownModule,
    InputSwitchModule,
    InputTextModule,
    MessageModule,
    ProgressSpinnerModule,
    TableModule,
    TabViewModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './planificacion-admin.component.html',
  styleUrl: './planificacion-admin.component.scss',
})
export class PlanificacionAdminComponent implements OnInit {
  private readonly autoasignacionService = inject(AutoasignacionService);
  private readonly planificacionesService = inject(PlanificacionesService);
  private readonly toast = inject(ToastrService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly fb = inject(FormBuilder);

  readonly NivelOposicion = NivelOposicion;
  readonly OPOSICION_LABELS = OPOSICION_LABELS;

  labelOposicion(op: Oposicion | string | null | undefined): string {
    return OPOSICION_LABELS[op as Oposicion] ?? (op as string) ?? '';
  }

  oposicionOptions = Object.values(Oposicion).map((o) => ({
    label: OPOSICION_LABELS[o] ?? o,
    value: o,
  }));
  nivelOptions = [
    { label: 'Iniciación', value: NivelOposicion.INICIACION },
    { label: 'Avanzado', value: NivelOposicion.AVANZADO },
  ];
  franjaOptions = [
    { label: '4-6 horas', value: 'FRANJA_CUATRO_A_SEIS_HORAS' },
    { label: '6-8 horas', value: 'FRANJA_SEIS_A_OCHO_HORAS' },
  ];

  variantes = signal<VarianteAdmin[]>([]);
  reglas = signal<ReglaOposicionAdmin[]>([]);
  sinCoincidencia = signal<AlumnoSinCoincidencia[]>([]);
  planificacionesMensuales = signal<PlanificacionMensual[]>([]);
  reconciliacion = signal<ReconciliacionPlanificaciones | null>(null);
  reconciliando = signal(false);
  cargando = signal(false);
  error = signal<string | null>(null);

  varianteForm = this.fb.group({
    id: [null as number | null],
    codigo: ['', Validators.required],
    oposicion: [Oposicion.GENERAL as Oposicion, Validators.required],
    nivel: [NivelOposicion.INICIACION as NivelOposicion, Validators.required],
    franja: ['FRANJA_CUATRO_A_SEIS_HORAS', Validators.required],
    planificacionMensualId: [null as number | null],
    activa: [true],
  });

  reglaForm = this.fb.group({
    id: [null as number | null],
    oposicionSuscripcion: [Oposicion.GENERAL as Oposicion, Validators.required],
    oposicionPlanificacion: [
      Oposicion.GENERAL as Oposicion,
      Validators.required,
    ],
    activa: [true],
  });

  ngOnInit(): void {
    this.varianteForm.valueChanges.subscribe(() =>
      this.limpiarPlanificacionIncompatible(),
    );
    this.cargarTodo();
  }

  async cargarTodo(): Promise<void> {
    this.cargando.set(true);
    try {
      const [variantes, reglas, sinCoincidencia, planificaciones] =
        await Promise.all([
          firstValueFrom(this.autoasignacionService.getVariantes$()),
          firstValueFrom(this.autoasignacionService.getReglas$()),
          firstValueFrom(this.autoasignacionService.getSinCoincidencia$()),
          firstValueFrom(
            this.planificacionesService.getPlanificacionMensual$({
              take: 9999,
              skip: 0,
              searchTerm: '',
            }),
          ),
        ]);
      this.variantes.set(variantes ?? []);
      this.reglas.set(reglas ?? []);
      this.sinCoincidencia.set(sinCoincidencia ?? []);
      this.planificacionesMensuales.set(planificaciones?.data ?? []);
      this.limpiarPlanificacionIncompatible();
    } catch {
      this.toast.error('No se pudieron cargar los datos de administración');
    } finally {
      this.cargando.set(false);
    }
  }

  editarVariante(v: VarianteAdmin): void {
    this.varianteForm.patchValue({
      id: v.id ?? null,
      codigo: v.codigo,
      oposicion: v.oposicion,
      nivel: v.nivel,
      franja: v.franja,
      planificacionMensualId:
        v.planificacionMensualId ?? v.planificacionMensual?.id ?? null,
      activa: v.activa,
    });
    // La identidad de una variante se usa para resolver configuraciones e
    // historial. Solo el estado y el mapping canónico son editables después
    // de crearla.
    this.varianteForm.controls.codigo.disable({ emitEvent: false });
    this.varianteForm.controls.oposicion.disable({ emitEvent: false });
    this.varianteForm.controls.nivel.disable({ emitEvent: false });
    this.varianteForm.controls.franja.disable({ emitEvent: false });
  }

  nuevaVariante(): void {
    this.varianteForm.controls.codigo.enable({ emitEvent: false });
    this.varianteForm.controls.oposicion.enable({ emitEvent: false });
    this.varianteForm.controls.nivel.enable({ emitEvent: false });
    this.varianteForm.controls.franja.enable({ emitEvent: false });
    this.varianteForm.reset({
      id: null,
      codigo: '',
      oposicion: Oposicion.GENERAL,
      nivel: NivelOposicion.INICIACION,
      franja: 'FRANJA_CUATRO_A_SEIS_HORAS',
      planificacionMensualId: null,
      activa: true,
    });
  }

  async guardarVariante(): Promise<void> {
    if (this.varianteForm.invalid) {
      this.toast.error('Revisa los campos de la variante');
      return;
    }
    const v = this.varianteForm.getRawValue();
    if (this.esPlanSeleccionadoBorrador) {
      this.toast.error(
        v.id
          ? 'Usa “Publicar y asignar” para una planificación en borrador.'
          : 'Crea primero la variante sin plan y después publica el borrador desde su edición.',
      );
      return;
    }
    try {
      if (v.id) {
        await firstValueFrom(
          this.autoasignacionService.actualizarVariante$(v.id, {
            activa: !!v.activa,
            planificacionMensualId: v.planificacionMensualId ?? null,
          }),
        );
        this.toast.success('Variante actualizada');
      } else {
        await firstValueFrom(
          this.autoasignacionService.crearVariante$({
            codigo: v.codigo ?? '',
            oposicion: v.oposicion as Oposicion,
            nivel: v.nivel as NivelOposicion,
            franja: v.franja as TipoDePlanificacionDeseada,
            planificacionMensualId: v.planificacionMensualId ?? null,
            activa: !!v.activa,
          }),
        );
        this.toast.success('Variante creada');
      }
      this.nuevaVariante();
      await this.cargarTodo();
    } catch {
      this.toast.error('No se pudo guardar la variante');
    }
  }

  publicarPlanSeleccionado(): void {
    const varianteId = this.varianteForm.controls.id.value;
    const planificacion = this.planSeleccionado;
    if (!varianteId || !planificacion || planificacion.estado !== 'BORRADOR') {
      this.toast.error(
        'Selecciona una variante y una planificación en borrador',
      );
      return;
    }
    this.confirmationService.confirm({
      header: 'Publicar planificación',
      message:
        'Se validará estudio y física, se publicará la release y se asignará a la variante. Los alumnos actuales conservarán su release anterior.',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Publicar y asignar',
      rejectLabel: 'Cancelar',
      accept: async () => {
        try {
          await firstValueFrom(
            this.autoasignacionService.publicarVariante$(
              varianteId,
              planificacion.id,
            ),
          );
          this.toast.success('Planificación publicada y asignada');
          this.nuevaVariante();
          await this.cargarTodo();
        } catch {
          this.toast.error(
            'No se pudo publicar. Revisa la cobertura de estudio y física.',
          );
        }
      },
    });
  }

  editarRegla(r: ReglaOposicionAdmin): void {
    this.reglaForm.patchValue({
      id: r.id ?? null,
      oposicionSuscripcion: r.oposicionSuscripcion,
      oposicionPlanificacion: r.oposicionPlanificacion,
      activa: r.activa,
    });
    // La pareja de oposiciones identifica la regla histórica; solo su estado
    // puede cambiar después de crearla.
    this.reglaForm.controls.oposicionSuscripcion.disable({ emitEvent: false });
    this.reglaForm.controls.oposicionPlanificacion.disable({
      emitEvent: false,
    });
  }

  nuevaRegla(): void {
    this.reglaForm.controls.oposicionSuscripcion.enable({ emitEvent: false });
    this.reglaForm.controls.oposicionPlanificacion.enable({ emitEvent: false });
    this.reglaForm.reset({
      id: null,
      oposicionSuscripcion: Oposicion.GENERAL,
      oposicionPlanificacion: Oposicion.GENERAL,
      activa: true,
    });
  }

  async guardarRegla(): Promise<void> {
    if (this.reglaForm.invalid) {
      this.toast.error('Revisa los campos de la regla');
      return;
    }
    const r = this.reglaForm.getRawValue();
    try {
      if (r.id) {
        await firstValueFrom(
          this.autoasignacionService.actualizarRegla$(r.id, {
            activa: !!r.activa,
          }),
        );
        this.toast.success('Regla actualizada');
      } else {
        await firstValueFrom(
          this.autoasignacionService.crearRegla$({
            oposicionSuscripcion: r.oposicionSuscripcion as Oposicion,
            oposicionPlanificacion: r.oposicionPlanificacion as Oposicion,
            activa: !!r.activa,
          }),
        );
        this.toast.success('Regla creada');
      }
      this.nuevaRegla();
      await this.cargarTodo();
    } catch {
      this.toast.error('No se pudo guardar la regla');
    }
  }

  /** Toggle rápido de activa/inactiva desde la tabla. */
  async actualizarVarianteActiva(v: VarianteAdmin): Promise<void> {
    if (!v.id) return;
    try {
      await firstValueFrom(
        this.autoasignacionService.actualizarVariante$(v.id, {
          activa: !v.activa,
          planificacionMensualId:
            v.planificacionMensualId ?? v.planificacionMensual?.id ?? null,
        }),
      );
      this.toast.success('Variante actualizada');
      await this.cargarTodo();
    } catch {
      this.toast.error('No se pudo actualizar la variante');
    }
  }

  get planificacionOptions(): {
    label: string;
    value: number;
    estado: string;
  }[] {
    const varianteId = this.varianteForm.controls.id.value;
    const planesMapeadosEnOtraVariante = new Set(
      this.variantes()
        .filter((variante) => variante.id !== varianteId)
        .map(
          (variante) =>
            variante.planificacionMensualId ??
            variante.planificacionMensual?.id ??
            null,
        )
        .filter((id): id is number => id !== null),
    );
    const oposicion = this.varianteForm.controls.oposicion
      .value as Oposicion | null;
    const franja = this.varianteForm.controls.franja
      .value as TipoDePlanificacionDeseada | null;
    return this.planificacionesMensuales()
      .filter(
        (planificacion) =>
          !planesMapeadosEnOtraVariante.has(planificacion.id) &&
          (!franja || planificacion.tipoDePlanificacion === franja) &&
          (!oposicion || planificacion.relevancia?.includes(oposicion)),
      )
      .map((planificacion) => ({
        label: `${planificacion.identificador} v${planificacion.version ?? 1} · ${planificacion.estado ?? 'BORRADOR'} (${planificacion.mes}/${planificacion.ano})`,
        value: planificacion.id,
        estado: planificacion.estado ?? 'BORRADOR',
      }));
  }

  get planSeleccionado(): PlanificacionMensual | null {
    const id = this.varianteForm.controls.planificacionMensualId.value;
    return (
      this.planificacionesMensuales().find((plan) => plan.id === id) ?? null
    );
  }

  get esPlanSeleccionadoBorrador(): boolean {
    return this.planSeleccionado?.estado === 'BORRADOR';
  }

  private limpiarPlanificacionIncompatible(): void {
    const planificacionId =
      this.varianteForm.controls.planificacionMensualId.value;
    if (
      planificacionId != null &&
      !this.planificacionOptions.some(
        (option) => option.value === planificacionId,
      )
    ) {
      this.varianteForm.controls.planificacionMensualId.setValue(null, {
        emitEvent: false,
      });
    }
  }

  async previsualizarReconciliacion(): Promise<void> {
    await this.ejecutarReconciliacion(false);
  }

  async aplicarReconciliacion(): Promise<void> {
    const preview = this.reconciliacion();
    if (preview?.aplicar !== false || !preview.previewHash) {
      this.toast.error('Previsualiza la reconciliación antes de aplicarla');
      return;
    }
    this.confirmationService.confirm({
      message:
        'La reconciliación aplicará configuraciones a los alumnos elegibles. ¿Continuar?',
      header: 'Aplicar reconciliación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Aplicar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.ejecutarReconciliacion(true),
      reject: () => {},
    });
  }

  private async ejecutarReconciliacion(aplicar: boolean): Promise<void> {
    this.reconciliando.set(true);
    this.error.set(null);
    try {
      const resumen = await firstValueFrom(
        this.autoasignacionService.reconciliar$(
          aplicar,
          aplicar ? this.reconciliacion()?.previewHash : null,
        ),
      );
      if (aplicar && !resumen.aplicar) {
        this.reconciliacion.set(null);
        throw new Error(
          'La previsualización ya no es válida; vuelve a calcularla antes de aplicar.',
        );
      }
      this.reconciliacion.set(resumen);
      if (aplicar) {
        const diagnosticoActual = await firstValueFrom(
          this.autoasignacionService.getSinCoincidencia$(),
        );
        this.sinCoincidencia.set(diagnosticoActual ?? []);
      }
      this.toast.success(
        aplicar
          ? 'Reconciliación aplicada'
          : 'Previsualización de reconciliación calculada',
      );
    } catch {
      const mensaje = aplicar
        ? 'No se pudo aplicar la reconciliación. La previsualización puede haber cambiado; vuelve a calcularla.'
        : 'No se pudo ejecutar la previsualización de reconciliación';
      this.error.set(mensaje);
      this.toast.error(mensaje);
      if (aplicar) this.reconciliacion.set(null);
    } finally {
      this.reconciliando.set(false);
    }
  }

  motivoDiagnostico(motivo: AlumnoSinCoincidencia['motivo']): string {
    const labels: Record<AlumnoSinCoincidencia['motivo'], string> = {
      SIN_CONFIGURACION: 'Sin configuración',
      PREFERENCIAS_INCOMPLETAS: 'Preferencias incompletas',
      SIN_VARIANTE: 'Sin variante compatible',
      VARIANTE_INACTIVA: 'Variante inactiva',
      SIN_PLANIFICACION_PUBLICADA: 'Sin planificación publicada',
      OPOSICION_NO_PERMITIDA: 'Oposición no permitida',
      SIN_ASIGNACION: 'Sin asignación',
      PROGRESO_INCOMPLETO: 'Progreso incompleto',
    };
    return labels[motivo] ?? motivo;
  }
}
