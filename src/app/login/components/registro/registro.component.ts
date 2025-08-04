import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, EventEmitter, inject, Input, OnInit, Output } from '@angular/core';
import { FormBuilder, FormControl, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { DomSanitizer } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
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
import { comunidadConImagenNombreMap } from '../../../shared/comunidad-picker/comunidad-picker.component';
import { Comunidad } from '../../../shared/models/pregunta.model';
import { SharedModule } from '../../../shared/shared.module';
import { AsyncButtonComponent } from '../../../shared/components/async-button/async-button.component';
import {
  passwordMatchValidator,
  passwordStrengthValidator,
} from '../../../utils/validators';

interface RegistroTemporal {
  email: string;
  nombre: string;
  apellidos: string;
  woocommerceCustomerId: string;
  
  // Campos de suscripción
  planType?: string;
  monthlyPrice?: number;
  
  // Campos de consumible
  tipoRegistro: 'SUSCRIPCION' | 'CONSUMIBLE';
  tipoConsumible?: string;
  precio?: number;
  productId?: string;
  sku?: string;
}

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
    AsyncButtonComponent
  ]
})
export class RegistroComponent implements OnInit {
  fb = inject(FormBuilder);
  auth = inject(AuthService);
  toast = inject(ToastrService);
  router = inject(Router);
  route = inject(ActivatedRoute);
  http = inject(HttpClient);
  sanitizer = inject(DomSanitizer);
  users = inject(UserService);

  @Input() mode: 'default' | 'injected' | 'activation' = 'default';
  @Output() registroCompletado = new EventEmitter<{ email: string, password: string }>();

  tutores$ = this.users.getAllTutores$();
  registroTemporal: RegistroTemporal | null = null;
  isLoading = false;

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
      woocommerceCustomerId: [''],
      planType: ['']
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

  async ngOnInit() {
    // Obtener el modo de la ruta
    this.mode = this.route.snapshot.data['mode'] || this.mode;

    if (this.mode === 'activation') {
      const token = this.route.snapshot.queryParams['token'];
      if (token) {
        await this.cargarDatosTemporales(token);
      } else {
        this.toast.error('Token de activación no válido');
        this.router.navigate(['/auth/registro']);
      }
    }
  }

  private async cargarDatosTemporales(token: string) {
    try {
      this.isLoading = true;
      const response = await firstValueFrom(
        this.auth.registroTemporal$(token)
      );

      if (response) {
        this.registroTemporal = response;
        // Rellenar el formulario con los datos temporales
        this.formGroup.patchValue({
          email: response.email,
          nombre: response.nombre,
          apellidos: response.apellidos,
          woocommerceCustomerId: response.woocommerceCustomerId,
          planType: response.planType,
          relevancia: '' // Default, el usuario puede cambiarlo
        });

        // Deshabilitar el campo de email ya que viene de WooCommerce
        this.formGroup.get('email')?.disable();
      }
    } catch (error) {
      console.error('Error al cargar datos temporales:', error);
      this.toast.error('Error al cargar los datos de registro');
    } finally {
      this.isLoading = false;
    }
  }

  public async register() {
    try {
      const formValue = this.formGroup.getRawValue(); // getRawValue incluye campos disabled
      const email = formValue.email ?? '';
      const password = formValue.contrasenya ?? '';

      const res = await firstValueFrom(
        this.auth.register$(
          email ?? '',
          password ?? '',
          (formValue.relevancia as Comunidad) ?? Comunidad.VALENCIA,
          formValue.nombre ?? '',
          formValue.apellidos ?? '',
          formValue.tutor as any,
          formValue.woocommerceCustomerId ?? '', // Aseguramos que sea un string
          formValue.planType ?? '' // Aseguramos que sea un string
        )
      );

      

      // Emitir evento de registro completado con credenciales para login automático
      this.registroCompletado.emit({ email, password });

      if(this.mode == 'default'){
        this.toast.success(
          'Cuenta creada correctamente.'
        );
      }else if(this.mode == 'activation'){
        this.toast.success(
          'Producto activado correctamente.'
        );
      }

      if (this.mode === 'default' || this.mode === 'activation') {
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

  irALoginConActivacion() {
    const token = this.route.snapshot.queryParams['token'];
    this.router.navigate(['/auth/login-with-activation'], {
      queryParams: { token }
    });
  }
}
