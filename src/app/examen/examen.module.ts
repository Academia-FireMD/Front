import { CommonModule } from '@angular/common';
import { LOCALE_ID, NgModule } from '@angular/core';

import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ConfirmationService } from 'primeng/api';
import { BadgeModule } from 'primeng/badge';
import { ButtonModule } from 'primeng/button';
import { CalendarModule } from 'primeng/calendar';
import { CardModule } from 'primeng/card';
import { CheckboxModule } from 'primeng/checkbox';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DataViewModule } from 'primeng/dataview';
import { DropdownModule } from 'primeng/dropdown';
import { FloatLabelModule } from 'primeng/floatlabel';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { MenuModule } from 'primeng/menu';
import { MessageModule } from 'primeng/message';
import { MultiSelectModule } from 'primeng/multiselect';
import { PaginatorModule } from 'primeng/paginator';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { StepsModule } from 'primeng/steps';
import { TableModule } from 'primeng/table';
import { TabViewModule } from 'primeng/tabview';
import { TagModule } from 'primeng/tag';
import { TreeModule } from 'primeng/tree';
import { AsyncButtonComponent } from '../shared/components/async-button/async-button.component';
import { GenericListComponent } from '../shared/generic-list/generic-list.component';
import { SharedModule } from '../shared/shared.module';
import { ExamenesDashboardAdminDetailviewComponent } from './components/examenes-dashboard-admin-detailview/examenes-dashboard-admin-detailview.component';
import { ExamenesDashboardAdminComponent } from './components/examenes-dashboard-admin/examenes-dashboard-admin.component';
import { ExamenesRealizadosAlumnoComponent } from './components/examenes-realizados-alumno/examenes-realizados-alumno.component';
import { ExamenRoutingModule } from './examen-routing.module';
@NgModule({
  declarations: [
    ExamenesDashboardAdminComponent,
    ExamenesDashboardAdminDetailviewComponent,
    ExamenesRealizadosAlumnoComponent,
  ],
  imports: [
    CommonModule,
    ExamenRoutingModule,
    ButtonModule,
    InputTextModule,
    ReactiveFormsModule,
    DropdownModule,
    CalendarModule,
    InputTextareaModule,
    InputNumberModule,
    FormsModule,
    ConfirmDialogModule,
    DataViewModule,
    IconFieldModule,
    InputIconModule,
    PaginatorModule,
    FloatLabelModule,
    CardModule,
    SharedModule,
    TreeModule,
    TableModule,
    MultiSelectModule,
    StepsModule,
    CheckboxModule,
    MenuModule,
    BadgeModule,
    TabViewModule,
    ProgressSpinnerModule,
    TagModule,
    AsyncButtonComponent,
    GenericListComponent,
    MessageModule
  ],
  providers: [ConfirmationService, { provide: LOCALE_ID, useValue: 'es' }],
})
export class ExamenModule {}
