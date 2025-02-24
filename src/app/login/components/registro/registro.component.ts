import { HttpClient } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { FormBuilder, FormControl, Validators } from '@angular/forms';
import { DomSanitizer } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { firstValueFrom, map } from 'rxjs';
import { AuthService } from '../../../services/auth.service';
import { UserService } from '../../../services/user.service';
import { comunidadConImagenNombreMap } from '../../../shared/comunidad-picker/comunidad-picker.component';
import { Comunidad } from '../../../shared/models/pregunta.model';
import {
  passwordMatchValidator,
  passwordStrengthValidator,
} from '../../../utils/validators';

@Component({
  selector: 'app-registro',
  templateUrl: './registro.component.html',
  styleUrl: './registro.component.scss',
})
export class RegistroComponent {
  fb = inject(FormBuilder);
  auth = inject(AuthService);
  toast = inject(ToastrService);
  router = inject(Router);
  http = inject(HttpClient);
  sanitizer = inject(DomSanitizer);
  users = inject(UserService);
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
      const res = await firstValueFrom(
        this.auth.register$(
          this.formGroup.value.email ?? '',
          this.formGroup.value.contrasenya ?? '',
          (this.formGroup.value.relevancia as Comunidad) ?? Comunidad.VALENCIA,
          this.formGroup.value.nombre ?? '',
          this.formGroup.value.apellidos ?? '',
          this.formGroup.value.tutor as any
        )
      );
      this.toast.info(
        'El usuario con el email ' +
          (this.formGroup.value.email ?? '') +
          ' ha inicializado la petición de creación de cuenta.'
      );
      setTimeout(() => {
        this.router.navigate(['/auth/login']);
      }, 0);
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
