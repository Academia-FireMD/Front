import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-change-password',
  templateUrl: './change-password.component.html',
  styleUrl: './change-password.component.scss',
})
export class ChangePasswordComponent {
  formGroup: FormGroup;
  token!: string;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private authService: AuthService,
    private router: Router,
    public toast: ToastrService
  ) {
    this.formGroup = this.fb.group({
      newPassword: ['', [Validators.required]],
    });
  }

  ngOnInit() {
    this.token = this.route.snapshot.queryParams['token'];
  }

  async resetPassword() {
    if (this.formGroup.valid) {
      const newPassword = this.formGroup.get('newPassword')?.value;
      try {
        await firstValueFrom(
          this.authService.resetPassword(this.token, newPassword)
        );
        this.toast.success('Contraseña restablecida exitosamente.');
        this.router.navigate(['/auth/login']);
      } catch (error) {
        this.toast.error('No se pudo restablecer la contraseña.');
      }
    }
  }
}
