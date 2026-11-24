import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { roleGuard } from '../guards/auth/role.guard';
import { SubscriptionGuard } from '../guards/subscription.guard';
import { SuscripcionTipo } from '../shared/models/subscription.model';
import { moduloGuard } from '../guards/modulo.guard';
import { ModuloApp } from '../shared/models/modulo-app.enum';
import { DocumentationOverviewComponent } from './documentation-overview/documentation-overview.component';
import { ReleaseManagementComponent } from './release-management/release-management.component';
import { environment } from '../../environments/environment';
import type { EstudioWorkspaceComponent } from '../estudio/estudio-workspace.component';
import { previaLibrillosGuard } from '../estudio/previa/previa-librillos.guard';
import { TEMAS_PREVIA_LIBRILLOS } from '../estudio/previa/previa-librillos';

const rutasPrevia: Routes = environment.librillosMenu
  ? [
      {
        path: 'alumno/previa-librillos',
        canActivate: [roleGuard, SubscriptionGuard, previaLibrillosGuard],
        data: {
          expectedRole: 'ALUMNO',
          allowedSubscriptions: [
            SuscripcionTipo.BASIC,
            SuscripcionTipo.ADVANCED,
            SuscripcionTipo.PREMIUM,
          ],
        },
        title: 'Vista previa del Librillo',
        loadComponent: () =>
          import('../estudio/previa/previa-librillos.component').then(
            (m) => m.PreviaLibrillosComponent,
          ),
        children: [
          { path: '', redirectTo: 'estatutos', pathMatch: 'full' },
          {
            path: 'estatutos',
            data: {
              recurso: 'librillo',
              documentoIdPrevia: TEMAS_PREVIA_LIBRILLOS[0].documentoId,
            },
            canDeactivate: [
              async (visor: EstudioWorkspaceComponent) => {
                await visor.guardarAntesDeSalir();
                return true;
              },
            ],
            loadComponent: () =>
              import('../estudio/estudio-workspace.component').then(
                (m) => m.EstudioWorkspaceComponent,
              ),
          },
          {
            path: 'altura',
            loadComponent: () =>
              import('../estudio/previa/previa-librillos-pdf.component').then(
                (m) => m.PreviaLibrillosPdfComponent,
              ),
          },
        ],
      },
    ]
  : [];

const routes: Routes = [
  ...rutasPrevia,
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
