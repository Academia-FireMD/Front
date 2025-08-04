import { Component, Input, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { Comunidad } from '../models/pregunta.model';

export const comunidadConImagenNombreMap = {
  [Comunidad.MADRID]: {
    image: 'comunidades/MADRID.png',
    name: 'Madrid',
  },
  [Comunidad.VALENCIA]: {
    image: 'comunidades/VLC.png',
    name: 'Valencia',
  },
  [Comunidad.MURCIA]: {
    image: 'comunidades/MURCIA.jpg',
    name: 'Murcia',
  },
} as any;

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
  public map = comunidadConImagenNombreMap;

  public comunidades = [
    { code: Comunidad.MADRID, name: 'Madrid', image: 'comunidades/MADRID.png' },
    { code: Comunidad.VALENCIA, name: 'Valencia', image: 'comunidades/VLC.png' },
    { code: Comunidad.MURCIA, name: 'Murcia', image: 'comunidades/MURCIA.jpg' },
  ];

  // ControlValueAccessor implementation
  private onChange = (value: any) => {};
  private onTouched = () => {};

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
} 