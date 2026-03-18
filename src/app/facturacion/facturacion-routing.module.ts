import { Routes } from '@angular/router';
import { roleGuard } from '../guards/auth/role.guard';
import { FacturacionAdminComponent } from './components/facturacion-admin/facturacion-admin.component';

export const routes: Routes = [
  {
    path: '',
    component: FacturacionAdminComponent,
    canActivate: [roleGuard],
    data: { expectedRole: 'ADMIN', title: 'Facturación' },
  },
];
