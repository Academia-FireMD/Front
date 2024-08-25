import { Component, inject } from '@angular/core';
import { FormBuilder, FormControl, Validators } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../services/auth.service';
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
  formGroup = this.fb.group(
    {
      email: ['', [Validators.email, Validators.required]],
      contrasenya: ['', [Validators.required, passwordStrengthValidator()]],
      repetirContrasenya: ['', [Validators.required]],
      relevancia: ['', Validators.required],
    },
    { validators: passwordMatchValidator }
  );
  public comunidades = Object.keys(Comunidad).map((entry) => {
    return {
      code: entry,
      ...comunidadConImagenNombreMap[entry],
    };
  });

  public get relevancia() {
    return this.formGroup.get('relevancia') as FormControl;
  }

  public showingInfoCard = false;

  public async register() {
    try {
      const res = await firstValueFrom(
        this.auth.register$(
          this.formGroup.value.email ?? '',
          this.formGroup.value.contrasenya ?? '',
          (this.formGroup.value.relevancia as Comunidad) ?? Comunidad.VALENCIA
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

  public updateCommunitySelection(communities: Comunidad[]) {
    console.log(communities);
  }
}
