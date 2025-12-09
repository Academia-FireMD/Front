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
  // @deprecated - Ya no se usa, redirige a login
  // El auto-registro desde WordPress crea usuarios directamente
  {
    path: 'activate-product',
    redirectTo: 'login',
    pathMatch: 'full'
  },
  // @deprecated - Ya no se usa, redirige a login
  {
    path: 'login-with-activation',
    redirectTo: 'login',
    pathMatch: 'full'
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
