import { Component, inject } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  auth = inject(AuthService);
  toast = inject(ToastrService);
  fb = inject(FormBuilder);
  router = inject(Router);
  formGroup = this.fb.group({
    email: ['', [Validators.email]],
    contrasenya: ['', [Validators.required]],
  });

  ngOnInit(): void {
    this.auth.clearToken();
  }

  public async login() {
    try {
      const res = await firstValueFrom(
        this.auth.login$(
          this.formGroup.value.email ?? '',
          this.formGroup.value.contrasenya ?? ''
        )
      );
      this.router.navigate(['app/profile']);

    } catch (error) {
      console.error(error);
    }
  }
}
