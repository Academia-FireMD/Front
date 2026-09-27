import {
  Component,
  computed,
  EventEmitter,
  inject,
  Input,
  Output,
} from '@angular/core';
import { FormBuilder, FormControl, Validators } from '@angular/forms';
import { cloneDeep, uniqueId } from 'lodash';
import { HttpErrorResponse } from '@angular/common/http';
import { AppConfigService } from '../../services/app-config.service';
import { PlanificacionesService } from '../../services/planificaciones.service';
import { ToastrService } from 'ngx-toastr';
import { ModuloApp } from '../../shared/models/modulo-app.enum';
import { SubBloque } from '../../shared/models/planificacion.model';
import { duracionOptions } from '../../utils/utils';
import {
  CatalogoContenidoItem,
  CatalogoFilaEditable,
  ComponerContenidoResponse,
  TipoTrabajoCatalogo,
} from '../models/catalogo-contenido.model';
import { CommonModule } from '@angular/common';
import { SharedModule } from '../../shared/shared.module';
import { SubBloqueMarkdownFieldComponent } from './sub-bloque-markdown-field.component';
import { POSIBLES_TIPOS_SUBBLOQUE } from '../sub-bloque-colores';

@Component({
  selector: 'app-editar-sub-bloque-dialog',
  standalone: true,
  imports: [CommonModule, SharedModule, SubBloqueMarkdownFieldComponent],
  templateUrl: './editar-sub-bloque-dialog.component.html',
  styleUrl: './editar-sub-bloque-dialog.component.scss',
})
export class EditarSubBloqueDialogComponent {
  @Input() modo: 'uso' | 'catalogo' = 'uso';
  @Input() catalogoFila: CatalogoFilaEditable | null = null;
  @Input() catalogoNuevo = false;
  @Input() catalogoPuedeAplicar = false;
  @Input() catalogoCargando = false;
  @Input() catalogoGuardando = false;
  @Output() catalogoChanged = new EventEmitter<void>();
  @Output() revisarCatalogo = new EventEmitter<void>();
  @Output() aplicarCatalogo = new EventEmitter<void>();

  private currentData: any;
  @Input() set data(data: any) {
    this.currentData = data;
    this.isAddingNew = !data?.id;
    // Forzamos el reset de esEntrenamientoFisico para que un payload antiguo
    // (o un nuevo evento sin ese campo) no herede el valor del diálogo anterior.
    this.formGroup.patchValue({
      ...data,
      esEntrenamientoFisico: !!data?.esEntrenamientoFisico,
      catalogoContenidoId: data?.catalogoContenidoId ?? null,
      tipoTrabajoPlanificacion: data?.tipoTrabajoPlanificacion ?? null,
    });
    this.tipoTrabajoSeleccionado = data?.tipoTrabajoPlanificacion ?? null;
    this.catalogoItemSeleccionado = null;
    //Si data.id es falsey, significa que el alumno está intentando crear un evento, cosa que está permitida
    this.aplicarPermisos();
  }

  private _role: 'ADMIN' | 'ALUMNO' = 'ALUMNO';
  @Input() set role(value: 'ADMIN' | 'ALUMNO') {
    this._role = value;
    if (this.currentData !== undefined) this.aplicarPermisos();
  }
  get role(): 'ADMIN' | 'ALUMNO' {
    return this._role;
  }
  @Input() set isDialogVisible(value: boolean) {
    this._isDialogVisible = value;
  }

  get isDialogVisible(): boolean {
    return this._isDialogVisible;
  }

  private _isDialogVisible = false;
  @Output() isDialogVisibleChange = new EventEmitter<boolean>();
  @Output() savedSubBloque = new EventEmitter<SubBloque>();

  public isAddingNew = false;
  public isRoleAdminOrAddingNew = () =>
    this.role == 'ADMIN' || this.isAddingNew;

  fb = inject(FormBuilder);
  appConfigService = inject(AppConfigService);
  planificacionesService = inject(PlanificacionesService);
  toastrService = inject(ToastrService);
  planificacionFisicaHabilitada = computed(
    () =>
      this.appConfigService.estadoModulos()[ModuloApp.PLANIFICACION_FISICA] !==
      false,
  );
  public formGroup = this.fb.group({
    catalogoContenidoId: [null as number | null],
    tipoTrabajoPlanificacion: [null as TipoTrabajoCatalogo | null],
    duracion: [60, [Validators.required, Validators.min(1)]],
    nombre: ['', [Validators.required]],
    comentarios: [''],
    color: [''],
    siendoEditado: [false],
    controlId: [uniqueId()],
    importante: [false],
    tiempoAviso: [null],
    esEntrenamientoFisico: [false],
  });

  duracionOptions = duracionOptions;

  posiblesTipos = POSIBLES_TIPOS_SUBBLOQUE;

  tiempoAvisoOptions = [
    { label: '15 minutos', value: 15 },
    { label: '30 minutos', value: 30 },
    { label: '1 hora', value: 60 },
    { label: '2 horas', value: 120 },
    { label: '1 día', value: 1440 },
    { label: '2 días', value: 2880 },
  ];

  catalogoSugerencias: CatalogoContenidoItem[] = [];
  tipoTrabajoSeleccionado: TipoTrabajoCatalogo | null = null;
  catalogoItemSeleccionado: CatalogoContenidoItem | null = null;

  get contenidoVinculado(): boolean {
    return !!this.formGroup.get('catalogoContenidoId')?.value;
  }

  private bloquearContenidoVinculado() {
    for (const campo of ['nombre', 'comentarios', 'color'])
      this.formGroup.get(campo)?.disable({ emitEvent: false });
  }

  private aplicarPermisos() {
    if (this.role === 'ADMIN' || this.isAddingNew) {
      this.formGroup.enable({ emitEvent: false });
      if (this.currentData?.catalogoContenidoId && this.role === 'ADMIN') {
        this.bloquearContenidoVinculado();
        this.planificacionesService
          .listarCatalogoContenido()
          .subscribe((catalogo) => {
            this.catalogoItemSeleccionado =
              catalogo.filas.find(
                (item) => item.id === this.currentData.catalogoContenidoId,
              ) ?? null;
          });
      }
    } else {
      this.formGroup.disable({ emitEvent: false });
      if (!this.currentData?.catalogoContenidoId) {
        this.formGroup
          .get(['nombre', 'comentarios'])
          ?.enable({ emitEvent: false });
      }
    }
  }

  desvincularCatalogo() {
    this.formGroup.patchValue({
      catalogoContenidoId: null,
      tipoTrabajoPlanificacion: null,
    });
    for (const campo of ['nombre', 'comentarios', 'color'])
      this.formGroup.get(campo)?.enable({ emitEvent: false });
    this.catalogoItemSeleccionado = null;
    this.tipoTrabajoSeleccionado = null;
  }

  tipoTrabajoOptions: { label: string; value: TipoTrabajoCatalogo | null }[] = [
    { label: 'Sin tipo (bloque especial)', value: null },
    { label: 'ESTUDIO', value: 'ESTUDIO' },
    { label: 'R1', value: 'R1' },
    { label: 'R2', value: 'R2' },
    { label: 'R3', value: 'R3' },
    { label: 'R4', value: 'R4' },
    { label: 'R5', value: 'R5' },
  ];

  /** Visible solo para ADMIN y cuando el bloque NO es entrenamiento físico. */
  get mostrarSeccionCatalogo(): boolean {
    return (
      this.role === 'ADMIN' &&
      !this.formGroup.get('esEntrenamientoFisico')?.value
    );
  }

  /** Texto explicativo que ve el admin cuando marca el sub-bloque como
   * entrenamiento físico (Fase 1 claridad bridge). */
  get textoExplicativoFisica(): string {
    return 'El alumno verá este bloque en su temario con las disciplinas reales del día y su estado de progreso, leídas en vivo del módulo de planificación física. Al hacer click, irá al detalle del entrenamiento de ese día.';
  }

  public get color() {
    return this.formGroup.get('color') as FormControl;
  }

  public get importante() {
    return this.formGroup.get('importante') as FormControl;
  }

  public get tiempoAviso() {
    return this.formGroup.get('tiempoAviso') as FormControl;
  }

  onColorTypeChange(event: any): void {
    const selectedColor = event.value; // Obtén el valor seleccionado del dropdown
    this.color.setValue(selectedColor, { emitEvent: true }); // Actualiza el control del formulario
  }

  public cancelarEdicion() {
    this.isDialogVisible = false;
    this.isDialogVisibleChange.emit(false);
  }

  public async guardarEdicion() {
    this.isDialogVisible = false;
    this.isDialogVisibleChange.emit(false);
    const value = cloneDeep(this.formGroup.getRawValue());
    // El diálogo devuelve los campos editables; el calendario aporta ID y hora.
    this.savedSubBloque.emit(value as unknown as SubBloque);
    return Promise.resolve();
  }

  buscarCatalogoContenido(query: string): void {
    if (!query || query.trim().length === 0) {
      this.catalogoSugerencias = [];
      return;
    }
    this.planificacionesService
      .buscarCatalogoContenido(query.trim())
      .subscribe((items) => {
        this.catalogoSugerencias = items ?? [];
      });
  }

  rellenarDesdeCatalogo(): void {
    const codigo = this.catalogoItemSeleccionado?.codigo;
    if (!codigo) {
      return;
    }

    this.planificacionesService
      .componerContenidoCatalogo(
        codigo,
        this.tipoTrabajoSeleccionado ?? undefined,
      )
      .subscribe({
        next: (res: ComponerContenidoResponse) => {
          this.formGroup.patchValue({
            catalogoContenidoId: this.catalogoItemSeleccionado!.id,
            tipoTrabajoPlanificacion: this.tipoTrabajoSeleccionado,
            nombre: res.nombre,
            color: res.color,
            comentarios: res.comentarios,
          });
          this.bloquearContenidoVinculado();
          this.toastrService.success('Subbloque vinculado al catálogo');
        },
        error: (err: HttpErrorResponse | Error) => {
          const status =
            err instanceof HttpErrorResponse ? err.status : undefined;
          if (status === 404) {
            this.toastrService.error('Código no encontrado en el catálogo');
          }
          // Otros errores se dejan a ApiBaseService.handleError
          // (llamada con ignoreError=true para poder personalizar el 404).
        },
      });
  }

  ngOnInit(): void {
    // Additional initialization logic if needed
  }
}
