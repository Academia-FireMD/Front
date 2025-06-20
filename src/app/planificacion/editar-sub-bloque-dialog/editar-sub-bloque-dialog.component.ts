import { Component, EventEmitter, inject, Input, Output, ViewChild, ElementRef, OnDestroy, AfterViewInit, OnInit } from '@angular/core';
import { FormBuilder, FormControl, Validators } from '@angular/forms';
import { Editor } from '@toast-ui/editor';
import { cloneDeep, uniqueId } from 'lodash';
import { SubBloque } from '../../shared/models/planificacion.model';
import { duracionOptions, universalEditorConfig } from '../../utils/utils';

@Component({
  selector: 'app-editar-sub-bloque-dialog',
  templateUrl: './editar-sub-bloque-dialog.component.html',
  styleUrl: './editar-sub-bloque-dialog.component.scss',
})
export class EditarSubBloqueDialogComponent implements OnDestroy, AfterViewInit, OnInit {
  @Input() set data(data: any) {
    this.isAddingNew = !data?.id;
    this.formGroup.patchValue(data);
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
  public formGroup = this.fb.group({
    duracion: [60, [Validators.required, Validators.min(1)]],
    nombre: ['', [Validators.required]],
    comentarios: [''],
    color: [''],
    siendoEditado: [false],
    controlId: [uniqueId()],
    importante: [false],
    tiempoAviso: [null]
  });

  duracionOptions = duracionOptions;

  posiblesTipos = [
    {
      label: 'Entrenamiento',
      value: '#fdd6b3', // Naranja pastel
    },
    {
      label: 'Específico SPEIS',
      value: '#b8fcd1', // Verde menta
    },
    {
      label: 'General',
      value: '#b8f6fb', // Azul cielo
    },
    {
      label: 'Específico',
      value: '#fbf3c0', // Amarillo suave
    },
    {
      label: 'Psicotécnico',
      value: '#f7d794', // Amarillo más fuerte
    },
    {
      label: 'Varios',
      value: '#ffffff', // Blanco
    },
    {
      label: 'Examen',
      value: '#ffcdd2', // Rojo suave
    },
  ];

  tiempoAvisoOptions = [
    { label: '15 minutos', value: 15 },
    { label: '30 minutos', value: 30 },
    { label: '1 hora', value: 60 },
    { label: '2 horas', value: 120 },
    { label: '1 día', value: 1440 },
    { label: '2 días', value: 2880 },
  ];

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
    const editorElement = document.querySelector(`#editor-comentarios-${controlId}`);
    
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

  public guardarEdicion() {
    this.isDialogVisible = false;
    this.isDialogVisibleChange.emit(false);
    const value = cloneDeep(this.formGroup.value);
    this.savedSubBloque.emit(value as SubBloque);
  }

  ngOnInit(): void {
    // Additional initialization logic if needed
  }
}
