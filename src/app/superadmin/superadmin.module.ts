import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConfigPageComponent } from './config-page/config-page.component';
import { SuperadminRoutingModule } from './superadmin-routing.module';

@NgModule({
  imports: [CommonModule, SuperadminRoutingModule, ConfigPageComponent],
})
export class SuperadminModule {}
