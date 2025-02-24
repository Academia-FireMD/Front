import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export function passwordMatchValidator(formGroup: AbstractControl): ValidationErrors | null {
  const password = formGroup.get('contrasenya')?.value;
  const confirmPassword = formGroup.get('repetirContrasenya')?.value;

  return password && confirmPassword && password !== confirmPassword
    ? { 'passwordsDontMatch': true }
    : null;
}

export function passwordStrengthValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;

    if (!value) {
      return null;
    }

    const hasUpperCase = /[A-Z]/.test(value);
    const hasLowerCase = /[a-z]/.test(value);
    const hasNumeric = /[0-9]/.test(value);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(value);
    const hasMinLength = value.length >= 8;

    const passwordValid =
      hasUpperCase &&
      hasLowerCase &&
      hasNumeric &&
      hasSpecialChar &&
      hasMinLength;

    return !passwordValid ? { 'passwordStrength': true } : null;
  };
}
