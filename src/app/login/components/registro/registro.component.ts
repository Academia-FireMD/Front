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
import { firstValueFrom, map } from 'rxjs';
import { AuthService } from '../../../services/auth.service';
import { UserService } from '../../../services/user.service';
import { comunidadConImagenNombreMap } from '../../../shared/comunidad-picker/comunidad-picker.component';
import { Comunidad } from '../../../shared/models/pregunta.model';
import { SharedModule } from '../../../shared/shared.module';
import {
  passwordMatchValidator,
  passwordStrengthValidator,
} from '../../../utils/validators';

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
  @Output() registroCompletado = new EventEmitter<{email: string, password: string}>();
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
      relevancia: ['', Validators.required],
      tutor: [],
      politicaDePrivacidadAceptada: [
        false,
        [Validators.required, Validators.requiredTrue],
      ],
    },
    { validators: passwordMatchValidator }
  );
  public comunidades = Object.keys(Comunidad).map((entry) => {
    return {
      code: entry,
      ...comunidadConImagenNombreMap[entry],
    };
  });

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
      const email = this.formGroup.value.email ?? '';
      const password = this.formGroup.value.contrasenya ?? '';

      const res = await firstValueFrom(
        this.auth.register$(
          email,
          password,
          (this.formGroup.value.relevancia as Comunidad) ?? Comunidad.VALENCIA,
          this.formGroup.value.nombre ?? '',
          this.formGroup.value.apellidos ?? '',
          this.formGroup.value.tutor as any
        )
      );

      this.toast.info(
        'El usuario con el email ' + email + ' ha inicializado la petición de creación de cuenta.'
      );

      // Emitir evento de registro completado con credenciales para login automático
      this.registroCompletado.emit({ email, password });

      if (this.mode === 'default') {
        setTimeout(() => {
          this.router.navigate(['/auth/login']);
        }, 0);
      }
    } catch (error) {
      console.error(error);
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
