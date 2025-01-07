import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { roleGuard } from '../guards/auth/role.guard';
import { DocumentationOverviewComponent } from './documentation-overview/documentation-overview.component';

const routes: Routes = [
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
    canActivate: [roleGuard],
    title: 'Documentación',
    data: { expectedRole: 'ALUMNO', title: 'Documentación' },
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class DocumentacionRoutingModule {}
