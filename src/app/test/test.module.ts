import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';

import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ConfirmationService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { CheckboxModule } from 'primeng/checkbox';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DataViewModule } from 'primeng/dataview';
import { DropdownModule } from 'primeng/dropdown';
import { FloatLabelModule } from 'primeng/floatlabel';
import { IconFieldModule } from 'primeng/iconfield';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { ListboxModule } from 'primeng/listbox';
import { PaginatorModule } from 'primeng/paginator';
import { RadioButtonModule } from 'primeng/radiobutton';
import { RippleModule } from 'primeng/ripple';
import { TagModule } from 'primeng/tag';
import { SharedModule } from '../shared/shared.module';
import { PreguntasDashboardAdminDetailviewComponent } from './components/preguntas-dashboard-admin-detailview/preguntas-dashboard-admin-detailview.component';
import { PreguntasDashboardAdminComponent } from './components/preguntas-dashboard-admin/preguntas-dashboard-admin.component';
import { RealizarTestComponent } from './components/realizar-test/realizar-test.component';
import { UserDashboardComponent } from './components/user-dashboard/user-dashboard.component';
import { TestRoutingModule } from './test-routing.module';
import { AjustesAdminComponent } from './components/ajustes-admin/ajustes-admin.component';
@NgModule({
  declarations: [
    UserDashboardComponent,
    PreguntasDashboardAdminComponent,
    RealizarTestComponent,
    PreguntasDashboardAdminDetailviewComponent,
    AjustesAdminComponent,
  ],
  imports: [
    CommonModule,
    TestRoutingModule,
    CardModule,
    DataViewModule,
    TagModule,
    ButtonModule,
    IconFieldModule,
    InputIconModule,
    InputTextModule,
    PaginatorModule,
    ConfirmDialogModule,
    SharedModule,
    FloatLabelModule,
    FormsModule,
    ReactiveFormsModule,
    RippleModule,
    ListboxModule,
    InputTextareaModule,
    DropdownModule,
    InputGroupModule,
    InputGroupAddonModule,
    RadioButtonModule,
    FormsModule,
    InputGroupModule,
    CheckboxModule,
  ],
  providers: [ConfirmationService],
})
export class TestModule {}
