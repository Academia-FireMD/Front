import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { ChartModule } from 'primeng/chart';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { ListboxModule } from 'primeng/listbox';
import { OverlayPanelModule } from 'primeng/overlaypanel';
import { ToggleButtonModule } from 'primeng/togglebutton';
import { ComunidadPickerComponent } from './comunidad-picker/comunidad-picker.component';
import { PieChartComponent } from './pie-chart/pie-chart.component';
import { CountdownPipe } from './pipes/countdown.pipe';
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
    OverlayPanelModule,
    ListboxModule,
    ChartModule,
    DialogModule,
    InputTextModule,
    ToggleButtonModule,
    ButtonModule,
    DropdownModule
  ],
  exports: [
    SharedGridComponent,
    ComunidadPickerComponent,
    PieChartComponent,
    CountdownPipe,
    UserEditDialogComponent,
  ],
})
export class SharedModule {}
