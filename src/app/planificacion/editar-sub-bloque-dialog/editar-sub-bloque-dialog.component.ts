import { Component, EventEmitter, inject, Input, Output } from '@angular/core';
import { FormBuilder, FormControl, Validators } from '@angular/forms';
import { uniqueId } from 'lodash';
import { SubBloque } from '../../shared/models/planificacion.model';

@Component({
  selector: 'app-editar-sub-bloque-dialog',
  templateUrl: './editar-sub-bloque-dialog.component.html',
  styleUrl: './editar-sub-bloque-dialog.component.scss',
})
export class EditarSubBloqueDialogComponent {
  @Input() set data(data: any) {
    this.formGroup.patchValue(data);
  }
  @Input() isDialogVisible = false;
  @Output() isDialogVisibleChange = new EventEmitter<boolean>();
  @Output() savedSubBloque = new EventEmitter<SubBloque>();

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

  public get color() {
    return this.formGroup.get('color') as FormControl;
  }

  public inputColorChanged(event: Event) {
    this.color.patchValue((event.target as any)['value']);
  }

  public cancelarEdicion() {
    this.isDialogVisible = false;
    this.isDialogVisibleChange.emit(false);
  }

  public guardarEdicion() {
    this.isDialogVisible = false;
    this.isDialogVisibleChange.emit(false);
    this.savedSubBloque.emit(this.formGroup.value as SubBloque);
  }
}
