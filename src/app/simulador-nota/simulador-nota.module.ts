import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SimuladorNotaComponent } from './simulador-nota.component';

const routes: Routes = [{ path: '', component: SimuladorNotaComponent }];

@NgModule({
  declarations: [SimuladorNotaComponent],
  imports: [CommonModule, RouterModule.forChild(routes)],
})
export class SimuladorNotaModule {}
