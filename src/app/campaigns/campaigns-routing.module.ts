import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { roleGuard } from '../guards/auth/role.guard';
import { CampaignOverviewComponent } from './components/campaign-overview/campaign-overview.component';
import { CampaignDetailComponent } from './components/campaign-detail/campaign-detail.component';
import { CampaignFormComponent } from './components/campaign-form/campaign-form.component';

const routes: Routes = [
  {
    path: '',
    component: CampaignOverviewComponent,
    canActivate: [roleGuard],
    data: { expectedRole: 'ADMIN', title: 'Campañas' },
  },
  {
    path: 'new',
    component: CampaignFormComponent,
    canActivate: [roleGuard],
    data: { expectedRole: 'ADMIN', title: 'Nueva campaña' },
  },
  {
    path: ':id',
    component: CampaignDetailComponent,
    canActivate: [roleGuard],
    data: { expectedRole: 'ADMIN', title: 'Campaña' },
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class CampaignsRoutingModule {}
