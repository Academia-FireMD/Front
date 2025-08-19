import { Component, Input, Output, EventEmitter, forwardRef, input } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { MetodoCalificacion } from '../../models/user.model';

@Component({
  selector: 'app-metodo-calificacion-picker',
  templateUrl: './metodo-calificacion-picker.component.html',
  styleUrls: ['./metodo-calificacion-picker.component.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => MetodoCalificacionPickerComponent),
      multi: true
    }
  ]
})
export class MetodoCalificacionPickerComponent implements ControlValueAccessor {
  @Input() value: MetodoCalificacion | null = null;
  @Input() showClear: boolean = false;
  @Input() label: string = 'Método de calificación';
  @Input() placeholder: string = 'Seleccione un método de calificación';
  @Input() useFloatLabel: boolean = false;
  @Input() simplified = false;
  @Output() valueChange = new EventEmitter<MetodoCalificacion | null>();

  // ControlValueAccessor properties
  private onChange = (value: MetodoCalificacion | null) => {};
  private onTouched = () => {};
  disabled = false;

  public metodosCalificacion = [
    {
      value: 'A1_E1_3_B0',
      label: 'A1, E1/3, B0',
      descripcion: 'Aciertos suman 1, errores restan 1/3, blancas no penalizan',
    },
    {
      value: 'A1_E1_4_B0',
      label: 'A1, E1/4, B0',
      descripcion: 'Aciertos suman 1, errores restan 1/4, blancas no penalizan',
    },
  ];

  onValueChange(value: MetodoCalificacion | null) {
    this.value = value;
    this.valueChange.emit(value);
    this.onChange(value);
    this.onTouched();
  }

  // ControlValueAccessor implementation
  writeValue(value: MetodoCalificacion | null): void {
    this.value = value;
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }
}
