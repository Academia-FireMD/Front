import { Component, inject } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  fb = inject(FormBuilder);
  formGroup = this.fb.group({
    email: ['', [Validators.email]],
    contrasenya: ['', [Validators.required]],
  });
}
