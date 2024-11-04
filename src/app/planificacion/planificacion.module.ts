import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';

import { ConfirmationService } from 'primeng/api';
import { SharedModule } from '../shared/shared.module';
import { BloquesEditComponent } from './bloques-edit/bloques-edit.component';
import { BloquesOverviewComponent } from './bloques-overview/bloques-overview.component';
import { PlanificacionMensualEditComponent } from './planificacion-mensual-edit/planificacion-mensual-edit.component';
import { PlanificacionMensualOverviewComponent } from './planificacion-mensual-overview/planificacion-mensual-overview.component';
import { PlanificacionRoutingModule } from './planificacion-routing.module';
import { PlantillaSemanalEditComponent } from './plantilla-semanal-edit/plantilla-semanal-edit.component';
import { PlantillaSemanalOverviewComponent } from './plantilla-semanal-overview/plantilla-semanal-overview.component';

@NgModule({
  declarations: [
    BloquesOverviewComponent,
    BloquesEditComponent,
    PlantillaSemanalOverviewComponent,
    PlantillaSemanalEditComponent,
    PlanificacionMensualOverviewComponent,
    PlanificacionMensualEditComponent,
  ],
  imports: [CommonModule, SharedModule, PlanificacionRoutingModule],
  providers: [ConfirmationService],
})
export class PlanificacionModule {}
