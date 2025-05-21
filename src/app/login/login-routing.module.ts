import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ChangePasswordComponent } from './components/change-password/change-password.component';
import { LoginComponent } from './components/login/login.component';
import { RecuperarContrasenyaComponent } from './components/recuperar-contrasenya/recuperar-contrasenya.component';
import { RegistroComponent } from './components/registro/registro.component';

const routes: Routes = [
  {
    path: 'login',
    component: LoginComponent,
  },
  {
    path: 'registro',
    component: RegistroComponent,
  },
  {
    path: 'activate-subscription',
    component: RegistroComponent,
    data: { mode: 'activation' }
  },
  {
    path: 'recuperar-contrasenya',
    component: RecuperarContrasenyaComponent,
  },
  {
    path: 'reset-password',
    component: ChangePasswordComponent,
  },
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
  {
    path: '**',
    redirectTo: 'login',
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class LoginRoutingModule {}
