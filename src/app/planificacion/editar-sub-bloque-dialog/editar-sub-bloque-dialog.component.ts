import {
  Component,
  computed,
  EventEmitter,
  inject,
  Input,
  Output,
  ViewChild,
  ElementRef,
  OnDestroy,
  AfterViewInit,
  OnInit,
} from '@angular/core';
import { FormBuilder, FormControl, Validators } from '@angular/forms';
import { Editor } from '@toast-ui/editor';
import { cloneDeep, uniqueId } from 'lodash';
import { HttpErrorResponse } from '@angular/common/http';
import { AppConfigService } from '../../services/app-config.service';
import { PlanificacionesService } from '../../services/planificaciones.service';
import { ToastrService } from 'ngx-toastr';
import { ModuloApp } from '../../shared/models/modulo-app.enum';
import { SubBloque } from '../../shared/models/planificacion.model';
import { duracionOptions, universalEditorConfig } from '../../utils/utils';
import { POSIBLES_TIPOS_SUBBLOQUE } from '../sub-bloque-colores';
import {
  CatalogoContenidoItem,
  ComponerContenidoResponse,
  TipoTrabajoCatalogo,
} from '../models/catalogo-contenido.model';

@Component({
  selector: 'app-editar-sub-bloque-dialog',
  templateUrl: './editar-sub-bloque-dialog.component.html',
  styleUrl: './editar-sub-bloque-dialog.component.scss',
})
export class EditarSubBloqueDialogComponent
  implements OnDestroy, AfterViewInit, OnInit
{
  @Input() set data(data: any) {
    this.isAddingNew = !data?.id;
    // Forzamos el reset de esEntrenamientoFisico para que un payload antiguo
    // (o un nuevo evento sin ese campo) no herede el valor del diálogo anterior.
    this.formGroup.patchValue({
      ...data,
      esEntrenamientoFisico: !!data?.esEntrenamientoFisico,
    });
    //Si data.id es falsey, significa que el alumno está intentando crear un evento, cosa que está permitida
    if (this.role == 'ADMIN' || this.isAddingNew) {
      this.formGroup.enable();
    } else {
      this.formGroup.disable();
      this.formGroup.get(['nombre', 'comentarios'])?.enable();
    }

    // Esperar a que el diálogo esté visible y el DOM actualizado
    if (this.isDialogVisible) {
      setTimeout(() => {
        this.initEditor(data?.comentarios ?? '');
      }, 100);
    }
  }

  @Input() role: 'ADMIN' | 'ALUMNO' = 'ALUMNO';
  @Input() set isDialogVisible(value: boolean) {
    this._isDialogVisible = value;
    if (value) {
      // Pequeño delay para asegurar que el DOM esté listo
      setTimeout(() => {
        const currentData = this.formGroup.value;
        this.initEditor(currentData.comentarios ?? '');
      }, 100);
    } else {
      this.destroyEditor();
    }
  }

  get isDialogVisible(): boolean {
    return this._isDialogVisible;
  }

  private _isDialogVisible = false;
  @Output() isDialogVisibleChange = new EventEmitter<boolean>();
  @Output() savedSubBloque = new EventEmitter<SubBloque>();

  editorComentarios!: any;
  private editorInitialized = false;
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

  ngAfterViewInit(): void {
    // Inicialización movida al setter de isDialogVisible para mejor timing
  }

  ngOnDestroy(): void {
    this.destroyEditor();
  }

  public cancelarEdicion() {
    this.isDialogVisible = false;
    this.isDialogVisibleChange.emit(false);
  }

  private destroyEditor(): void {
    if (this.editorComentarios) {
      try {
        this.editorComentarios.destroy();
      } catch (error) {
        console.warn('Error destroying editor:', error);
      } finally {
        this.editorComentarios = null;
        this.editorInitialized = false;
      }
    }
  }

  private initEditor(initialValueComentarios: string): void {
    // Destruir editor existente si hay uno
    this.destroyEditor();

    const controlId = this.formGroup.get('controlId')?.value;
    const editorElement = document.querySelector(
      `#editor-comentarios-${controlId}`,
    );

    if (!editorElement) {
      console.warn('Editor element not found, retrying...');
      // Retry after a short delay
      setTimeout(() => {
        this.initEditor(initialValueComentarios);
      }, 50);
      return;
    }

    try {
      this.editorComentarios = new Editor({
        el: editorElement,
        ...universalEditorConfig,
        initialValue: initialValueComentarios || '',
        events: {
          change: () => {
            if (this.editorComentarios && this.editorInitialized) {
              try {
                const markdown = this.editorComentarios.getMarkdown();
                this.formGroup.get('comentarios')?.patchValue(markdown);
              } catch (error) {
                console.warn('Error getting markdown from editor:', error);
              }
            }
          },
        },
      });
      this.editorInitialized = true;
    } catch (error) {
      console.error('Error initializing editor:', error);
      this.editorInitialized = false;
    }
  }

  public async guardarEdicion() {
    this.isDialogVisible = false;
    this.isDialogVisibleChange.emit(false);
    const value = cloneDeep(this.formGroup.value);
    this.savedSubBloque.emit(value as SubBloque);
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
            nombre: res.nombre,
            color: res.color,
            comentarios: res.comentarios,
          });
          if (this.editorComentarios) {
            this.editorComentarios.setMarkdown(res.comentarios ?? '');
          }
          this.toastrService.success('Bloque rellenado desde catálogo');
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
