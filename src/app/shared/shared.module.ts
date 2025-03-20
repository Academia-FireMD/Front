import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { AvatarUploadComponent } from './avatar-upload/avatar-upload.component';
import { ComunidadPickerComponent } from './comunidad-picker/comunidad-picker.component';
import { DificultadDropdownComponent } from './dificultad-dropdown/dificultad-dropdown.component';
import { PasswordInputComponent } from './password-input/password-input.component';
import { PieChartComponent } from './pie-chart/pie-chart.component';
import { CountdownPipe } from './pipes/countdown.pipe';
import { PopupFallosTestComponent } from './popup-fallos-test/popup-fallos-test.component';
import { PrimengModule } from './primeng.module';
import { RealizarTestComponent } from './realizar-test/realizar-test.component';
import { SharedGridComponent } from './shared-grid/shared-grid.component';
import { TemaSelectComponent } from './tema-select/tema-select.component';
import { UserEditDialogComponent } from './user-edit-dialog/user-edit-dialog.component';
@NgModule({
  declarations: [
    SharedGridComponent,
    ComunidadPickerComponent,
    PieChartComponent,
    CountdownPipe,
    UserEditDialogComponent,
    DificultadDropdownComponent,
    PasswordInputComponent,
    AvatarUploadComponent,
    TemaSelectComponent, RealizarTestComponent,
    PopupFallosTestComponent
  ],
  imports: [
    CommonModule,
    ButtonModule,
    FormsModule,
    ReactiveFormsModule,
    PrimengModule,
    RouterModule
  ],
  exports: [
    SharedGridComponent,
    ComunidadPickerComponent,
    PieChartComponent,
    CountdownPipe,
    UserEditDialogComponent,
    PrimengModule,
    FormsModule,
    ReactiveFormsModule,
    DificultadDropdownComponent,
    PasswordInputComponent,
    AvatarUploadComponent, RealizarTestComponent,
    TemaSelectComponent,
    PopupFallosTestComponent
  ],
})
export class SharedModule { }
