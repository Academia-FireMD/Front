import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ConfigPageComponent } from './config-page/config-page.component';

const routes: Routes = [
  {
    path: 'config',
    component: ConfigPageComponent,
  },
  {
    path: '',
    redirectTo: 'config',
    pathMatch: 'full',
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class SuperadminRoutingModule {}
