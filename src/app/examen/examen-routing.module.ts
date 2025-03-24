import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { roleGuard } from '../guards/auth/role.guard';
import { ExamenesDashboardAdminDetailviewComponent } from './components/examenes-dashboard-admin-detailview/examenes-dashboard-admin-detailview.component';
import { ExamenesDashboardAdminComponent } from './components/examenes-dashboard-admin/examenes-dashboard-admin.component';

const routes: Routes = [
  {
    path: 'alumno',
    children: [
      {
        path: '',
        component: ExamenesDashboardAdminComponent,
        canActivate: [roleGuard],
        data: { expectedRole: 'ALUMNO', title: 'Exámenes disponibles' }
      },
    ]
  },
  {
    path: '',
    component: ExamenesDashboardAdminComponent,
    canActivate: [roleGuard],
    data: { expectedRole: 'ADMIN', title: 'Exámenes' }
  },
  {
    path: ':id',
    component: ExamenesDashboardAdminDetailviewComponent,
    canActivate: [roleGuard],
    data: { expectedRole: 'ADMIN', title: 'Detalle de examen' }
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ExamenRoutingModule { }
