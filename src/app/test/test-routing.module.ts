import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { roleGuard } from '../guards/auth/role.guard';
import { AjustesAdminComponent } from './components/ajustes-admin/ajustes-admin.component';
import { CompletarTestComponent } from './components/completar-test/completar-test.component';
import { DashboardStatsComponent } from './components/dashboard-stats/dashboard-stats.component';
import { PreguntasDashboardAdminDetailviewComponent } from './components/preguntas-dashboard-admin-detailview/preguntas-dashboard-admin-detailview.component';
import { PreguntasDashboardAdminComponent } from './components/preguntas-dashboard-admin/preguntas-dashboard-admin.component';
import { RealizarTestComponent } from './components/realizar-test/realizar-test.component';
import { TestStatsComponent } from './components/test-stats/test-stats.component';
import { UserDashboardComponent } from './components/user-dashboard/user-dashboard.component';

const routes: Routes = [
  {
    path: 'user',
    component: UserDashboardComponent,
    canActivate: [roleGuard],
    title: 'Usuarios',
    data: { expectedRole: 'ADMIN', title: 'Usuarios' },
  },
  {
    path: 'preguntas',
    component: PreguntasDashboardAdminComponent,
    canActivate: [roleGuard],
    title: 'Preguntas',
    data: { expectedRole: 'ADMIN', title: 'Preguntas' },
  },
  {
    path: 'preguntas/:id',
    component: PreguntasDashboardAdminDetailviewComponent,
    canActivate: [roleGuard],
    title: 'Preguntas',
    data: { expectedRole: 'ADMIN', title: 'Preguntas' },
  },
  {
    path: 'ajustes',
    component: AjustesAdminComponent,
    canActivate: [roleGuard],
    data: { expectedRole: 'ADMIN' },
  },
  {
    path: 'alumno',
    children: [
      {
        path: 'realizar-test',
        component: RealizarTestComponent,
        canActivate: [roleGuard],
        data: { expectedRole: 'ALUMNO' },
      },
      {
        path: 'realizar-test/:id',
        component: CompletarTestComponent,
        canActivate: [roleGuard],
        data: { expectedRole: 'ALUMNO' },
      },
      {
        path: 'stats-test/:id',
        component: TestStatsComponent,
        canActivate: [roleGuard],
        data: { expectedRole: 'ALUMNO' },
      },
      {
        path: 'estadistica-dashboard',
        component: DashboardStatsComponent,
        canActivate: [roleGuard],
        data: { expectedRole: 'ALUMNO' },
      },
      {
        path: '',
        redirectTo: 'realizar-test',
        pathMatch: 'full',
      },
      {
        path: '**',
        redirectTo: 'realizar-test',
      },
    ],
  },
  {
    path: '',
    redirectTo: 'user',
    pathMatch: 'full',
  },
  {
    path: '**',
    redirectTo: 'user',
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class TestRoutingModule {}
