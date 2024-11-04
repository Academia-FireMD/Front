import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { ComunidadPickerComponent } from './comunidad-picker/comunidad-picker.component';
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
  ],
})
export class SharedModule {}
