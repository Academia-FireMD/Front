import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { FloatLabelModule } from 'primeng/floatlabel';
import { InputTextModule } from 'primeng/inputtext';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../services/auth.service';
import { AsyncButtonComponent } from '../../../shared/components/async-button/async-button.component';
import { SharedModule } from '../../../shared/shared.module';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    CardModule,
    InputTextModule,
    FormsModule,
    ReactiveFormsModule,
    FloatLabelModule,
    SharedModule,
    RouterModule,
    ButtonModule,
    AsyncButtonComponent
  ]
})
export class LoginComponent {
  formGroup: FormGroup;

  @Input() mode: 'default' | 'injected' = 'default';
  @Output() loginCompletado = new EventEmitter<void>();

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private router: Router,
    private toast: ToastrService
  ) {
    this.formGroup = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      contrasenya: ['', Validators.required]
    });
  }

  async login() {
    if (this.formGroup.valid) {
      try {
        const { email, contrasenya } = this.formGroup.value;
        await firstValueFrom(this.auth.login$(email, contrasenya));

        // Si estamos en modo injected, emitir evento de login completado
        if (this.mode === 'injected') {
          this.loginCompletado.emit();
        } else {
          // Continuar con el flujo normal de login
          this.router.navigate(['app/profile']);
        }
      } catch (error) {
        console.error('Login error:', error);
        this.toast.error('Error al iniciar sesión');
      }
    }
  }

  // Método para cambiar a registro (útil en modo injected)
  cambiarARegistro() {
    if (this.mode === 'default') {
      this.router.navigate(['/auth/registro']);
    } else {
      // Emitir un evento que el padre pueda capturar para cambiar la vista
      this.loginCompletado.emit();
    }
  }
}
