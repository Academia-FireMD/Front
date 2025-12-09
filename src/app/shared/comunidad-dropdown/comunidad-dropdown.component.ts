import { Component, forwardRef, Input } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { comunidades } from '../../utils/consts';
import { Comunidad } from '../models/pregunta.model';

@Component({
  selector: 'app-comunidad-dropdown',
  templateUrl: './comunidad-dropdown.component.html',
  styleUrl: './comunidad-dropdown.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => ComunidadDropdownComponent),
      multi: true,
    },
  ],
})
export class ComunidadDropdownComponent implements ControlValueAccessor {
  @Input() placeholder: string = 'Seleccionar comunidad';
  @Input() multiple: boolean = false;
  @Input() showClear: boolean = true;

  public value: any = null;
  public disabled: boolean = false;
  public map = comunidades;

  // Lista de comunidades geográficas de España
  public comunidades = Object.keys(Comunidad).map((entry) => ({
    code: entry as Comunidad,
    name: comunidades[entry as Comunidad]?.name || entry,
    image: comunidades[entry as Comunidad]?.image || '',
  }));

  // ControlValueAccessor implementation
  private onChange = (value: any) => { };
  private onTouched = () => { };

  writeValue(value: any): void {
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

  onValueChange(event: any): void {
    this.value = event.value;
    this.onChange(this.value);
    this.onTouched();
  }

  ngOnInit(): void {

  }
}
