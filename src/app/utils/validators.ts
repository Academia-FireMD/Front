import { ValidatorFn, AbstractControl, ValidationErrors } from '@angular/forms';

export const passwordMatchValidator: ValidatorFn = (
  control: AbstractControl
): ValidationErrors | null => {
  const password = control.get('contrasenya')?.value;
  const confirmPassword = control.get('repetirContrasenya')?.value;

  return password === confirmPassword ? null : { passwordsDontMatch: true };
};
