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
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { InputSwitchModule } from 'primeng/inputswitch';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TableModule } from 'primeng/table';
import { TabViewModule } from 'primeng/tabview';
import { firstValueFrom } from 'rxjs';
import { NivelOposicion } from '../../shared/models/pregunta.model';
import {
  Oposicion,
  OPOSICION_LABELS,
} from '../../shared/models/subscription.model';
import type { TipoDePlanificacionDeseada } from '../../shared/models/user.model';
import {
  AlumnoSinCoincidencia,
  ReglaOposicionAdmin,
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
})
export class PlanificacionAdminComponent implements OnInit {
  private readonly autoasignacionService = inject(AutoasignacionService);
  private readonly toast = inject(ToastrService);
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
  cargando = signal(false);

  varianteForm = this.fb.group({
    id: [null as number | null],
    codigo: ['', Validators.required],
    oposicion: [Oposicion.GENERAL as Oposicion, Validators.required],
    nivel: [NivelOposicion.INICIACION as NivelOposicion, Validators.required],
    franja: ['FRANJA_CUATRO_A_SEIS_HORAS', Validators.required],
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
    this.cargarTodo();
  }

  async cargarTodo(): Promise<void> {
    this.cargando.set(true);
    try {
      const [variantes, reglas, sinCoincidencia] = await Promise.all([
        firstValueFrom(this.autoasignacionService.getVariantes$()),
        firstValueFrom(this.autoasignacionService.getReglas$()),
        firstValueFrom(this.autoasignacionService.getSinCoincidencia$()),
      ]);
      this.variantes.set(variantes ?? []);
      this.reglas.set(reglas ?? []);
      this.sinCoincidencia.set(sinCoincidencia ?? []);
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
      activa: v.activa,
    });
  }

  nuevaVariante(): void {
    this.varianteForm.reset({
      id: null,
      codigo: '',
      oposicion: Oposicion.GENERAL,
      nivel: NivelOposicion.INICIACION,
      franja: 'FRANJA_CUATRO_A_SEIS_HORAS',
      activa: true,
    });
  }

  async guardarVariante(): Promise<void> {
    if (this.varianteForm.invalid) {
      this.toast.error('Revisa los campos de la variante');
      return;
    }
    const v = this.varianteForm.value;
    try {
      if (v.id) {
        await firstValueFrom(
          this.autoasignacionService.actualizarVariante$(v.id, {
            codigo: v.codigo ?? '',
            oposicion: v.oposicion as Oposicion,
            nivel: v.nivel as NivelOposicion,
            franja: v.franja as TipoDePlanificacionDeseada,
            activa: !!v.activa,
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

  editarRegla(r: ReglaOposicionAdmin): void {
    this.reglaForm.patchValue({
      id: r.id ?? null,
      oposicionSuscripcion: r.oposicionSuscripcion,
      oposicionPlanificacion: r.oposicionPlanificacion,
      activa: r.activa,
    });
  }

  nuevaRegla(): void {
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
    const r = this.reglaForm.value;
    try {
      if (r.id) {
        await firstValueFrom(
          this.autoasignacionService.actualizarRegla$(r.id, {
            oposicionSuscripcion: r.oposicionSuscripcion as Oposicion,
            oposicionPlanificacion: r.oposicionPlanificacion as Oposicion,
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
        }),
      );
      this.toast.success('Variante actualizada');
      await this.cargarTodo();
    } catch {
      this.toast.error('No se pudo actualizar la variante');
    }
  }
}
