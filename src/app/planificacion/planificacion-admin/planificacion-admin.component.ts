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
import { getISOWeekYear } from 'date-fns';
import { RouterLink } from '@angular/router';
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
  CargaSemanasPendiente,
  AvisoImportacionSemanas,
  ReglaOposicionAdmin,
  ResultadoImportacionPlantillas,
  ResultadoPublicacionSemanas,
  SemanaImportacionPlantilla,
  SemanaResultadoPublicacion,
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

interface SemanaCalendarioCarga {
  numero: number;
  lunes: string;
}

interface IntervaloSemanasIso {
  inicio: SemanaCalendarioCarga;
  fin: SemanaCalendarioCarga;
}

interface GrupoSemanasIso {
  anioIso: number;
  semanas: SemanaCalendarioCarga[];
  intervalos: IntervaloSemanasIso[];
}

interface TotalesPublicacionPerfil {
  creados: number;
  actualizados: number;
  omitidos: number;
  eliminados: number;
}

interface PerfilPublicacionResumen {
  codigo: string;
  etiqueta: string;
  planificacionId: number | null;
  semanas: SemanaResultadoPublicacion[];
  aniosIso: number[];
  totales: TotalesPublicacionPerfil;
  sinCambios: boolean;
}

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
    RouterLink,
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
  readonly resultadoPublicacion = signal<ResultadoPublicacionSemanas | null>(
    this.autoasignacionService.getResultadoPublicacionSesion?.() ?? null,
  );
  cargasPendientes = signal<CargaSemanasPendiente[]>([]);
  publicandoCarga = signal<number | null>(null);
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
    void this.cargarCargasPendientes();
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
    void this.cargarCargasPendientes();
  }

  async cargarCargasPendientes(): Promise<void> {
    try {
      this.cargasPendientes.set(
        await firstValueFrom(
          this.autoasignacionService.listarCargasPendientes$(),
        ),
      );
    } catch {
      this.errorCarga.set('No se pudieron consultar los cambios pendientes.');
    }
  }

  confirmarPublicacionCarga(id: number): void {
    if (this.publicandoCarga() !== null) return;
    this.confirmationService.confirm({
      header: 'Publicar semanas',
      message:
        'Los cambios de este Excel pasarán a las planificaciones actuales y los verán los alumnos. ¿Publicar ahora?',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Publicar cambios',
      rejectLabel: 'Volver',
      accept: () => void this.publicarCarga(id),
    });
  }

  async publicarCarga(id: number): Promise<void> {
    if (this.publicandoCarga() !== null) return;
    this.publicandoCarga.set(id);
    this.errorCarga.set(null);
    try {
      const resultado = await firstValueFrom(
        this.autoasignacionService.publicarCargaSemanas$(id),
      );
      // El resumen es el resultado de la sesión: debe sobrevivir al toast y a
      // cualquier fallo posterior al refrescar las listas.
      this.establecerResultadoPublicacion(resultado);
      this.resultadoCarga.set(null);
      this.previewImportacion.set(null);
      this.toast.success(resultado.mensaje);
      try {
        await Promise.all([this.cargarCargasPendientes(), this.cargarTodo()]);
      } catch {
        this.errorCarga.set(
          'Las semanas se publicaron, pero no se pudieron refrescar las listas. El resumen sigue disponible.',
        );
      }
    } catch (error) {
      const preview = this.previewImportacionDeError(error);
      if (
        error instanceof HttpErrorResponse &&
        error.status === 422 &&
        preview
      ) {
        // La revalidación al publicar puede descubrir errores que ya no están
        // en el Excel preparado. Se descarta el estado obsoleto, pero se
        // conserva el resumen de una publicación anterior si existía.
        this.previewCarga.set(null);
        this.resultadoCarga.set(null);
        this.previewImportacion.set(preview);
        this.confirmarSobrescritura.set(false);
        this.idempotencyKeyCarga = null;
        this.errorCarga.set(
          'No se publicó nada: el Excel pendiente ya no supera la validación. Revisa los errores localizados, descarta esta carga, corrige el archivo y vuelve a subirlo.',
        );
      } else {
        this.errorCarga.set(
          this.mensajeErrorImportacion(
            error,
            'No se pudieron publicar las semanas.',
          ),
        );
      }
    } finally {
      this.publicandoCarga.set(null);
    }
  }

  confirmarDescarteCarga(id: number): void {
    this.confirmationService.confirm({
      header: 'Descartar cambios pendientes',
      message:
        'Se descartará este Excel pendiente. Las planificaciones publicadas no cambiarán.',
      acceptLabel: 'Descartar',
      rejectLabel: 'Volver',
      accept: () => void this.descartarCarga(id),
    });
  }

  async descartarCarga(id: number): Promise<void> {
    if (this.publicandoCarga() !== null) return;
    this.publicandoCarga.set(id);
    try {
      await firstValueFrom(
        this.autoasignacionService.descartarCargaSemanas$(id),
      );
      this.resultadoCarga.set(null);
      this.toast.success('Cambios pendientes descartados.');
      await this.cargarCargasPendientes();
    } catch (error) {
      this.errorCarga.set(
        this.mensajeErrorImportacion(
          error,
          'No se pudieron descartar los cambios.',
        ),
      );
    } finally {
      this.publicandoCarga.set(null);
    }
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
    // Una planificación publicada es la identidad estable del perfil. No se
    // sustituye por otra copia al importar nuevas semanas.
    this.varianteForm.controls.codigo.disable({ emitEvent: false });
    this.varianteForm.controls.oposicion.disable({ emitEvent: false });
    this.varianteForm.controls.nivel.disable({ emitEvent: false });
    this.varianteForm.controls.franja.disable({ emitEvent: false });
    if (this.tienePlanPublicado(v))
      this.varianteForm.controls.planificacionMensualId.disable({
        emitEvent: false,
      });
    else
      this.varianteForm.controls.planificacionMensualId.enable({
        emitEvent: false,
      });
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
    this.varianteForm.controls.planificacionMensualId.enable({
      emitEvent: false,
    });
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
    this.establecerResultadoPublicacion(null);
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

  async previsualizarCargaSemanas(): Promise<void> {
    const file = this.archivoImportacion();
    if (!file) return;
    this.previsualizandoImportacion.set(true);
    this.resultadoCarga.set(null);
    this.previewCarga.set(null);
    this.previewImportacion.set(null);
    this.errorCarga.set(null);
    this.confirmarSobrescritura.set(false);
    this.idempotencyKeyCarga = null;
    try {
      const preview = await firstValueFrom(
        this.autoasignacionService.previewCargaSemanas$(file),
      );
      this.previewCarga.set(preview);
      this.idempotencyKeyCarga = preview.puedeAplicar
        ? (globalThis.crypto?.randomUUID?.() ??
          `${Date.now()}-${Math.random().toString(36).slice(2)}`)
        : null;
    } catch (error) {
      this.previewCarga.set(null);
      this.idempotencyKeyCarga = null;
      this.confirmarSobrescritura.set(false);
      const preview = this.previewImportacionDeError(error);
      if (preview) {
        this.previewImportacion.set(preview);
      } else {
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

  private previewImportacionDeError(
    error: unknown,
  ): PreviewImportacionPlantillas | null {
    if (!(error instanceof HttpErrorResponse)) return null;
    const preview = error.error?.preview;
    if (!preview || typeof preview !== 'object') return null;
    return preview as PreviewImportacionPlantillas;
  }

  async guardarCargaSemanas(): Promise<void> {
    if (this.aplicandoImportacion()) return;
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
          preview.previewHash,
          this.confirmarSobrescritura(),
          this.idempotencyKeyCarga,
        ),
      );
      this.resultadoCarga.set(resultado);
      this.previewCarga.set(null);
      this.toast.success(
        'Semanas preparadas. Los alumnos no ven cambios hasta que las publiques.',
      );
      await this.cargarCargasPendientes();
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 409) {
        this.previewCarga.set(null);
        this.confirmarSobrescritura.set(false);
        this.idempotencyKeyCarga = null;
      }
      const preview = this.previewImportacionDeError(error);
      if (preview) {
        this.previewCarga.set(null);
        this.resultadoCarga.set(null);
        this.previewImportacion.set(preview);
        this.confirmarSobrescritura.set(false);
        this.idempotencyKeyCarga = null;
      }
      this.toast.error(
        this.mensajeErrorImportacion(error, 'No se pudo guardar el Excel.'),
      );
    } finally {
      this.aplicandoImportacion.set(false);
    }
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

  contador(valor: number, singular: string, plural: string): string {
    return `${valor} ${valor === 1 ? singular : plural}`;
  }

  /**
   * Agrupa semanas por año ISO. Solo une semanas consecutivas dentro del
   * mismo año: un cambio de año o un hueco abre un intervalo nuevo para no
   * presentar como continuo un calendario que no lo es.
   */
  agruparSemanasPorAnioIso(
    semanas: ReadonlyArray<SemanaCalendarioCarga> | null | undefined,
  ): GrupoSemanasIso[] {
    const ordenadas = [...(semanas ?? [])]
      .filter(
        (semana) =>
          Number.isInteger(semana.numero) &&
          this.fechaCivilDesdeIso(semana.lunes) !== null,
      )
      .sort((a, b) => a.lunes.localeCompare(b.lunes));
    const grupos: GrupoSemanasIso[] = [];
    const vistas = new Set<string>();

    for (const semana of ordenadas) {
      const clave = `${semana.lunes}#${semana.numero}`;
      if (vistas.has(clave)) continue;
      vistas.add(clave);
      const fecha = this.fechaCivilDesdeIso(semana.lunes);
      if (!fecha) continue;
      const anioIso = getISOWeekYear(fecha);
      let grupo = grupos.at(-1);
      if (!grupo || grupo.anioIso !== anioIso) {
        grupo = { anioIso, semanas: [], intervalos: [] };
        grupos.push(grupo);
      }
      const anterior = grupo.semanas.at(-1);
      const intervalo = grupo.intervalos.at(-1);
      grupo.semanas.push(semana);
      if (
        anterior &&
        intervalo &&
        this.esSemanaSiguiente(anterior.lunes, semana.lunes)
      ) {
        intervalo.fin = semana;
      } else {
        grupo.intervalos.push({ inicio: semana, fin: semana });
      }
    }
    return grupos;
  }

  etiquetaIntervaloSemana(intervalo: IntervaloSemanasIso): string {
    const inicio = `Semana ${intervalo.inicio.numero} · ${this.formatearFechaIso(intervalo.inicio.lunes)}`;
    if (intervalo.inicio.lunes === intervalo.fin.lunes) return inicio;
    return `${inicio} – Semana ${intervalo.fin.numero} · ${this.formatearFechaIso(intervalo.fin.lunes)}`;
  }

  avisosPreviewImportacion(
    preview: PreviewImportacionPlantillas,
  ): AvisoImportacionSemanas[] {
    return preview.hojas.flatMap((hoja) => hoja.warnings ?? []);
  }

  get perfilesPublicacion(): PerfilPublicacionResumen[] {
    const resultado = this.resultadoPublicacion();
    if (!resultado) return [];
    const perfiles = new Map<string, PerfilPublicacionResumen>();

    for (const semana of resultado.semanas ?? []) {
      let perfil = perfiles.get(semana.codigo);
      if (!perfil) {
        perfil = {
          codigo: semana.codigo,
          etiqueta: this.etiquetaPerfilPublicado(semana.codigo, semana.hoja),
          planificacionId:
            resultado.variantes.find(
              (variante) => variante.codigo === semana.codigo,
            )?.planificacionId ?? null,
          semanas: [],
          aniosIso: [],
          totales: {
            creados: 0,
            actualizados: 0,
            omitidos: 0,
            eliminados: 0,
          },
          sinCambios: false,
        };
        perfiles.set(semana.codigo, perfil);
      }
      perfil.semanas.push(semana);
      perfil.totales.creados += semana.creados;
      perfil.totales.actualizados += semana.actualizados;
      perfil.totales.omitidos += semana.omitidos;
      perfil.totales.eliminados += semana.eliminados;
    }

    for (const perfil of perfiles.values()) {
      perfil.semanas.sort((a, b) => a.lunes.localeCompare(b.lunes));
      perfil.aniosIso = this.agruparSemanasPorAnioIso(
        perfil.semanas.map((semana) => ({
          numero: semana.semana,
          lunes: semana.lunes,
        })),
      ).map((grupo) => grupo.anioIso);
      const cambios =
        perfil.totales.creados +
        perfil.totales.actualizados +
        perfil.totales.eliminados;
      perfil.sinCambios = cambios === 0;
    }
    return [...perfiles.values()];
  }

  descartarResumenPublicacion(): void {
    this.establecerResultadoPublicacion(null);
  }

  private establecerResultadoPublicacion(
    resultado: ResultadoPublicacionSemanas | null,
  ): void {
    this.resultadoPublicacion.set(resultado);
    this.autoasignacionService.guardarResultadoPublicacionSesion?.(resultado);
  }

  private etiquetaPerfilPublicado(codigo: string, hoja: string): string {
    const variante = this.variantes().find((item) => item.codigo === codigo);
    if (variante) {
      return [
        this.labelOposicion(variante.oposicion),
        this.getNivelOposicionLabel(variante.nivel),
        this.getFranjaPlanificacionLabel(variante.franja),
      ].join(' · ');
    }
    const etiqueta = etiquetaVarianteImportada(hoja);
    return etiqueta === 'Variante sin identificar' ? codigo || hoja : etiqueta;
  }

  private esSemanaSiguiente(anterior: string, siguiente: string): boolean {
    const fechaAnterior = this.fechaCivilDesdeIso(anterior);
    const fechaSiguiente = this.fechaCivilDesdeIso(siguiente);
    if (!fechaAnterior || !fechaSiguiente) return false;
    return (
      Math.round(
        (fechaSiguiente.getTime() - fechaAnterior.getTime()) / 86_400_000,
      ) === 7
    );
  }

  /** Fecha civil local a partir de YYYY-MM-DD, sin reinterpretar UTC. */
  private fechaCivilDesdeIso(fecha: string): Date | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
    if (!match) return null;
    const resultado = new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
    );
    return Number.isNaN(resultado.getTime()) ? null : resultado;
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
