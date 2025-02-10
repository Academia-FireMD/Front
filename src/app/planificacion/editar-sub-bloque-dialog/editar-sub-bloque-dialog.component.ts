import { Component, EventEmitter, inject, Input, Output } from '@angular/core';
import { FormBuilder, FormControl, Validators } from '@angular/forms';
import { Editor } from '@toast-ui/editor';
import { cloneDeep, uniqueId } from 'lodash';
import { SubBloque } from '../../shared/models/planificacion.model';
@Component({
  selector: 'app-editar-sub-bloque-dialog',
  templateUrl: './editar-sub-bloque-dialog.component.html',
  styleUrl: './editar-sub-bloque-dialog.component.scss',
})
export class EditarSubBloqueDialogComponent {
  @Input() set data(data: any) {
    this.formGroup.patchValue(data);
    if (this.role == 'ADMIN') {
      this.formGroup.enable();
    } else {
      this.formGroup.disable();
      this.formGroup.get(['nombre', 'comentarios'])?.enable();
    }
    setTimeout(() => {
      this.initEditor(data?.comentarios ?? '');
    }, 0);
  }
  @Input() role: 'ADMIN' | 'ALUMNO' = 'ALUMNO';
  @Input() isDialogVisible = false;
  @Output() isDialogVisibleChange = new EventEmitter<boolean>();
  @Output() savedSubBloque = new EventEmitter<SubBloque>();
  editorComentarios!: any;
  fb = inject(FormBuilder);
  public formGroup = this.fb.group({
    duracion: [60, [Validators.required, Validators.min(1)]],
    nombre: ['', [Validators.required]],
    comentarios: [''],
    color: [''],
    siendoEditado: [false],
    controlId: [uniqueId()],
  });

  duracionOptions = [
    { label: '1 hora', value: 60 },
    { label: '2 horas', value: 120 },
    { label: '3 horas', value: 180 },
    { label: '4 horas', value: 240 },
    { label: '5 horas', value: 300 },
    { label: '6 horas', value: 360 },
  ];

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
  ];

  public get color() {
    return this.formGroup.get('color') as FormControl;
  }

  onColorTypeChange(event: any): void {
    const selectedColor = event.value; // Obtén el valor seleccionado del dropdown
    this.color.setValue(selectedColor, { emitEvent: true }); // Actualiza el control del formulario
  }

  ngOnInit(): void {
    this.initEditor('');
  }
  public cancelarEdicion() {
    this.isDialogVisible = false;
    this.isDialogVisibleChange.emit(false);
  }

  private initEditor(initialValueComentarios: string) {
    if (this.editorComentarios) {
      this.editorComentarios.destroy();
      this.editorComentarios = null;
    }
    if (!document.querySelector('#editor-comentarios')) return;
    this.editorComentarios = new Editor({
      el: document.querySelector('#editor-comentarios')!,
      height: '400px',
      initialEditType: 'markdown',
      previewStyle: 'vertical',
      autofocus: false,
      initialValue: initialValueComentarios || '',
      events: {
        change: () => {
          this.formGroup
            .get('comentarios')
            ?.patchValue(this.editorComentarios.getMarkdown());
        },
      },
    });
  }

  public guardarEdicion() {
    this.isDialogVisible = false;
    this.isDialogVisibleChange.emit(false);
    const value = cloneDeep(this.formGroup.value);
    this.savedSubBloque.emit(value as SubBloque);
  }
}
