import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { BadgeModule } from 'primeng/badge';
import { ButtonModule } from 'primeng/button';
import { CalendarModule } from 'primeng/calendar';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { FloatLabelModule } from 'primeng/floatlabel';
import { InputTextModule } from 'primeng/inputtext';
import { TooltipModule } from 'primeng/tooltip';
import { DataViewModule } from 'primeng/dataview';
import { PaginatorModule } from 'primeng/paginator';
import { AvatarUploadComponent } from './avatar-upload/avatar-upload.component';
import { QrCodeShareComponent } from './components/qr-code-share/qr-code-share.component';
import { MetodoCalificacionPickerComponent } from './components/metodo-calificacion-picker/metodo-calificacion-picker.component';
import { ComunidadPickerComponent } from './comunidad-picker/comunidad-picker.component';
import { ComunidadDropdownComponent } from './comunidad-dropdown/comunidad-dropdown.component';
import { DificultadDropdownComponent } from './dificultad-dropdown/dificultad-dropdown.component';
import { PasswordInputComponent } from './password-input/password-input.component';
import { PieChartComponent } from './pie-chart/pie-chart.component';
import { CountdownPipe } from './pipes/countdown.pipe';
import { PopupFallosTestComponent } from './popup-fallos-test/popup-fallos-test.component';
import { PrimengModule } from './primeng.module';
import { RealizarTestComponent } from './realizar-test/realizar-test.component';
import { SharedGridComponent } from './shared-grid/shared-grid.component';
import { TemaSelectComponent } from './tema-select/tema-select.component';
import { GenericListComponent } from './generic-list/generic-list.component';

@NgModule({
  declarations: [
    SharedGridComponent,
    GenericListComponent,
    ComunidadPickerComponent,
    ComunidadDropdownComponent,
    PieChartComponent,
    CountdownPipe,
    DificultadDropdownComponent,
    PasswordInputComponent,
    AvatarUploadComponent,
    TemaSelectComponent, RealizarTestComponent,
    PopupFallosTestComponent,
    QrCodeShareComponent,
    MetodoCalificacionPickerComponent
  ],
  imports: [
    CommonModule,
    BadgeModule,
    ButtonModule,
    CalendarModule,
    DialogModule,
    DropdownModule,
    FloatLabelModule,
    FormsModule,
    ReactiveFormsModule,
    PrimengModule,
    RouterModule,
    InputTextModule,
    TooltipModule,
    DataViewModule,
    PaginatorModule,
  ],
  exports: [
    SharedGridComponent,
    GenericListComponent,
    ComunidadPickerComponent,
    ComunidadDropdownComponent,
    PieChartComponent,
    CountdownPipe,
    PrimengModule,
    FormsModule,
    ReactiveFormsModule,
    DificultadDropdownComponent,
    PasswordInputComponent,
    AvatarUploadComponent, RealizarTestComponent,
    TemaSelectComponent,
    PopupFallosTestComponent,
    QrCodeShareComponent,
    MetodoCalificacionPickerComponent,
    BadgeModule,
    FloatLabelModule
  ],
})
export class SharedModule { }
