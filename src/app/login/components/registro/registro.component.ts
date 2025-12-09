import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, EventEmitter, inject, Input, Output } from '@angular/core';
import { FormBuilder, FormControl, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { DomSanitizer } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { CardModule } from 'primeng/card';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { FloatLabelModule } from 'primeng/floatlabel';
import { InputTextModule } from 'primeng/inputtext';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { firstValueFrom, map } from 'rxjs';
import { AuthService } from '../../../services/auth.service';
import { UserService } from '../../../services/user.service';
import { AsyncButtonComponent } from '../../../shared/components/async-button/async-button.component';
import { SharedModule } from '../../../shared/shared.module';
import {
  passwordMatchValidator,
  passwordStrengthValidator,
} from '../../../utils/validators';

/**
 * Componente de registro simplificado.
 *
 * NOTA: El registro desde WordPress ahora es automático (auto-registro).
 * Los usuarios de WP se crean directamente cuando compran una suscripción.
 * Este componente se mantiene solo para:
 * - Registro manual de admins
 * - Casos edge de fallback
 */
@Component({
  selector: 'app-registro',
  templateUrl: './registro.component.html',
  styleUrl: './registro.component.scss',
  standalone: true,
  imports: [
    CommonModule,
    CardModule,
    InputTextModule,
    FormsModule,
    ReactiveFormsModule,
    FloatLabelModule,
    SharedModule,
    DropdownModule,
    CheckboxModule,
    DialogModule,
    ProgressSpinnerModule,
    AsyncButtonComponent,
  ]
})
export class RegistroComponent {
  fb = inject(FormBuilder);
  auth = inject(AuthService);
  toast = inject(ToastrService);
  router = inject(Router);
  http = inject(HttpClient);
  sanitizer = inject(DomSanitizer);
  users = inject(UserService);

  @Input() mode: 'default' | 'injected' = 'default';
  @Output() registroCompletado = new EventEmitter<{ email: string, password: string }>();

  tutores$ = this.users.getAllTutores$();

  formGroup = this.fb.group(
    {
      nombre: ['', Validators.required],
      apellidos: ['', Validators.required],
      email: ['', [Validators.email, Validators.required]],
      contrasenya: ['', [
        Validators.required,
        passwordStrengthValidator()
      ]],
      repetirContrasenya: ['', [Validators.required]],
      relevancia: [null as any, Validators.required],
      tutor: [],
      politicaDePrivacidadAceptada: [
        false,
        [Validators.required, Validators.requiredTrue],
      ],
    },
    { validators: passwordMatchValidator }
  );

  get contrasenya() {
    return this.formGroup.get('contrasenya');
  }

  get repetirContrasenya() {
    return this.formGroup.get('repetirContrasenya');
  }

  public get relevancia() {
    return this.formGroup.get('relevancia') as FormControl;
  }

  public get tutor() {
    return this.formGroup.get('tutor') as FormControl;
  }

  politica$ = this.http
    .get('privacidad.html', {
      responseType: 'text',
    })
    .pipe(map((res) => this.sanitizer.bypassSecurityTrustHtml(res)));

  public async register() {
    try {
      const formValue = this.formGroup.getRawValue();
      const email = formValue.email ?? '';
      const password = formValue.contrasenya ?? '';

      await firstValueFrom(
        this.auth.register$(
          email,
          password,
          formValue.nombre ?? '',
          formValue.apellidos ?? '',
          formValue.tutor as any,
        )
      );

      this.registroCompletado.emit({ email, password });

      this.toast.success('Cuenta creada correctamente.');

      if (this.mode === 'default') {
        setTimeout(() => {
          this.router.navigate(['/auth/login']);
        }, 0);
      }
    } catch (error) {
      console.error(error);
      this.toast.error('Error al crear la cuenta');
    }
  }

  politicaDialogVisible = false;

  openPoliticaDialog() {
    this.politicaDialogVisible = true;
  }

  closePoliticaDialog() {
    this.politicaDialogVisible = false;
  }
}
