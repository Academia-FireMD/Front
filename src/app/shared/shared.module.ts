import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { ChartModule } from 'primeng/chart';
import { ListboxModule } from 'primeng/listbox';
import { OverlayPanelModule } from 'primeng/overlaypanel';
import { ComunidadPickerComponent } from './comunidad-picker/comunidad-picker.component';
import { PieChartComponent } from './pie-chart/pie-chart.component';
import { SharedGridComponent } from './shared-grid/shared-grid.component';
@NgModule({
  declarations: [
    SharedGridComponent,
    ComunidadPickerComponent,
    PieChartComponent,
  ],
  imports: [
    CommonModule,
    ButtonModule,
    FormsModule,
    ReactiveFormsModule,
    OverlayPanelModule,
    ListboxModule,
    ChartModule,
  ],
  exports: [SharedGridComponent, ComunidadPickerComponent, PieChartComponent],
})
export class SharedModule {}
