import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { roleGuard } from '../guards/auth/role.guard';
import { SubscriptionGuard } from '../guards/subscription.guard';
import { SuscripcionTipo } from '../shared/models/subscription.model';
import { ExamenesDashboardAdminDetailviewComponent } from './components/examenes-dashboard-admin-detailview/examenes-dashboard-admin-detailview.component';
import { ExamenesDashboardAdminComponent } from './components/examenes-dashboard-admin/examenes-dashboard-admin.component';
import { ExamenesRealizadosAlumnoComponent } from './components/examenes-realizados-alumno/examenes-realizados-alumno.component';

const routes: Routes = [
  {
    path: 'alumno',
    children: [
      {
        path: '',
        component: ExamenesDashboardAdminComponent,
        canActivate: [roleGuard, SubscriptionGuard],
        data: { expectedRole: 'ALUMNO', title: 'Exámenes disponibles', allowedSubscriptions: [SuscripcionTipo.ADVANCED, SuscripcionTipo.PREMIUM] }
      },
      {
        path: 'examenes-realizados',
        component: ExamenesRealizadosAlumnoComponent,
        canActivate: [roleGuard, SubscriptionGuard],
        data: { expectedRole: 'ALUMNO', title: 'Exámenes realizados', allowedSubscriptions: [SuscripcionTipo.ADVANCED, SuscripcionTipo.PREMIUM] }
      }
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
