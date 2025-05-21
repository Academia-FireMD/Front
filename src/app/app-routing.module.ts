import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ProfileComponent } from './profile/profile.component';
import { LayoutComponent } from './shared/layout/layout.component';

const routes: Routes = [
  {
    path: 'auth',
    loadChildren: () =>
      import('./login/login.module').then((m) => m.LoginModule),
  },
  {
    path: 'simulacros',
    loadChildren: () =>
      import('./simulacros/simulacros.module').then((m) => m.SimulacrosModule),
  },
  {
    path: 'app',
    component: LayoutComponent,
    children: [
      {
        path: 'profile',
        component: ProfileComponent,
      },
      {
        path: 'test',
        loadChildren: () =>
          import('./test/test.module').then((m) => m.TestModule),
      },
      {
        path: 'planificacion',
        loadChildren: () =>
          import('./planificacion/planificacion.module').then(
            (m) => m.PlanificacionModule
          ),
      },
      {
        path: 'documentacion',
        loadChildren: () =>
          import('./documentacion/documentacion.module').then(
            (m) => m.DocumentacionModule
          ),
      },
      {
        path: 'examen',
        loadChildren: () =>
          import('./examen/examen.module').then((m) => m.ExamenModule),
      },
    ],
  },
  {
    path: '',
    redirectTo: 'auth',
    pathMatch: 'full',
  },
  {
    path: '**',
    redirectTo: 'auth',
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule { }
