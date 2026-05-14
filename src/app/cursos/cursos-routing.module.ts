import { Routes } from '@angular/router';
import { roleGuard } from '../guards/auth/role.guard';
import { CursosAdminListComponent } from './admin/cursos-admin-list.component';
import { CursoAdminEditComponent } from './admin/curso-admin-edit.component';

export const routes: Routes = [
  {
    path: '',
    component: CursosAdminListComponent,
    canActivate: [roleGuard],
    data: { expectedRole: 'ADMIN', title: 'Cursos' },
  },
  {
    path: 'nuevo',
    component: CursoAdminEditComponent,
    canActivate: [roleGuard],
    data: { expectedRole: 'ADMIN', title: 'Nuevo curso' },
  },
  {
    path: ':id',
    component: CursoAdminEditComponent,
    canActivate: [roleGuard],
    data: { expectedRole: 'ADMIN', title: 'Editar curso' },
  },
];
