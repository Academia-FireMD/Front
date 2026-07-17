import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { roleGuard } from './guards/auth/role.guard';
import { moduloGuard } from './guards/modulo.guard';
import { SubscriptionGuard } from './guards/subscription.guard';
import { superadminGuard } from './guards/superadmin.guard';
import { ProfileComponent } from './profile/profile.component';
import { LayoutComponent } from './shared/layout/layout.component';
import { ModuloApp } from './shared/models/modulo-app.enum';
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
    canActivate: [moduloGuard],
    data: { modulo: ModuloApp.SIMULACROS },
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
        path: 'superadmin',
        loadChildren: () =>
          import('./superadmin/superadmin.module').then(
            (m) => m.SuperadminModule,
          ),
        canActivate: [superadminGuard],
      },
      {
        path: 'test',
        loadChildren: () =>
          import('./test/test.module').then((m) => m.TestModule),
        canActivate: [moduloGuard],
        data: { modulo: ModuloApp.TEST },
      },
      {
        path: 'planificacion',
        loadChildren: () =>
          import('./planificacion/planificacion.module').then(
            (m) => m.PlanificacionModule,
          ),
        canActivate: [SubscriptionGuard, moduloGuard],
        data: {
          allowedSubscriptions: [
            SuscripcionTipo.ADVANCED,
            SuscripcionTipo.PREMIUM,
          ],
          modulo: ModuloApp.PLANIFICACION,
        },
      },
      {
        path: 'documentacion',
        loadChildren: () =>
          import('./documentacion/documentacion.module').then(
            (m) => m.DocumentacionModule,
          ),
        canActivate: [SubscriptionGuard, moduloGuard],
        data: {
          allowedSubscriptions: [
            SuscripcionTipo.BASIC,
            SuscripcionTipo.ADVANCED,
            SuscripcionTipo.PREMIUM,
          ],
          modulo: ModuloApp.DOCUMENTACION,
        },
      },
      {
        path: 'examen',
        loadChildren: () =>
          import('./examen/examen.module').then((m) => m.ExamenModule),
        canActivate: [SubscriptionGuard, moduloGuard],
        data: {
          allowedSubscriptions: [
            SuscripcionTipo.ADVANCED,
            SuscripcionTipo.PREMIUM,
          ],
          modulo: ModuloApp.EXAMEN,
        },
      },
      {
        path: 'horarios',
        loadChildren: () =>
          import('./horarios/horarios-routing.module').then((m) => m.routes),
        canActivate: [moduloGuard],
        data: { modulo: ModuloApp.HORARIOS },
      },
      {
        path: 'facturacion',
        loadChildren: () =>
          import('./facturacion/facturacion-routing.module').then(
            (m) => m.routes,
          ),
        canActivate: [moduloGuard],
        data: { modulo: ModuloApp.FACTURACION },
      },
      {
        path: 'cursos-admin',
        loadChildren: () =>
          import('./cursos/cursos-routing.module').then((m) => m.routes),
        canActivate: [moduloGuard],
        data: { modulo: ModuloApp.CURSOS },
      },
      {
        path: 'cursos',
        loadChildren: () =>
          import('./cursos/cursos-alumno.routes').then((m) => m.routes),
        canActivate: [moduloGuard],
        data: { modulo: ModuloApp.CURSOS },
      },
      {
        // Clases grabadas (2026-06-29): reutiliza MisCursosPageComponent (CQ1)
        // parametrizado por `data.tipo`. Acceso por suscripción + oposición
        // (no se compran), gateado por el mismo módulo CURSOS.
        path: 'clases-grabadas',
        loadComponent: () =>
          import('./cursos/alumno/mis-cursos-page.component').then(
            (m) => m.MisCursosPageComponent,
          ),
        canActivate: [moduloGuard],
        data: {
          modulo: ModuloApp.CURSOS,
          tipo: 'clases-grabadas',
          title: 'Clases grabadas',
        },
      },
      {
        path: 'simulacros-tienda',
        loadComponent: () =>
          import('./simulacros/tienda/tienda-simulacros.component').then(
            (m) => m.TiendaSimulacrosComponent,
          ),
        canActivate: [moduloGuard],
        data: { modulo: ModuloApp.SIMULACROS, title: 'Tienda de simulacros' },
      },
      {
        path: 'callejero',
        loadChildren: () =>
          import('./callejero/callejero.routes').then((m) => m.routes),
        canActivate: [moduloGuard, roleGuard],
        data: {
          modulo: ModuloApp.CALLEJERO,
          expectedRole: 'ALUMNO',
          title: 'Callejero',
        },
      },
      {
        // Planificación física: panel admin (Task 8, Fase 1a) + calendario y
        // detalle de día del alumno (Tasks 11/12, Fase 1b). Solo
        // `moduloGuard` aquí — el módulo mezcla ADMIN y ALUMNO, así que el
        // gate por rol vive por ruta hija en `planificacion-fisica.routes.ts`
        // (mismo patrón que `cursos-admin`, a diferencia de `callejero` que
        // es 100% alumno y sí usa roleGuard a este nivel).
        path: 'planificacion-fisica',
        loadChildren: () =>
          import('./planificacion-fisica/planificacion-fisica.routes').then(
            (m) => m.routes,
          ),
        canActivate: [moduloGuard],
        data: {
          modulo: ModuloApp.PLANIFICACION_FISICA,
          title: 'Planificación física',
        },
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
export class AppRoutingModule {}
