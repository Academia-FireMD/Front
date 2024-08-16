import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { roleGuard } from '../guards/auth/role.guard';
import { PreguntasDashboardAdminComponent } from './components/preguntas-dashboard-admin/preguntas-dashboard-admin.component';
import { RealizarTestComponent } from './components/realizar-test/realizar-test.component';
import { UserDashboardComponent } from './components/user-dashboard/user-dashboard.component';

const routes: Routes = [
  {
    path: 'user',
    component: UserDashboardComponent,
    canActivate: [roleGuard],
    data: { expectedRole: 'ADMIN' },
  },
  {
    path: 'preguntas',
    component: PreguntasDashboardAdminComponent,
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
