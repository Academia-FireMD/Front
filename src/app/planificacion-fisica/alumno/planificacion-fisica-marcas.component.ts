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
import { toSignal } from '@angular/core/rxjs-interop';
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
  PruebaFisicaCatalogo,
  GrupoDisciplina,
  MarcaPersonal,
  PlanificacionFisicaService,
} from '../services/planificacion-fisica.service';

const PRUEBA_OTRA_ID = -1;

/** Opción del selector de prueba oficial filtrado por oposición (`GET /pruebas`). */
interface PruebaOpcion {
  pruebaFisicaId: number;
  nombre: string;
  grupo: GrupoDisciplina | null;
  color: string | null;
  /** Entrada centinela "Otra prueba…". */
  esOtra: boolean;
}

/** Un grupo de marcas de la misma disciplina, para pintar el histórico agrupado. */
interface GrupoMarcas {
  /** Id de prueba o identificador textual para marcas libres. */
  pruebaFisicaId: number | string;
  pruebaNombre: string;
  grupo: GrupoDisciplina | null;
  color: string | null;
  marcas: MarcaPersonal[];
}

/**
 * Histórico de marcas personales del alumno en pruebas físicas (Fase 2 del
 * EPIC de planificación física): a diferencia del calendario de
 * `planificacion-fisica-calendario.component` (progreso sobre el PLAN del
 * entrenador), esto es un registro libre de resultados propios (mejor
 * tiempo, repeticiones...) que el alumno lleva por su cuenta.
 *
 * Selector de prueba: se puebla desde `GET /planificacion-fisica/pruebas`
 * (catálogo de pruebas filtrado por oposición). Antes se deducía de las disciplinas de las
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

  /** Id de la marca cuyo DELETE está en vuelo, para deshabilitar solo ESE botón. */
  protected borrandoIds = signal<ReadonlySet<number>>(new Set());

  protected readonly sinMarcas = computed(
    () =>
      this.cargado() &&
      !this.gated() &&
      !this.error() &&
      this.marcas().length === 0,
  );

  protected readonly grupos = computed<GrupoMarcas[]>(() => {
    const porPrueba = new Map<number | string, GrupoMarcas>();
    for (const marca of this.marcas()) {
      const key =
        marca.pruebaFisicaId ?? marca.nombreLibre ?? `libre-${marca.id}`;
      const existente = porPrueba.get(key);
      if (existente) {
        existente.marcas.push(marca);
      } else {
        porPrueba.set(key, {
          pruebaFisicaId: key,
          pruebaNombre: marca.pruebaNombre,
          grupo: marca.grupo,
          color: marca.color,
          marcas: [marca],
        });
      }
    }
    // El backend ya ordena `pruebaFisicaId asc, fecha desc`; Map conserva el
    // orden de inserción, así que no hace falta reordenar aquí.
    return Array.from(porPrueba.values());
  });

  /** Catálogo filtrado de pruebas (`GET /pruebas`), fuente única del selector. */
  protected catalogo = signal<PruebaFisicaCatalogo[]>([]);

  /** Opciones del desplegable "prueba", derivadas del catálogo filtrado. */
  protected readonly pruebaOpciones = computed<PruebaOpcion[]>(() => {
    const delCatalogo = this.catalogo()
      .map((d) => ({
        pruebaFisicaId: d.id,
        nombre: d.nombre,
        grupo: d.grupo,
        color: d.color,
        esOtra: false,
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
    return [
      ...delCatalogo,
      {
        pruebaFisicaId: PRUEBA_OTRA_ID,
        nombre: 'Otra prueba…',
        grupo: null,
        color: null,
        esOtra: true,
      },
    ];
  });

  protected readonly form = this.fb.nonNullable.group({
    pruebaFisicaId: this.fb.control<number | null>(null, Validators.required),
    nombreLibre: ['', [Validators.maxLength(60)]],
    valor: this.fb.control<number | null>(null, [
      Validators.required,
      Validators.min(0.01),
    ]),
    unidad: ['', Validators.required],
    fecha: this.fb.control<Date | null>(null, Validators.required),
    notas: [''],
  });

  /**
   * Selección actual del desplegable como signal. OJO: un `computed` que lea
   * `form.getRawValue()` directamente queda cacheado para siempre (el form no
   * es reactivo para signals) y el input de "Otra prueba…" no aparecería tras
   * el primer render. Por eso se pasa por `valueChanges` + `toSignal`.
   */
  private readonly pruebaSeleccionada = toSignal(
    this.form.controls.pruebaFisicaId.valueChanges,
    { initialValue: this.form.controls.pruebaFisicaId.value },
  );

  /** True cuando el alumno ha elegido "Otra prueba…" en el selector. */
  protected readonly esOtraPruebaSeleccionada = computed(
    () => this.pruebaSeleccionada() === PRUEBA_OTRA_ID,
  );

  protected readonly hoy = new Date();

  /** Cuando cambia la prueba, sugiere la unidad del catálogo. */
  protected onPruebaChange(pruebaFisicaId: number): void {
    const nombreLibreControl = this.form.get('nombreLibre');
    if (pruebaFisicaId === PRUEBA_OTRA_ID) {
      nombreLibreControl?.setValidators([
        Validators.required,
        Validators.maxLength(60),
      ]);
      nombreLibreControl?.updateValueAndValidity();
      return;
    }
    nombreLibreControl?.setValue('');
    nombreLibreControl?.setValidators([Validators.maxLength(60)]);
    nombreLibreControl?.updateValueAndValidity();

    const prueba = this.catalogo().find((d) => d.id === pruebaFisicaId);
    if (prueba && !this.form.get('unidad')?.value) {
      this.form.get('unidad')?.setValue(prueba.unidadSugerida);
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
        firstValueFrom(this.svc.catalogoPruebas()),
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
      valor: valores.valor!,
      unidad: valores.unidad,
      fecha: this.formatearFechaISO(valores.fecha!),
      ...(valores.notas ? { notas: valores.notas } : {}),
    };
    if (valores.pruebaFisicaId === PRUEBA_OTRA_ID) {
      dto.nombreLibre = valores.nombreLibre.trim();
    } else {
      dto.pruebaFisicaId = valores.pruebaFisicaId!;
    }
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
      message: `Vas a eliminar esta marca de "${marca.pruebaNombre}" (${marca.valor} ${marca.unidad}, ${marca.fecha}). ¿Estás seguro?`,
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
