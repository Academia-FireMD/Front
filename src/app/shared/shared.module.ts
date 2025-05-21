import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TooltipModule } from 'primeng/tooltip';
import { AvatarUploadComponent } from './avatar-upload/avatar-upload.component';
import { QrCodeShareComponent } from './components/qr-code-share/qr-code-share.component';
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
@NgModule({
  declarations: [
    SharedGridComponent,
    ComunidadPickerComponent,
    PieChartComponent,
    CountdownPipe,
    DificultadDropdownComponent,
    PasswordInputComponent,
    AvatarUploadComponent,
    TemaSelectComponent, RealizarTestComponent,
    PopupFallosTestComponent,
    QrCodeShareComponent
  ],
  imports: [
    CommonModule,
    ButtonModule,
    FormsModule,
    ReactiveFormsModule,
    PrimengModule,
    RouterModule,
    InputTextModule,
    TooltipModule,
  ],
  exports: [
    SharedGridComponent,
    ComunidadPickerComponent,
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
    QrCodeShareComponent
  ],
})
export class SharedModule { }
