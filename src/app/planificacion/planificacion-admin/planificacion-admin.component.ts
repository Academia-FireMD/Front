import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
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
import { ConfirmationService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputSwitchModule } from 'primeng/inputswitch';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TagModule } from 'primeng/tag';
import { firstValueFrom, of } from 'rxjs';
import {
  GenericListComponent,
  FilterConfig,
} from '../../shared/generic-list/generic-list.component';
import { SharedGridComponent } from '../../shared/shared-grid/shared-grid.component';
import { PlanificacionesService } from '../../services/planificaciones.service';
import { NivelOposicion } from '../../shared/models/pregunta.model';
import {
  getPlanificacionOposicionLabel,
  getPlanificacionVarianteCodigo,
  Oposicion,
} from '../../shared/models/subscription.model';
import { TipoDePlanificacionDeseada } from '../../shared/models/user.model';
import type { PlanificacionMensual } from '../../shared/models/planificacion.model';
import {
  PreviewImportacionPlantillas,
  PreviewCargaSemanas,
  DestinoCargaSemanas,
  VarianteCargaSemanas,
  ReglaOposicionAdmin,
  ResultadoImportacionPlantillas,
  SemanaImportacionPlantilla,
  VarianteAdmin,
} from '../models/autoasignacion.model';
import { AutoasignacionService } from '../services/autoasignacion.service';
import {
  OposicionPickerComponent,
  OposicionPickerOption,
} from '../../shared/oposicion-picker/oposicion-picker.component';
import { ExcelFilePickerComponent } from '../../shared/excel-file-picker/excel-file-picker.component';
import { GRUPO_COMUNIDAD_VALENCIANA, oposiciones } from '../../utils/consts';
import {
  getFranjaPlanificacionLabel,
  getNivelOposicionLabel,
} from '../../shared/utils/planificacion-labels.util';
import {
  codigoPlantillaImportada,
  etiquetaVarianteImportada,
  identidadVarianteImportada,
} from '../utils/variante-importada.util';

const ETIQUETAS_ESTADO_SEMANA_IMPORTACION: Record<
  NonNullable<SemanaImportacionPlantilla['estado']>,
  string
> = {
  creada: 'Creada',
  actualizada: 'Actualizada',
  omitida: 'Omitida',
  error: 'Con error',
  sobrescritura: 'Sobrescrita',
};

@Component({
  selector: 'app-planificacion-admin',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ButtonModule,
    ConfirmDialogModule,
    DialogModule,
    DropdownModule,
    IconFieldModule,
    InputIconModule,
    InputSwitchModule,
    InputTextModule,
    MessageModule,
    ProgressSpinnerModule,
    TagModule,
    GenericListComponent,
    OposicionPickerComponent,
    ExcelFilePickerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './planificacion-admin.component.html',
  styleUrl: './planificacion-admin.component.scss',
})
export class PlanificacionAdminComponent
  extends SharedGridComponent<VarianteAdmin>
  implements OnInit
{
  private readonly autoasignacionService = inject(AutoasignacionService);
  private readonly planificacionesService = inject(PlanificacionesService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly fb = inject(FormBuilder);

  readonly NivelOposicion = NivelOposicion;
  readonly getPlanificacionOposicionLabel = getPlanificacionOposicionLabel;
  readonly getNivelOposicionLabel = getNivelOposicionLabel;
  readonly getFranjaPlanificacionLabel = getFranjaPlanificacionLabel;
  readonly accesosPlanComun = [
    { oposicion: Oposicion.VALENCIA_AYUNTAMIENTO, label: 'Valencia' },
    { oposicion: Oposicion.ALICANTE_CPBA, label: 'Alicante' },
  ];
  readonly guardandoAccesoPlanComun = signal<Oposicion | null>(null);
  readonly imagenesFallidas = signal<Set<Oposicion>>(new Set());

  imagenOposicion(oposicion: Oposicion): string | null {
    if (this.imagenesFallidas().has(oposicion)) return null;
    const image =
      oposicion === Oposicion.GENERAL
        ? GRUPO_COMUNIDAD_VALENCIANA.image
        : oposiciones[oposicion]?.image;
    return image ? `/${image}` : null;
  }

  marcarImagenFallida(oposicion: Oposicion): void {
    this.imagenesFallidas.update((actual) => new Set([...actual, oposicion]));
  }

  iconoOposicion(oposicion: Oposicion): string {
    return oposicion === Oposicion.GENERAL
      ? GRUPO_COMUNIDAD_VALENCIANA.icon
      : (oposiciones[oposicion]?.icon ?? '🔥');
  }

  labelOposicion(op: Oposicion | string | null | undefined): string {
    return getPlanificacionOposicionLabel(op);
  }

  tienePlanPublicado(variante: VarianteAdmin): boolean {
    return !!(
      variante.planificacionMensualId ?? variante.planificacionMensual?.id
    );
  }

  getEstadoSemanaImportacionLabel(
    estado: SemanaImportacionPlantilla['estado'],
  ): string {
    return estado ? ETIQUETAS_ESTADO_SEMANA_IMPORTACION[estado] : 'Creada';
  }

  oposicionOptions: OposicionPickerOption[] = Object.values(Oposicion).map(
    (value) => ({ value }),
  );
  nivelOptions = [
    { label: 'Iniciación', value: NivelOposicion.INICIACION },
    { label: 'Avanzado', value: NivelOposicion.AVANZADO },
  ];
  franjaOptions = [
    { label: '4-6 horas', value: 'FRANJA_CUATRO_A_SEIS_HORAS' },
    { label: '6-8 horas', value: 'FRANJA_SEIS_A_OCHO_HORAS' },
  ];

  variantes = signal<VarianteAdmin[]>([]);
  dialogoVarianteVisible = signal(false);
  searchReadOnly = true;
  readonly filters: FilterConfig[] = [
    {
      key: 'oposicion',
      label: 'Oposición',
      type: 'dropdown',
      options: Object.values(Oposicion).map((value) => ({
        label: getPlanificacionOposicionLabel(value),
        value,
      })),
    },
    {
      key: 'nivel',
      label: 'Nivel',
      type: 'dropdown',
      options: this.nivelOptions,
    },
    {
      key: 'franja',
      label: 'Horas de estudio',
      type: 'dropdown',
      options: this.franjaOptions,
    },
    {
      key: 'activa',
      label: 'Estado',
      type: 'dropdown',
      options: [
        { label: 'Activas', value: true },
        { label: 'Inactivas', value: false },
      ],
    },
    {
      key: 'publicada',
      label: 'Planificación publicada',
      type: 'dropdown',
      options: [
        { label: 'Con planificación', value: 'con' },
        { label: 'Sin planificación', value: 'sin' },
      ],
    },
  ];
  reglas = signal<ReglaOposicionAdmin[]>([]);
  planificacionesMensuales = signal<PlanificacionMensual[]>([]);
  cargando = signal(false);
  error = signal<string | null>(null);
  archivoImportacion = signal<File | null>(null);
  previewCarga = signal<PreviewCargaSemanas | null>(null);
  errorCarga = signal<string | null>(null);
  resultadoCarga = signal<PreviewCargaSemanas | null>(null);
  destinosCarga = signal<Record<string, DestinoCargaSemanas>>({});
  idempotencyKeyCarga: string | null = null;
  previewImportacion = signal<PreviewImportacionPlantillas | null>(null);
  previsualizandoImportacion = signal(false);
  aplicandoImportacion = signal(false);
  confirmarSobrescritura = signal(false);
  resultadoImportacion = signal<ResultadoImportacionPlantillas | null>(null);
  codigosUltimaImportacion = signal<string[]>([]);
  pasoImportacionActual = computed(() =>
    this.resultadoImportacion() || this.codigosUltimaImportacion().length
      ? 2
      : 1,
  );
  codigosImportacionOptions = computed(() =>
    this.codigosUltimaImportacion().map((codigo) => ({
      label: etiquetaVarianteImportada(codigo),
      value: codigo,
    })),
  );
  codigoImportacionSeleccionado = signal<string | null>(null);
  planificacionDestinoImportacion = signal<number | null>(null);
  dialogoImportacionVisible = signal(false);
  private abrirVarianteDesdeRutaPendiente = true;

  varianteForm = this.fb.group({
    id: [null as number | null],
    codigo: ['', Validators.required],
    oposicion: [Oposicion.GENERAL as Oposicion, Validators.required],
    nivel: [NivelOposicion.INICIACION as NivelOposicion, Validators.required],
    franja: ['FRANJA_CUATRO_A_SEIS_HORAS', Validators.required],
    planificacionMensualId: [null as number | null],
    activa: [true],
  });

  constructor() {
    super();
    this.fetchItems$ = computed(() => {
      const { skip, take, searchTerm, where } = this.pagination();
      const filtros = (where ?? {}) as Partial<VarianteAdmin> & {
        publicada?: string;
      };
      const busqueda = searchTerm.trim().toLocaleLowerCase('es');
      const coincidencias = this.variantes().filter(
        (variante) =>
          (!filtros.oposicion || variante.oposicion === filtros.oposicion) &&
          (!filtros.nivel || variante.nivel === filtros.nivel) &&
          (!filtros.franja || variante.franja === filtros.franja) &&
          (filtros.activa === undefined ||
            variante.activa === filtros.activa) &&
          (filtros.publicada !== 'con' || this.tienePlanPublicado(variante)) &&
          (filtros.publicada !== 'sin' || !this.tienePlanPublicado(variante)) &&
          (!busqueda ||
            [
              variante.codigo,
              getPlanificacionOposicionLabel(variante.oposicion),
              getNivelOposicionLabel(variante.nivel),
              getFranjaPlanificacionLabel(variante.franja),
              variante.planificacionMensual?.identificador ?? '',
            ].some((texto) =>
              texto.toLocaleLowerCase('es').includes(busqueda),
            )),
      );
      return of({
        data: coincidencias.slice(skip, skip + take),
        pagination: { skip, take, searchTerm, count: coincidencias.length },
      });
    });
  }

  override ngOnInit(): void {
    super.ngOnInit();
    const codigos = this.route.snapshot.queryParamMap
      .getAll('codigosHoja')
      .flatMap((codigo) => codigo.split(','))
      .map((codigo) => codigo.trim())
      .filter(Boolean);
    if (codigos.length) {
      this.codigosUltimaImportacion.set([...new Set(codigos)]);
      this.codigoImportacionSeleccionado.set(
        this.route.snapshot.queryParamMap.get('codigoActivo') ?? codigos[0],
      );
    }
    if (
      this.route.snapshot.queryParamMap.get('paso') === 'destino' ||
      this.route.snapshot.queryParamMap.get('importar') === '1'
    ) {
      this.dialogoImportacionVisible.set(true);
    }
    this.varianteForm.valueChanges.subscribe(() => {
      this.actualizarCodigoCanonico();
      this.limpiarPlanificacionIncompatible();
    });
    this.actualizarCodigoCanonico();
    this.cargarTodo();
  }

  async cargarTodo(): Promise<void> {
    this.cargando.set(true);
    try {
      const [variantes, reglas, planificaciones] = await Promise.all([
        firstValueFrom(this.autoasignacionService.getVariantes$()),
        firstValueFrom(this.autoasignacionService.getReglas$()),
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
      this.planificacionesMensuales.set(planificaciones?.data ?? []);
      this.limpiarPlanificacionIncompatible();
      this.sincronizarDestinoImportacion();
      if (this.abrirVarianteDesdeRutaPendiente) {
        this.abrirVarianteDesdeRutaPendiente = false;
        const varianteId = Number(
          this.route.snapshot.queryParamMap.get('varianteId'),
        );
        const borradorId = Number(
          this.route.snapshot.queryParamMap.get('borradorId'),
        );
        const variante = variantes?.find((v) => v.id === varianteId);
        if (
          variante &&
          borradorId &&
          this.planificacionesMensuales().some(
            (p) => p.id === borradorId && p.estado === 'BORRADOR',
          )
        ) {
          this.editarVariante(variante);
          this.varianteForm.controls.planificacionMensualId.setValue(
            borradorId,
          );
        }
      }
    } catch {
      this.toast.error('No se pudieron cargar los datos de administración');
    } finally {
      this.cargando.set(false);
    }
  }

  planComunActivo(oposicion: Oposicion): boolean {
    return this.reglas().some(
      (regla) =>
        regla.oposicionSuscripcion === oposicion &&
        regla.oposicionPlanificacion === Oposicion.GENERAL &&
        regla.activa,
    );
  }

  async cambiarAccesoPlanComun(
    oposicion: Oposicion,
    activa: boolean,
  ): Promise<void> {
    if (this.guardandoAccesoPlanComun()) return;
    const regla = this.reglas().find(
      (item) =>
        item.oposicionSuscripcion === oposicion &&
        item.oposicionPlanificacion === Oposicion.GENERAL,
    );
    if (regla?.activa === activa) return;
    const reglasAnteriores = this.reglas();
    this.guardandoAccesoPlanComun.set(oposicion);
    this.reglas.update((actual) =>
      regla
        ? actual.map((item) => (item === regla ? { ...item, activa } : item))
        : [
            ...actual,
            {
              oposicionSuscripcion: oposicion,
              oposicionPlanificacion: Oposicion.GENERAL,
              activa,
            },
          ],
    );
    try {
      if (regla?.id) {
        await firstValueFrom(
          this.autoasignacionService.actualizarRegla$(regla.id, { activa }),
        );
      } else if (activa) {
        await firstValueFrom(
          this.autoasignacionService.crearRegla$({
            oposicionSuscripcion: oposicion,
            oposicionPlanificacion: Oposicion.GENERAL,
            activa: true,
          }),
        );
      }
      await this.cargarTodo();
      this.toast.success('Acceso al plan común actualizado');
    } catch (error) {
      this.reglas.set(reglasAnteriores);
      this.toast.error(
        this.mensajeErrorImportacion(
          error,
          'No se pudo cambiar el acceso al plan común',
        ),
      );
      await this.cargarTodo();
    } finally {
      this.guardandoAccesoPlanComun.set(null);
    }
  }

  abrirImportacionSemanas(): void {
    this.dialogoImportacionVisible.set(true);
  }

  volverAPlanes(): void {
    void this.router.navigate(['/app/planificacion/planificacion-mensual']);
  }

  cambiarVisibilidadImportacion(visible: boolean): void {
    if (this.aplicandoImportacion()) return;
    this.dialogoImportacionVisible.set(visible);
    if (!visible && this.route.snapshot.queryParamMap.get('importar') === '1')
      this.volverAPlanes();
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
    this.dialogoVarianteVisible.set(true);
  }

  abrirNuevaVariante(): void {
    this.nuevaVariante();
    this.dialogoVarianteVisible.set(true);
  }

  cerrarDialogoVariante(): void {
    this.dialogoVarianteVisible.set(false);
    this.nuevaVariante();
  }

  buscarVariante(event: Event): void {
    this.updatePaginationSafe({
      searchTerm: (event.target as HTMLInputElement).value,
      skip: 0,
    });
  }

  activarBusqueda(event: FocusEvent): void {
    const input = event.target as HTMLInputElement;
    this.searchReadOnly = false;
    input.readOnly = false;
    input.value = this.pagination().searchTerm ?? '';
  }

  onFiltersChanged(
    where?: Partial<VarianteAdmin> & { publicada?: string },
  ): void {
    this.updatePaginationSafe({ where, skip: 0 });
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
    this.actualizarCodigoCanonico();
  }

  async guardarVariante(): Promise<void> {
    if (this.varianteForm.invalid) {
      this.toast.error('Revisa los campos de la variante');
      return;
    }
    this.actualizarCodigoCanonico();
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
      this.cerrarDialogoVariante();
      await this.cargarTodo();
    } catch (error) {
      this.toast.error(
        this.mensajeErrorImportacion(error, 'No se pudo guardar la variante'),
      );
    }
  }

  /**
   * La identidad de una variante nueva siempre deriva de sus tres
   * dimensiones. En edición el servidor conserva la identidad histórica y el
   * control ya está deshabilitado, por lo que no se recalcula.
   */
  private actualizarCodigoCanonico(): void {
    if (this.varianteForm.controls.id.value !== null) return;

    const codigo = getPlanificacionVarianteCodigo(
      this.varianteForm.controls.oposicion.value,
      this.varianteForm.controls.nivel.value,
      this.varianteForm.controls.franja.value,
    );
    const control = this.varianteForm.controls.codigo;
    if (control.value !== codigo) {
      control.setValue(codigo, { emitEvent: false });
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
        'Se validarán estudio y física y se publicará la planificación. Los alumnos actuales recibirán esta versión, conservando el progreso de las actividades que continúan, sus eventos personales y el historial anterior.',
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
          this.cerrarDialogoVariante();
          await this.cargarTodo();
        } catch (error) {
          this.toast.error(
            this.mensajeErrorImportacion(
              error,
              'No se pudo publicar. Revisa la cobertura de estudio y física.',
            ),
          );
        }
      },
    });
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
    } catch (error) {
      this.toast.error(
        this.mensajeErrorImportacion(
          error,
          'No se pudo actualizar la variante',
        ),
      );
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
    const publicadaId =
      this.variantes().find((v) => v.id === varianteId)
        ?.planificacionMensualId ?? null;
    return this.planificacionesMensuales()
      .filter(
        (planificacion) =>
          !planesMapeadosEnOtraVariante.has(planificacion.id) &&
          (!franja || planificacion.tipoDePlanificacion === franja) &&
          (!oposicion || planificacion.relevancia?.includes(oposicion)) &&
          (planificacion.estado !== 'BORRADOR' ||
            !varianteId ||
            ((planificacion.planificacionAnteriorId ?? null) === publicadaId &&
              (!planificacion.varianteBorradorId ||
                planificacion.varianteBorradorId === varianteId))),
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

  seleccionarArchivoImportacion(selected: File | null | Event): void {
    const input =
      selected instanceof File || selected === null
        ? null
        : (selected.target as HTMLInputElement);
    const file = input ? (input.files?.[0] ?? null) : (selected as File | null);
    this.previewImportacion.set(null);
    this.previewCarga.set(null);
    this.errorCarga.set(null);
    this.resultadoCarga.set(null);
    this.destinosCarga.set({});
    this.idempotencyKeyCarga = null;
    this.confirmarSobrescritura.set(false);
    this.resultadoImportacion.set(null);
    this.codigosUltimaImportacion.set([]);
    this.planificacionDestinoImportacion.set(null);

    if (!file) {
      this.archivoImportacion.set(null);
      return;
    }
    if (!/\.(xlsx|xls)$/i.test(file.name) || file.size > 10 * 1024 * 1024) {
      this.archivoImportacion.set(null);
      if (input) input.value = '';
      this.toast.error('Selecciona un Excel .xlsx o .xls de hasta 10 MB');
      return;
    }
    this.archivoImportacion.set(file);
  }

  opcionesDestinoCarga(
    variante: VarianteCargaSemanas,
  ): Array<{ label: string; value: string }> {
    return (variante.candidatos ?? []).map((c) => ({
      label: `${c.identificador} · ${c.actividades ?? 0} actividades${c.actualizadoEn ? ' · ' + new Intl.DateTimeFormat('es-ES', { dateStyle: 'short' }).format(new Date(c.actualizadoEn)) : ''}`,
      value: `EXISTENTE:${c.id}`,
    }));
  }

  valorDestinoCarga(variante: VarianteCargaSemanas): string | null {
    const destino = this.destinosCarga()[variante.codigo] ?? variante.destino;
    if (!destino) return null;
    return destino.tipo === 'EXISTENTE'
      ? `EXISTENTE:${destino.planificacionId}`
      : destino.tipo;
  }

  cambiarDestinoCarga(variante: VarianteCargaSemanas, valor: string): void {
    if (!valor.startsWith('EXISTENTE:')) return;
    const destino: DestinoCargaSemanas = {
      tipo: 'EXISTENTE',
      planificacionId: Number(valor.slice(10)),
    };
    this.destinosCarga.update((actual) => ({
      ...actual,
      [variante.codigo]: destino,
    }));
    this.previewCarga.update((previo) =>
      previo ? { ...previo, puedeAplicar: false, previewHash: null } : null,
    );
    this.idempotencyKeyCarga = null;
  }

  async previsualizarCargaSemanas(): Promise<void> {
    const file = this.archivoImportacion();
    if (!file) return;
    this.previsualizandoImportacion.set(true);
    this.resultadoCarga.set(null);
    this.previewImportacion.set(null);
    this.errorCarga.set(null);
    this.confirmarSobrescritura.set(false);
    try {
      const preview = await firstValueFrom(
        this.autoasignacionService.previewCargaSemanas$(
          file,
          this.destinosCarga(),
          'CONTINUAR',
        ),
      );
      this.previewCarga.set(preview);
      this.idempotencyKeyCarga = preview.puedeAplicar
        ? (globalThis.crypto?.randomUUID?.() ??
          `${Date.now()}-${Math.random().toString(36).slice(2)}`)
        : null;
    } catch (error) {
      this.previewCarga.set(null);
      if (error instanceof HttpErrorResponse && error.error?.preview) {
        this.previewImportacion.set(
          error.error.preview as PreviewImportacionPlantillas,
        );
      }
      if (!this.previewImportacion()) {
        this.errorCarga.set(
          this.mensajeErrorImportacion(
            error,
            'No se pudo previsualizar el Excel.',
          ),
        );
      }
    } finally {
      this.previsualizandoImportacion.set(false);
    }
  }

  async guardarCargaSemanas(): Promise<void> {
    const file = this.archivoImportacion();
    const preview = this.previewCarga();
    if (
      !file ||
      !preview?.puedeAplicar ||
      !preview.previewHash ||
      !this.idempotencyKeyCarga
    )
      return;
    if (preview.requiereConfirmacion && !this.confirmarSobrescritura()) {
      this.toast.error(
        'Revisa y confirma los cambios indicados antes de guardar.',
      );
      return;
    }
    this.aplicandoImportacion.set(true);
    try {
      const resultado = await firstValueFrom(
        this.autoasignacionService.applyCargaSemanas$(
          file,
          this.destinosCarga(),
          preview.previewHash,
          this.confirmarSobrescritura(),
          this.idempotencyKeyCarga,
          'CONTINUAR',
        ),
      );
      this.resultadoCarga.set(resultado);
      this.previewCarga.set(null);
      this.toast.success('Semanas guardadas en borrador; no se han publicado.');
      if (resultado.variantes.length === 1)
        this.abrirCalendarioCarga(resultado.variantes[0]);
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 409) {
        this.previewCarga.set(null);
        this.confirmarSobrescritura.set(false);
      }
      this.toast.error(
        this.mensajeErrorImportacion(error, 'No se pudo guardar el Excel.'),
      );
    } finally {
      this.aplicandoImportacion.set(false);
    }
  }

  abrirCalendarioCarga(variante: VarianteCargaSemanas): void {
    if (!variante.planificacionId) return;
    void this.router.navigate(
      ['/app/planificacion/planificacion-mensual', variante.planificacionId],
      { queryParams: { fechaFoco: variante.primeraSemana } },
    );
  }

  async previsualizarImportacion(): Promise<void> {
    const file = this.archivoImportacion();
    if (!file) {
      this.toast.error('Selecciona primero un archivo Excel');
      return;
    }

    this.previsualizandoImportacion.set(true);
    this.previewImportacion.set(null);
    this.confirmarSobrescritura.set(false);
    try {
      const preview = await firstValueFrom(
        this.autoasignacionService.previewImportacionPlantillas$(file),
      );
      this.previewImportacion.set(preview);
      if (preview.puedeAplicar) {
        this.toast.success(
          'Previsualización validada; aún no se ha escrito nada',
        );
      } else {
        this.toast.error(
          preview.mensaje ?? 'El Excel contiene errores. No se puede aplicar',
        );
      }
    } catch (error) {
      this.toast.error(
        this.mensajeErrorImportacion(
          error,
          'No se pudo previsualizar el archivo',
        ),
      );
    } finally {
      this.previsualizandoImportacion.set(false);
    }
  }

  get puedeAplicarImportacion(): boolean {
    const preview = this.previewImportacion();
    return !!(
      this.archivoImportacion() &&
      preview?.puedeAplicar &&
      !this.previsualizandoImportacion() &&
      !this.aplicandoImportacion() &&
      (!preview.requiereConfirmacionSobrescritura ||
        this.confirmarSobrescritura()) &&
      (!preview.requiereConfirmacionIndependientes ||
        this.confirmarSobrescritura())
    );
  }

  confirmarAplicacionImportacion(): void {
    const preview = this.previewImportacion();
    if (!preview || !this.puedeAplicarImportacion) {
      this.toast.error('Previsualiza y corrige el Excel antes de aplicarlo');
      return;
    }
    const sobrescribe = preview.requiereConfirmacionSobrescritura;
    this.confirmationService.confirm({
      header: sobrescribe
        ? 'Confirmar reemplazo de plantillas'
        : 'Aplicar importación',
      message: sobrescribe
        ? `Se reemplazarán plantillas existentes (${preview.sobrescrituras.length}) y sus ediciones manuales. ¿Continuar?`
        : `Se aplicarán ${preview.totales.semanas} semanas validadas en una única transacción. ¿Continuar?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: sobrescribe ? 'Reemplazar plantillas' : 'Aplicar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: sobrescribe ? 'p-button-danger' : undefined,
      accept: () => this.ejecutarAplicacionImportacion(),
    });
  }

  formatearFechaIso(fecha: string): string {
    const [year, month, day] = fecha.split('-');
    return year && month && day ? `${day}/${month}/${year}` : fecha;
  }

  get planificacionesBorradorOptions(): Array<{
    label: string;
    value: number;
  }> {
    const variante = this.varianteImportacionSeleccionada;
    if (this.codigoImportacionSeleccionado() && !variante) {
      return [];
    }
    return this.planificacionesMensuales()
      .filter(
        (planificacion) =>
          planificacion.estado === 'BORRADOR' &&
          (!variante ||
            (planificacion.relevancia?.includes(variante.oposicion) &&
              planificacion.tipoDePlanificacion === variante.franja)),
      )
      .map((planificacion) => ({
        label: `${planificacion.identificador} (${planificacion.mes}/${planificacion.ano})`,
        value: planificacion.id,
      }));
  }

  get varianteImportacionSeleccionada(): VarianteAdmin | null {
    const codigo = this.codigoImportacionSeleccionado();
    if (!codigo) return null;
    const desdePreview = this.previewImportacion()?.hojas.find(
      (hoja) => codigoPlantillaImportada(hoja.hoja) === codigo,
    )?.variante;
    if (desdePreview) {
      return {
        ...desdePreview,
        activa: true,
      } as VarianteAdmin;
    }
    const identidad = identidadVarianteImportada(codigo);
    if (!identidad) return null;
    return (
      this.variantes().find(
        (variante) =>
          variante.oposicion === identidad.oposicion &&
          variante.nivel === identidad.nivel &&
          variante.franja === identidad.franja,
      ) ?? null
    );
  }

  seleccionarCodigoImportacion(codigo: string | null): void {
    this.codigoImportacionSeleccionado.set(codigo);
    this.planificacionDestinoImportacion.set(null);
    this.sincronizarDestinoImportacion();
  }

  private get fechaFocoImportacion(): string | null {
    const codigo = this.codigoImportacionSeleccionado();
    const fecha = this.previewImportacion()
      ?.hojas.find((hoja) => codigoPlantillaImportada(hoja.hoja) === codigo)
      ?.semanas.find((semana) => semana.bloques > 0)?.fechaInicio;
    return fecha ?? this.route.snapshot.queryParamMap.get('fechaFoco');
  }

  crearBorradorParaImportacion(): void {
    const variante = this.varianteImportacionSeleccionada;
    const codigoActivo = this.codigoImportacionSeleccionado();
    if (!variante || !codigoActivo) {
      this.toast.error('Selecciona primero la variante que quieres incorporar');
      return;
    }
    void this.router.navigate(
      ['/app/planificacion/planificacion-mensual', 'new'],
      {
        queryParams: {
          origen: 'importacion-plantillas',
          codigosHoja: this.codigosUltimaImportacion(),
          codigoActivo,
          fechaFoco: this.fechaFocoImportacion,
          oposicion: variante.oposicion,
          franja: variante.franja,
        },
      },
    );
  }

  incorporarSemanasEnPlanificacion(): void {
    const planificacionId = this.planificacionDestinoImportacion();
    if (
      !planificacionId ||
      !this.planificacionesBorradorOptions.some(
        (opcion) => opcion.value === planificacionId,
      )
    ) {
      this.toast.error('Selecciona un borrador compatible con la variante');
      return;
    }
    void this.router.navigate(
      ['/app/planificacion/planificacion-mensual', planificacionId],
      {
        queryParams: {
          codigosHoja: this.codigosUltimaImportacion(),
          codigoActivo: this.codigoImportacionSeleccionado(),
          fechaFoco: this.fechaFocoImportacion,
          origen: 'importacion-plantillas',
          abrirVolcado: '1',
        },
      },
    );
  }

  private async ejecutarAplicacionImportacion(): Promise<void> {
    const file = this.archivoImportacion();
    const preview = this.previewImportacion();
    if (!file || !preview) return;

    this.aplicandoImportacion.set(true);
    try {
      const resultado = await firstValueFrom(
        this.autoasignacionService.applyImportacionPlantillas$(
          file,
          preview.fileHash,
          preview.requiereConfirmacionSobrescritura &&
            this.confirmarSobrescritura(),
        ),
      );
      this.previewImportacion.set({
        ...preview,
        yaAplicado: true,
        requiereConfirmacionSobrescritura: false,
        requiereConfirmacionIndependientes: false,
      });
      this.resultadoImportacion.set(resultado);
      this.codigosUltimaImportacion.set(
        Array.from(
          new Set(
            preview.hojas
              .filter((hoja) => hoja.semanas.length > 0)
              .map((hoja) => codigoPlantillaImportada(hoja.hoja)),
          ),
        ),
      );
      this.codigoImportacionSeleccionado.set(
        this.codigosUltimaImportacion()[0] ?? null,
      );
      this.sincronizarDestinoImportacion();
      this.confirmarSobrescritura.set(false);
      this.toast.success(
        resultado.yaAplicado
          ? 'Este archivo ya estaba aplicado; no se ha escrito nada'
          : `Importación aplicada como versión ${resultado.version}`,
      );
    } catch (error) {
      this.previewImportacion.set(null);
      this.confirmarSobrescritura.set(false);
      this.toast.error(
        this.mensajeErrorImportacion(
          error,
          'No se pudo aplicar. Vuelve a previsualizar el archivo',
        ),
      );
    } finally {
      this.aplicandoImportacion.set(false);
    }
  }

  private sincronizarDestinoImportacion(): void {
    const opciones = this.planificacionesBorradorOptions;
    const seleccionActual = this.planificacionDestinoImportacion();
    if (
      seleccionActual &&
      opciones.some((opcion) => opcion.value === seleccionActual)
    ) {
      return;
    }
    this.planificacionDestinoImportacion.set(
      opciones.length === 1 ? opciones[0].value : null,
    );
  }

  private mensajeErrorImportacion(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      return error.error?.message ?? fallback;
    }
    return fallback;
  }
}
