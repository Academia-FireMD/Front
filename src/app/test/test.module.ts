import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';

import { ButtonModule } from 'primeng/button';
import { DataViewModule } from 'primeng/dataview';
import { TagModule } from 'primeng/tag';
import { UserDashboardComponent } from './components/user-dashboard/user-dashboard.component';
import { TestRoutingModule } from './test-routing.module';

import { ConfirmationService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { PaginatorModule } from 'primeng/paginator';
import { PreguntasDashboardAdminComponent } from './components/preguntas-dashboard-admin/preguntas-dashboard-admin.component';
import { RealizarTestComponent } from './components/realizar-test/realizar-test.component';
@NgModule({
  declarations: [UserDashboardComponent, PreguntasDashboardAdminComponent, RealizarTestComponent],
  imports: [
    CommonModule,
    TestRoutingModule,
    DataViewModule,
    TagModule,
    ButtonModule,
    IconFieldModule,
    InputIconModule,
    InputTextModule,
    PaginatorModule,
    ConfirmDialogModule,
  ],
  providers:[ConfirmationService]
})
export class TestModule {}
