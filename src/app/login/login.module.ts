import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';

import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { FloatLabelModule } from 'primeng/floatlabel';
import { InputTextModule } from 'primeng/inputtext';
import { SharedModule } from '../shared/shared.module';
import { ChangePasswordComponent } from './components/change-password/change-password.component';
import { LoginComponent } from './components/login/login.component';
import { RecuperarContrasenyaComponent } from './components/recuperar-contrasenya/recuperar-contrasenya.component';
import { RegistroComponent } from './components/registro/registro.component';
import { LoginRoutingModule } from './login-routing.module';
@NgModule({
  declarations: [LoginComponent, RecuperarContrasenyaComponent, ChangePasswordComponent],
  imports: [
    CommonModule,
    LoginRoutingModule,
    CardModule,
    InputTextModule,
    FormsModule,
    ReactiveFormsModule,
    FloatLabelModule,
    SharedModule,
    DropdownModule,
    CheckboxModule,
    DialogModule,
    RegistroComponent
  ],
  exports: [LoginComponent],
})
export class LoginModule {}
