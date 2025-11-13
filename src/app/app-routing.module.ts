import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SubscriptionGuard } from './guards/subscription.guard';
import { ProfileComponent } from './profile/profile.component';
import { LayoutComponent } from './shared/layout/layout.component';
import { SuscripcionTipo } from './shared/models/subscription.model';

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
        canActivate: [SubscriptionGuard],
        data: { allowedSubscriptions: [SuscripcionTipo.ADVANCED, SuscripcionTipo.PREMIUM] }
      },
      {
        path: 'documentacion',
        loadChildren: () =>
          import('./documentacion/documentacion.module').then(
            (m) => m.DocumentacionModule
          ),
        canActivate: [SubscriptionGuard],
        data: { allowedSubscriptions: [SuscripcionTipo.BASIC, SuscripcionTipo.ADVANCED, SuscripcionTipo.PREMIUM] }
      },
      {
        path: 'examen',
        loadChildren: () =>
          import('./examen/examen.module').then((m) => m.ExamenModule),
        canActivate: [SubscriptionGuard],
        data: { allowedSubscriptions: [SuscripcionTipo.ADVANCED, SuscripcionTipo.PREMIUM] }
      },
      {
        path: 'horarios',
        loadChildren: () =>
          import('./horarios/horarios.module').then((m) => m.HorariosModule),
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
