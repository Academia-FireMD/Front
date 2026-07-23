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
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CalendarModule } from 'primeng/calendar';
import { CardModule } from 'primeng/card';
import { ConfirmationService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { TooltipModule } from 'primeng/tooltip';
import { ToastrService } from 'ngx-toastr';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AsyncButtonComponent } from '../../shared/components/async-button/async-button.component';
import {
  AccesoDenegadoPlanFisica,
  CrearMarcaDto,
  DisciplinaCatalogo,
  GrupoDisciplina,
  MarcaPersonal,
  PlanificacionFisicaService,
} from '../services/planificacion-fisica.service';

/** Opción del selector de prueba, derivada del catálogo global (`GET /disciplinas`). */
interface DisciplinaOpcion {
  disciplinaId: number;
  nombre: string;
  grupo: GrupoDisciplina;
  color: string;
}

/** Un grupo de marcas de la misma disciplina, para pintar el histórico agrupado. */
interface GrupoMarcas {
  disciplinaId: number;
  disciplinaNombre: string;
  grupo: GrupoDisciplina;
  color: string;
  marcas: MarcaPersonal[];
}

/**
 * Histórico de marcas personales del alumno en pruebas físicas (Fase 2 del
 * EPIC de planificación física): a diferencia del calendario de
 * `planificacion-fisica-calendario.component` (progreso sobre el PLAN del
 * entrenador), esto es un registro libre de resultados propios (mejor
 * tiempo, repeticiones...) que el alumno lleva por su cuenta.
 *
 * Selector de prueba: se puebla desde `GET /planificacion-fisica/disciplinas`
 * (catálogo GLOBAL de pruebas). Antes se deducía de las disciplinas de las
 * propias marcas del alumno (`GET /marcas`) más las de su plan vigente
 * (`GET /mi-plan`, best-effort) — eso dejaba el selector VACÍO para un
 * alumno sin plan asignado ni marcas previas, justo cuando necesita añadir
 * su PRIMERA marca (bug de review). El catálogo no depende de alumnoId ni
 * de plan/marcas, así que siempre hay opciones.
 */
@Component({
  selector: 'app-planificacion-fisica-marcas',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    CalendarModule,
    CardModule,
    ConfirmDialogModule,
    DropdownModule,
    InputNumberModule,
    InputTextModule,
    TooltipModule,
    AsyncButtonComponent,
  ],
  templateUrl: './planificacion-fisica-marcas.component.html',
  styleUrl: './planificacion-fisica-marcas.component.scss',
})
export class PlanificacionFisicaMarcasComponent implements OnInit {
  private svc = inject(PlanificacionFisicaService);
  private toast = inject(ToastrService);
  private confirmationService = inject(ConfirmationService);
  private router = inject(Router);
  private fb = inject(FormBuilder);

  protected loading = signal(false);
  /** Distingue "aún no ha respondido" de "respondió y no hay marcas" (array vacío real). */
  protected cargado = signal(false);
  protected marcas = signal<MarcaPersonal[]>([]);
  protected gated = signal<AccesoDenegadoPlanFisica | null>(null);
  /**
   * Fallo genérico (500, red caída) al cargar, distinto de "sin marcas
   * aún" y de "gated" — si no se distingue, la vista mentiría al alumno
   * mostrando "no tienes marcas" cuando en realidad hubo un error (mismo
   * criterio que `planificacion-fisica-calendario.component`).
   */
  protected error = signal(false);

  /** `disciplinaId` de la marca cuyo DELETE está en vuelo, para deshabilitar solo ESE botón. */
  protected borrandoIds = signal<ReadonlySet<number>>(new Set());

  protected readonly sinMarcas = computed(
    () =>
      this.cargado() &&
      !this.gated() &&
      !this.error() &&
      this.marcas().length === 0,
  );

  protected readonly grupos = computed<GrupoMarcas[]>(() => {
    const porDisciplina = new Map<number, GrupoMarcas>();
    for (const marca of this.marcas()) {
      const existente = porDisciplina.get(marca.disciplinaId);
      if (existente) {
        existente.marcas.push(marca);
      } else {
        porDisciplina.set(marca.disciplinaId, {
          disciplinaId: marca.disciplinaId,
          disciplinaNombre: marca.disciplinaNombre,
          grupo: marca.grupo,
          color: marca.color,
          marcas: [marca],
        });
      }
    }
    // El backend ya ordena `disciplinaId asc, fecha desc`; Map conserva el
    // orden de inserción, así que no hace falta reordenar aquí.
    return Array.from(porDisciplina.values());
  });

  /** Catálogo global de pruebas (`GET /disciplinas`), fuente única del selector. */
  protected catalogo = signal<DisciplinaCatalogo[]>([]);

  /** Opciones del desplegable "prueba", derivadas del catálogo global. */
  protected readonly discOpciones = computed<DisciplinaOpcion[]>(() =>
    this.catalogo()
      .map((d) => ({
        disciplinaId: d.id,
        nombre: d.nombre,
        grupo: d.grupo,
        color: d.color,
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre)),
  );

  protected readonly form = this.fb.nonNullable.group({
    disciplinaId: this.fb.control<number | null>(null, Validators.required),
    valor: this.fb.control<number | null>(null, [
      Validators.required,
      Validators.min(0.01),
    ]),
    unidad: ['', Validators.required],
    fecha: this.fb.control<Date | null>(null, Validators.required),
    notas: [''],
  });

  protected readonly hoy = new Date();

  /** Unidades sugeridas por grupo de disciplina, para autocompletar. */
  private readonly unidadesPorGrupo: Record<string, string> = {
    CUERDA: 'min',
    CARRERA: 'min',
    NATACION: 'min',
    PRESS: 'reps',
    FUERZA: 'reps',
    ESCALERAS: 'min',
    DESCANSO: '',
    TEST: 'puntos',
  };

  /** Cuando cambia la disciplina, sugiere la unidad típica de su grupo. */
  protected onDisciplinaChange(disciplinaId: number): void {
    const disciplina = this.catalogo().find((d) => d.id === disciplinaId);
    if (disciplina && !this.form.get('unidad')?.value) {
      this.form
        .get('unidad')
        ?.setValue(this.unidadesPorGrupo[disciplina.grupo] ?? '');
    }
  }

  async ngOnInit(): Promise<void> {
    await this.cargar();
  }

  private async cargar(): Promise<void> {
    this.loading.set(true);
    this.gated.set(null);
    this.error.set(false);
    try {
      // Ambas llamadas son independientes — se lanzan en paralelo (mismo
      // patrón que `planificacion-fisica-dia.component.ts`). A diferencia
      // del antiguo `miPlan()` best-effort, el catálogo NO es opcional: es
      // la fuente del selector de prueba, así que si falla se trata igual
      // que un fallo al cargar las marcas (gated/error), nunca en silencio.
      const [marcas, catalogo] = await Promise.all([
        firstValueFrom(this.svc.marcas()),
        firstValueFrom(this.svc.catalogoDisciplinas()),
      ]);
      this.marcas.set(marcas);
      this.catalogo.set(catalogo);
    } catch (err) {
      const httpErr = err as HttpErrorResponse;
      const body = httpErr?.error as AccesoDenegadoPlanFisica | undefined;
      if (httpErr?.status === 403 && body?.reason === 'TIER_TOO_LOW') {
        this.gated.set(body);
      } else {
        this.error.set(true);
        this.toast.error('No se ha podido cargar tu histórico de marcas.');
      }
    } finally {
      this.loading.set(false);
      this.cargado.set(true);
    }
  }

  /** Botón "Reintentar" del estado de error. */
  protected reintentar(): void {
    void this.cargar();
  }

  /** Acción del `<app-async-button>` de "Añadir marca". */
  protected guardarMarca = async (): Promise<void> => {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const valores = this.form.getRawValue();
    const dto: CrearMarcaDto = {
      disciplinaId: valores.disciplinaId!,
      valor: valores.valor!,
      unidad: valores.unidad,
      fecha: this.formatearFechaISO(valores.fecha!),
      ...(valores.notas ? { notas: valores.notas } : {}),
    };
    try {
      await firstValueFrom(this.svc.crearMarca(dto));
      this.toast.success('Marca añadida.');
      this.form.reset();
      await this.cargar();
    } catch (err) {
      const httpErr = err as HttpErrorResponse;
      this.toast.error(
        this.extraerMensajeError(httpErr) ??
          'No se ha podido guardar la marca.',
      );
    }
  };

  protected confirmarBorrarMarca(marca: MarcaPersonal, event: Event): void {
    this.confirmationService.confirm({
      key: 'pf-marcas-borrar',
      target: event.target as EventTarget,
      message: `Vas a eliminar esta marca de "${marca.disciplinaNombre}" (${marca.valor} ${marca.unidad}, ${marca.fecha}). ¿Estás seguro?`,
      header: 'Confirmación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí',
      rejectLabel: 'No',
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-text',
      accept: () => this.borrarMarca(marca),
    });
  }

  private async borrarMarca(marca: MarcaPersonal): Promise<void> {
    this.borrandoIds.update((ids) => new Set(ids).add(marca.id));
    try {
      await firstValueFrom(this.svc.borrarMarca(marca.id));
      this.toast.success('Marca eliminada.');
      await this.cargar();
    } catch (err) {
      this.toast.error(
        this.extraerMensajeError(err as HttpErrorResponse) ??
          'No se ha podido eliminar la marca.',
      );
    } finally {
      this.borrandoIds.update((ids) => {
        const next = new Set(ids);
        next.delete(marca.id);
        return next;
      });
    }
  }

  protected estaBorrando(id: number): boolean {
    return this.borrandoIds().has(id);
  }

  protected volver(): void {
    this.router.navigate(['/app/planificacion-fisica']);
  }

  /** Mismo CTA que `ai-assistant-widget`/`planificacion-fisica-calendario`: abre la tienda WooCommerce. */
  protected mejorarSuscripcion(): void {
    window.open(environment.wooCommerceUrl, '_blank');
  }

  private formatearFechaISO(fecha: Date): string {
    const y = fecha.getFullYear();
    const m = `${fecha.getMonth() + 1}`.padStart(2, '0');
    const d = `${fecha.getDate()}`.padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private extraerMensajeError(
    err: HttpErrorResponse | undefined,
  ): string | null {
    const body = err?.error as { message?: string } | undefined;
    return body?.message ?? null;
  }
}
