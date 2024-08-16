import { Component, inject } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import {
  passwordMatchValidator,
  passwordStrengthValidator,
} from '../../../utils/validators';
import { AuthService } from '../../../services/auth.service';
import { firstValueFrom } from 'rxjs';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-registro',
  templateUrl: './registro.component.html',
  styleUrl: './registro.component.scss',
})
export class RegistroComponent {
  fb = inject(FormBuilder);
  auth = inject(AuthService);
  toast = inject(ToastrService);
  formGroup = this.fb.group(
    {
      email: ['', [Validators.email, Validators.required]],
      contrasenya: ['', [Validators.required, passwordStrengthValidator()]],
      repetirContrasenya: ['', [Validators.required]],
    },
    { validators: passwordMatchValidator }
  );

  public showingInfoCard = false;

  public async register() {
    try {
      const res = await firstValueFrom(
        this.auth.register$(
          this.formGroup.value.email ?? '',
          this.formGroup.value.contrasenya ?? ''
        )
      );
      this.toast.info(
        'El usuario con el email ' +
          (this.formGroup.value.email ?? '') +
          ' ha inicializado la petición de creación de cuenta.'
      );
      this.showingInfoCard = true;
    } catch (error) {
      console.error(error);
    }
  }
}
