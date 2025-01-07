import { Component, forwardRef, Input } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'app-password-input',
  templateUrl: './password-input.component.html',
  styleUrl: './password-input.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => PasswordInputComponent),
      multi: true,
    },
  ],
})
export class PasswordInputComponent implements ControlValueAccessor {
  passwordVisible = false;
  value: string = '';
  @Input() label: string = 'Contraseña'; // Propiedad para recibir un label desde afuera

  onChange: (value: string) => void = () => {};
  onTouched: () => void = () => {};

  togglePasswordVisibility() {
    this.passwordVisible = !this.passwordVisible;
  }

  onInputChange(event: Event) {
    const value = (event.target as any).value;
    this.value = value;
    this.onChange(value);
  }

  // Métodos para ControlValueAccessor
  writeValue(value: string): void {
    this.value = value || '';
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState?(isDisabled: boolean): void {
    // Opcional: manejar el estado deshabilitado si es necesario
  }
}
