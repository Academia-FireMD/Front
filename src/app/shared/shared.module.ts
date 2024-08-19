import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { ListboxModule } from 'primeng/listbox';
import { OverlayPanelModule } from 'primeng/overlaypanel';
import { ComunidadPickerComponent } from './comunidad-picker/comunidad-picker.component';
import { SharedGridComponent } from './shared-grid/shared-grid.component';
@NgModule({
  declarations: [SharedGridComponent, ComunidadPickerComponent],
  imports: [
    CommonModule,
    ButtonModule,
    FormsModule,
    ReactiveFormsModule,
    OverlayPanelModule,
    ListboxModule,
  ],
  exports: [SharedGridComponent, ComunidadPickerComponent],
})
export class SharedModule {}
