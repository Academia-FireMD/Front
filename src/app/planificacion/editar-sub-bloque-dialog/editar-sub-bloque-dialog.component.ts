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
import { AppConfigService } from '../../services/app-config.service';
import { ModuloApp } from '../../shared/models/modulo-app.enum';
import { SubBloque } from '../../shared/models/planificacion.model';
import { duracionOptions } from '../../utils/utils';
import {
  CatalogoFilaEditable,
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

  private aplicarPermisos() {
    if (this.role === 'ADMIN' || this.isAddingNew) {
      this.formGroup.enable({ emitEvent: false });
    } else {
      this.formGroup.disable({ emitEvent: false });
    }
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
}
