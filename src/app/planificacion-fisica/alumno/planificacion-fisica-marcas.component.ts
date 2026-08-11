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
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CalendarModule } from 'primeng/calendar';
import { CardModule } from 'primeng/card';
import { ConfirmationService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ChartModule } from 'primeng/chart';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { ToastrService } from 'ngx-toastr';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AsyncButtonComponent } from '../../shared/components/async-button/async-button.component';
import {
  AccesoDenegadoPlanFisica,
  CrearMarcaDto,
  GrupoDisciplina,
  MarcaPersonal,
  PlanificacionFisicaService,
  PruebaFisicaCatalogo,
} from '../services/planificacion-fisica.service';
import {
  esUnidadTiempo,
  formatearValor,
  parsearValorTiempo,
} from '../utils/marcas-formato';

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

/** Vista enriquecida de un grupo de marcas para pintar stats + gráfica. */
interface GrupoMarcasVista {
  /** Id de prueba o identificador textual para marcas libres. */
  pruebaFisicaId: number | string;
  pruebaNombre: string;
  grupo: GrupoDisciplina | null;
  color: string | null;
  /** Unidad canónica de la prueba asociada; null para libres. */
  unidadCanonica: string | null;
  /** Dirección de mejora (menor = mejor para tiempos). */
  mejorEsMenor: boolean;
  marcas: MarcaPersonal[];
  /** Mejor marca histórica según la dirección. */
  mejorMarca: MarcaPersonal | null;
  /** Marca más reciente. */
  ultimaMarca: MarcaPersonal | null;
  /** Segunda marca más reciente, para calcular progresión. */
  anteriorMarca: MarcaPersonal | null;
  /** Delta última vs anterior (positivo/negativo). */
  progresion: number | null;
  /** true cuando el delta representa una mejora. */
  progresionEsMejora: boolean | null;
  /** Porcentaje acumulado desde la primera marca hasta la última (positivo = mejora). */
  progresoAcumulado: number | null;
  /** Unidad que comparten las marcas de la gráfica. */
  unidadGrafica: string | null;
  /** Marcas ordenadas cronológicamente que entran en la gráfica. */
  marcasGrafica: MarcaPersonal[];
  /** true cuando hay ≥2 marcas con la misma unidad. */
  mostrarGrafica: boolean;
  /** Datos para `p-chart`. */
  chartData: unknown;
  /** Opciones para `p-chart`. */
  chartOptions: unknown;
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
    ChartModule,
    ConfirmDialogModule,
    DropdownModule,
    InputNumberModule,
    InputTextModule,
    TagModule,
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

  protected readonly grupos = computed<GrupoMarcasVista[]>(() => {
    const porPrueba = new Map<number | string, GrupoMarcasVista>();
    for (const marca of this.marcas()) {
      const key =
        marca.pruebaFisicaId ?? marca.nombreLibre ?? `libre-${marca.id}`;
      const existente = porPrueba.get(key);
      if (existente) {
        existente.marcas.push(marca);
      } else {
        porPrueba.set(key, this.crearGrupoVista(key, marca));
      }
    }
    // El backend ya ordena `pruebaFisicaId asc, fecha desc`; Map conserva el
    // orden de inserción, así que no hace falta reordenar aquí.
    return Array.from(porPrueba.values()).map((g) => this.enriquecerGrupo(g));
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
    /** Valor numérico para unidades que no son tiempo. */
    valor: this.fb.control<number | null>(null, [
      Validators.required,
      Validators.min(0.01),
    ]),
    /** Valor textual para unidades de tiempo (mm:ss o segundos crudos). */
    valorTexto: [''],
    unidad: ['', Validators.required],
    fecha: this.fb.control<Date | null>(null, Validators.required),
    notas: [''],
  });

  /**
   * Valor actual del formulario como signal. El form no es reactivo para
   * signals por sí solo; `valueChanges` + `toSignal` permite que los computeds
   * del template reaccionen a la prueba/unidad elegida.
   */
  private readonly formValue = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  /** True cuando el alumno ha elegido "Otra prueba…" en el selector. */
  protected readonly esOtraPruebaSeleccionada = computed(
    () => this.formValue().pruebaFisicaId === PRUEBA_OTRA_ID,
  );

  /** Prueba oficial seleccionada en el catálogo; null si no aplica. */
  protected readonly pruebaSeleccionadaCatalogo = computed(() => {
    const id = this.formValue().pruebaFisicaId;
    if (id == null || id === PRUEBA_OTRA_ID) {
      return null;
    }
    return this.catalogo().find((d) => d.id === id) ?? null;
  });

  /** Unidad efectiva del formulario según la prueba elegida. */
  protected readonly unidadEfectiva = computed(() => {
    const prueba = this.pruebaSeleccionadaCatalogo();
    if (prueba?.unidad) {
      return prueba.unidad;
    }
    return this.formValue().unidad ?? '';
  });

  /** true si la prueba elegida tiene una unidad canónica bloqueada. */
  protected readonly unidadBloqueada = computed(() => {
    return !!this.pruebaSeleccionadaCatalogo()?.unidad;
  });

  /** true si la entrada de valor debe admitir formato de tiempo. */
  protected readonly esEntradaTiempo = computed(() =>
    esUnidadTiempo(this.unidadEfectiva()),
  );

  /** Placeholder del campo unidad según la selección actual. */
  protected readonly placeholderUnidad = computed(() => {
    if (this.unidadBloqueada()) {
      return '';
    }
    return this.unidadEfectiva() || 'min, seg, reps...';
  });

  protected readonly hoy = new Date();

  /** Cuando cambia la prueba, bloquea/libera la unidad y ajusta los validadores. */
  protected onPruebaChange(pruebaFisicaId: number): void {
    // Asegura que el signal del form refleje la selección incluso cuando se
    // invoca directamente (p. ej. en tests) sin pasar por el dropdown.
    this.form.controls.pruebaFisicaId.setValue(pruebaFisicaId, {
      emitEvent: true,
    });
    const nombreLibreControl = this.form.controls.nombreLibre;
    const unidadControl = this.form.controls.unidad;
    const prueba = this.catalogo().find((d) => d.id === pruebaFisicaId);

    if (pruebaFisicaId === PRUEBA_OTRA_ID) {
      nombreLibreControl.setValidators([
        Validators.required,
        Validators.maxLength(60),
      ]);
      nombreLibreControl.updateValueAndValidity();
      unidadControl.setValue('');
      unidadControl.enable();
      this.ajustarValidadoresValor();
      return;
    }

    nombreLibreControl.setValue('');
    nombreLibreControl.setValidators([Validators.maxLength(60)]);
    nombreLibreControl.updateValueAndValidity();

    if (prueba?.unidad) {
      unidadControl.setValue(prueba.unidad);
      unidadControl.disable();
    } else {
      unidadControl.setValue('');
      unidadControl.enable();
    }
    this.ajustarValidadoresValor();
  }

  /** Activa/desactiva validadores de valor según sea entrada numérica o de tiempo. */
  private ajustarValidadoresValor(): void {
    const unidad = this.unidadEfectiva();
    const esTiempo = esUnidadTiempo(unidad);
    const valorControl = this.form.controls.valor;
    const valorTextoControl = this.form.controls.valorTexto;

    if (esTiempo) {
      valorControl.clearValidators();
      valorControl.setValue(null);
      valorControl.disable();

      valorTextoControl.setValidators([
        Validators.required,
        this.crearValidadorTiempo(),
      ]);
      valorTextoControl.enable();
      valorTextoControl.updateValueAndValidity();
    } else {
      valorTextoControl.clearValidators();
      valorTextoControl.setValue('');
      valorTextoControl.disable();

      valorControl.setValidators([Validators.required, Validators.min(0.01)]);
      valorControl.enable();
      valorControl.updateValueAndValidity();
    }
    valorControl.updateValueAndValidity();
  }

  private crearValidadorTiempo(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const unidad = this.form.controls.unidad.value;
      if (!control.value || !esUnidadTiempo(unidad)) {
        return null;
      }
      const parsed = parsearValorTiempo(control.value, unidad);
      return Number.isFinite(parsed) && parsed > 0
        ? null
        : { tiempoInvalido: true };
    };
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
    const unidad = valores.unidad;
    const valor = this.obtenerValorNumerico();
    if (valor === null || Number.isNaN(valor)) {
      this.toast.error('Revisa el valor introducido.');
      return;
    }

    const dto: CrearMarcaDto = {
      valor,
      unidad,
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

  private obtenerValorNumerico(): number | null {
    const valores = this.form.getRawValue();
    if (esUnidadTiempo(valores.unidad)) {
      return parsearValorTiempo(valores.valorTexto, valores.unidad);
    }
    return valores.valor;
  }

  protected confirmarBorrarMarca(marca: MarcaPersonal, event: Event): void {
    this.confirmationService.confirm({
      key: 'pf-marcas-borrar',
      target: event.target as EventTarget,
      message: `Vas a eliminar esta marca de "${marca.pruebaNombre}" (${formatearValor(marca.valor, marca.unidad)}, ${marca.fecha}). ¿Estás seguro?`,
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

  protected formatearMarca(valor: number, unidad: string): string {
    return formatearValor(valor, unidad);
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

  private crearGrupoVista(
    key: number | string,
    marca: MarcaPersonal,
  ): GrupoMarcasVista {
    return {
      pruebaFisicaId: key,
      pruebaNombre: marca.pruebaNombre,
      grupo: marca.grupo,
      color: marca.color,
      unidadCanonica: marca.unidadCanonica,
      mejorEsMenor: marca.mejorEsMenor,
      marcas: [marca],
      mejorMarca: null,
      ultimaMarca: null,
      anteriorMarca: null,
      progresion: null,
      progresionEsMejora: null,
      progresoAcumulado: null,
      unidadGrafica: null,
      marcasGrafica: [],
      mostrarGrafica: false,
      chartData: null,
      chartOptions: null,
    };
  }

  private enriquecerGrupo(grupo: GrupoMarcasVista): GrupoMarcasVista {
    const ordenadas = [...grupo.marcas].sort(
      (a, b) =>
        new Date(a.fecha).getTime() - new Date(b.fecha).getTime() ||
        a.id - b.id,
    );
    const mejorEsMenor = grupo.mejorEsMenor;

    const mejorMarca = [...grupo.marcas].sort((a, b) => {
      if (mejorEsMenor) return a.valor - b.valor;
      return b.valor - a.valor;
    })[0];

    const ultimaMarca = ordenadas[ordenadas.length - 1] ?? null;
    const anteriorMarca = ordenadas[ordenadas.length - 2] ?? null;
    let progresion: number | null = null;
    let progresionEsMejora: boolean | null = null;
    if (ultimaMarca && anteriorMarca) {
      progresion = ultimaMarca.valor - anteriorMarca.valor;
      progresionEsMejora = mejorEsMenor ? progresion < 0 : progresion > 0;
    }

    // Gráfica: unidad canónica para pruebas oficiales; para libres, la
    // unidad más frecuente que tenga ≥2 marcas.
    const unidadGrafica =
      grupo.unidadCanonica ?? this.unidadMayoritaria(grupo.marcas);
    const marcasGrafica = unidadGrafica
      ? ordenadas.filter((m) => m.unidad === unidadGrafica)
      : [];
    const mostrarGrafica = marcasGrafica.length >= 2;

    // Progreso acumulado desde la primera marca histórica hasta la última,
    // direction-aware: + significa siempre mejora.
    let progresoAcumulado: number | null = null;
    const primeraMarca = marcasGrafica[0] ?? null;
    if (primeraMarca && ultimaMarca && primeraMarca.id !== ultimaMarca.id) {
      const primero = primeraMarca.valor;
      const ultimo = ultimaMarca.valor;
      if (primero !== 0) {
        progresoAcumulado = mejorEsMenor
          ? ((primero - ultimo) / primero) * 100
          : ((ultimo - primero) / primero) * 100;
      }
    }

    return {
      ...grupo,
      mejorMarca,
      ultimaMarca,
      anteriorMarca,
      progresion,
      progresionEsMejora,
      progresoAcumulado,
      unidadGrafica,
      marcasGrafica,
      mostrarGrafica,
      chartData: mostrarGrafica
        ? this.crearChartData(marcasGrafica, unidadGrafica!, mejorEsMenor)
        : null,
      chartOptions: mostrarGrafica
        ? this.crearChartOptions(unidadGrafica!, mejorEsMenor)
        : null,
    };
  }

  private unidadMayoritaria(marcas: MarcaPersonal[]): string | null {
    const conteo = new Map<string, number>();
    for (const m of marcas) {
      conteo.set(m.unidad, (conteo.get(m.unidad) ?? 0) + 1);
    }
    let mejor: string | null = null;
    let max = 1;
    for (const [unidad, count] of conteo.entries()) {
      if (count > max) {
        max = count;
        mejor = unidad;
      }
    }
    return mejor;
  }

  private crearChartData(
    marcas: MarcaPersonal[],
    unidad: string,
    mejorEsMenor: boolean,
  ): unknown {
    const labels = marcas.map((m) =>
      new Date(m.fecha).toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
      }),
    );
    const valores = marcas.map((m) => m.valor);
    const colorPrimario =
      getComputedStyle(document.documentElement)
        .getPropertyValue('--primary-color')
        .trim() || '#c05621';
    const colorVerde =
      getComputedStyle(document.documentElement)
        .getPropertyValue('--green-600')
        .trim() || '#16a34a';

    const primera = valores[0];
    const ultima = valores[valores.length - 1];
    const hayProgresoNeto = mejorEsMenor ? ultima < primera : ultima > primera;
    const colorLinea = hayProgresoNeto ? colorVerde : colorPrimario;

    const idxPr = valores.reduce((mejorIdx, v, i) => {
      if (mejorIdx === -1) return i;
      const mejor = valores[mejorIdx];
      return mejorEsMenor
        ? v < mejor
          ? i
          : mejorIdx
        : v > mejor
          ? i
          : mejorIdx;
    }, -1);

    const pointBackgroundColor = valores.map((_, i) =>
      i === idxPr ? colorVerde : colorLinea,
    );
    const pointRadius = valores.map((_, i) => (i === idxPr ? 7 : 4));
    const pointHoverRadius = valores.map((_, i) => (i === idxPr ? 9 : 6));

    return {
      labels,
      datasets: [
        {
          label: `Valor (${unidad})`,
          data: valores,
          fill: false,
          borderColor: colorLinea,
          backgroundColor: colorLinea,
          tension: 0.2,
          pointBackgroundColor,
          pointRadius,
          pointHoverRadius,
        },
      ],
    };
  }

  private crearChartOptions(unidad: string, mejorEsMenor: boolean): unknown {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          callbacks: {
            label: (context: { parsed: { y: number } }) =>
              formatearValor(context.parsed.y, unidad),
          },
        },
      },
      scales: {
        y: {
          reverse: mejorEsMenor,
          title: {
            display: true,
            text: unidad,
          },
        },
      },
    };
  }
}
