import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { roleGuard } from '../guards/auth/role.guard';
import { SubscriptionGuard } from '../guards/subscription.guard';
import { SuscripcionTipo } from '../shared/models/subscription.model';
import { moduloGuard } from '../guards/modulo.guard';
import { ModuloApp } from '../shared/models/modulo-app.enum';
import { DocumentationOverviewComponent } from './documentation-overview/documentation-overview.component';
import { ReleaseManagementComponent } from './release-management/release-management.component';

const routes: Routes = [
  {
    path: 'alumno/librillo/:documentoId',
    canActivate: [roleGuard, moduloGuard],
    title: 'Estudiar con librillo',
    data: {
      expectedRole: 'ALUMNO',
      modulo: ModuloApp.LIBRILLOS,
      requiereFlag: true,
      recurso: 'librillo',
    },
    loadComponent: () =>
      import('../estudio/estudio-workspace.component').then(
        (m) => m.EstudioWorkspaceComponent,
      ),
  },
  {
    path: '',
    component: DocumentationOverviewComponent,
    canActivate: [roleGuard],
    title: 'Documentación',
    data: { expectedRole: 'ADMIN', title: 'Documentación' },
  },
  {
    path: 'alumno',
    component: DocumentationOverviewComponent,
    canActivate: [roleGuard, SubscriptionGuard],
    title: 'Documentación',
    data: {
      expectedRole: 'ALUMNO',
      title: 'Documentación',
      allowedSubscriptions: [
        SuscripcionTipo.BASIC,
        SuscripcionTipo.ADVANCED,
        SuscripcionTipo.PREMIUM,
      ],
    },
  },
  {
    path: 'publicaciones',
    component: ReleaseManagementComponent,
    canActivate: [roleGuard],
    title: 'Gestión de Publicaciones',
    data: { expectedRole: 'ADMIN', title: 'Publicaciones' },
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class DocumentacionRoutingModule {}
