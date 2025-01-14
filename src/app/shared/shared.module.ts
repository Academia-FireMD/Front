import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { AvatarUploadComponent } from './avatar-upload/avatar-upload.component';
import { ComunidadPickerComponent } from './comunidad-picker/comunidad-picker.component';
import { DificultadDropdownComponent } from './dificultad-dropdown/dificultad-dropdown.component';
import { PasswordInputComponent } from './password-input/password-input.component';
import { PieChartComponent } from './pie-chart/pie-chart.component';
import { CountdownPipe } from './pipes/countdown.pipe';
import { PrimengModule } from './primeng.module';
import { SharedGridComponent } from './shared-grid/shared-grid.component';
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
  ],
  imports: [
    CommonModule,
    ButtonModule,
    FormsModule,
    ReactiveFormsModule,
    PrimengModule,
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
    AvatarUploadComponent,
  ],
})
export class SharedModule {}
