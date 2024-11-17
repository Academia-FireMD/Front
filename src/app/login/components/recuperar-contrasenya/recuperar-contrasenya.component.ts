import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-recuperar-contrasenya',
  templateUrl: './recuperar-contrasenya.component.html',
  styleUrl: './recuperar-contrasenya.component.scss',
})
export class RecuperarContrasenyaComponent {
  formGroup: FormGroup;
  message = '';
  requestSent = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    public toast: ToastrService
  ) {
    this.formGroup = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
    });
  }

  async requestPasswordReset() {
    if (this.formGroup.valid) {
      const email = this.formGroup.get('email')?.value;
      try {
        const solicitud = await firstValueFrom(
          this.authService.requestPasswordReset(email)
        );
        this.toast.success(
          'Revisa tu email para seguir las instrucciones de recuperación.'
        );
        this.requestSent = true;
      } catch (error) {
        this.toast.error('No se pudo procesar la solicitud.');
        this.requestSent = false;
      }
    }
  }
}
