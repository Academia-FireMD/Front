import { Component, Input, forwardRef } from '@angular/core';
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

  public comunidades = [
    { code: Comunidad.MADRID, name: 'Madrid', image: 'comunidades/MADRID.png' },
    { code: Comunidad.VALENCIA, name: 'Valencia', image: 'comunidades/VALENCIA.png' },
    { code: Comunidad.MURCIA, name: 'Murcia', image: 'comunidades/MURCIA.png' },
    { code: Comunidad.CANARIAS, name: 'Canarias', image: 'comunidades/CANARIAS.png' },
    { code: Comunidad.CEUTA, name: 'Ceuta', image: 'comunidades/CEUTA.png' },
    { code: Comunidad.MELILLA, name: 'Melilla', image: 'comunidades/MELILLA.png' },
    { code: Comunidad.GALICIA, name: 'Galicia', image: 'comunidades/GALICIA.png' },
    { code: Comunidad.ASTURIAS, name: 'Asturias', image: 'comunidades/ASTURIAS.png' },
    { code: Comunidad.VASCO, name: 'País Vasco', image: 'comunidades/VASCO.png' },
    { code: Comunidad.NAVARRA, name: 'Navarra', image: 'comunidades/NAVARRA.png' },
    { code: Comunidad.BALEARES, name: 'Baleares', image: 'comunidades/BALEARES.png' },
    { code: Comunidad.ANDALUCIA, name: 'Andalucía', image: 'comunidades/ANDALUCIA.png' },
    { code: Comunidad.ARAGON, name: 'Aragón', image: 'comunidades/ARAGON.png' },
    { code: Comunidad.CASTILLALAMANCHA, name: 'Castilla-La Mancha', image: 'comunidades/CASTILLALAMANCHA.png' },
    { code: Comunidad.CASTILLAYLEON, name: 'Castilla y León', image: 'comunidades/CASTILLAYLEON.png' },
    { code: Comunidad.CATALUNYA, name: 'Cataluña', image: 'comunidades/CATALUNYA.png' },
    { code: Comunidad.EXTREMADURA, name: 'Extremadura', image: 'comunidades/EXTREMADURA.png' },
  ];

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
