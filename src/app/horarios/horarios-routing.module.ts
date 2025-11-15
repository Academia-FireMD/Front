import { Routes } from '@angular/router';
import { roleGuard } from '../guards/auth/role.guard';
import { HorariosAdminComponent } from './components/horarios-admin/horarios-admin.component';
import { HorariosAlumnoComponent } from './components/horarios-alumno/horarios-alumno.component';

export const routes: Routes = [
  {
    path: 'alumno',
    component: HorariosAlumnoComponent,
    canActivate: [roleGuard],
    data: { expectedRole: 'ALUMNO', title: 'Reservar Horarios' }
  },
  {
    path: '',
    component: HorariosAdminComponent,
    canActivate: [roleGuard],
    data: { expectedRole: 'ADMIN', title: 'Gestión de Horarios' }
  }
];

