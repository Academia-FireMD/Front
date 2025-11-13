import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CalendarModule } from 'primeng/calendar';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { TableModule } from 'primeng/table';
import { HorariosRoutingModule } from './horarios-routing.module';
import { CalendarioHorariosComponent } from './components/calendario-horarios/calendario-horarios.component';
import { HorariosAdminComponent } from './components/horarios-admin/horarios-admin.component';
import { HorariosAlumnoComponent } from './components/horarios-alumno/horarios-alumno.component';

@NgModule({
  imports: [
    CommonModule,
    HorariosRoutingModule,
    FormsModule,
    ReactiveFormsModule,
    ButtonModule,
    CalendarModule,
    CheckboxModule,
    DialogModule,
    DropdownModule,
    InputTextModule,
    InputTextareaModule,
    TableModule,
    CalendarioHorariosComponent,
    HorariosAdminComponent,
    HorariosAlumnoComponent
  ]
})
export class HorariosModule { }

