import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { CardModule } from 'primeng/card';
import { FloatLabelModule } from 'primeng/floatlabel';
import { InputTextModule } from 'primeng/inputtext';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../services/auth.service';
import { SharedModule } from '../../../shared/shared.module';
import { ButtonModule } from 'primeng/button';
import { AsyncButtonComponent } from '../../../shared/components/async-button/async-button.component';

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
export class LoginComponent implements OnInit {
  formGroup: FormGroup;
  activationToken: string | null = null;

  @Input() mode: 'default' | 'injected' = 'default';
  @Output() loginCompletado = new EventEmitter<void>();

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private toast: ToastrService
  ) {
    this.formGroup = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      contrasenya: ['', Validators.required]
    });
  }

  ngOnInit() {
    // Verificar si estamos en modo activación
    if (this.route.snapshot.data['activationMode']) {
      this.activationToken = this.route.snapshot.queryParams['token'];
      if (!this.activationToken) {
        this.toast.error('Token de activación no válido');
        this.router.navigate(['/auth/login']);
      }
    }
  }

  async login() {
    if (this.formGroup.valid) {
      try {
        const { email, contrasenya } = this.formGroup.value;
        await firstValueFrom(this.auth.login$(email, contrasenya));
        const user = await firstValueFrom(this.auth.currentUser$);

        // Si hay un token de activación, activar el consumible
        if (this.activationToken && user?.id) {
          try {
            await firstValueFrom(
              this.auth.activateConsumible$(this.activationToken, user.id)
            );
            this.toast.success('Producto activado correctamente');
          } catch (error) {
            this.toast.error('Error al activar el producto');
            console.error('Error activating consumible:', error);
            return;
          }
        }

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
