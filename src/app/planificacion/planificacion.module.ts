import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';

import { CalendarModule } from 'angular-calendar';
import { ConfirmationService } from 'primeng/api';
import { CardModule } from 'primeng/card';
import { SharedModule } from '../shared/shared.module';
import { BloquesEditComponent } from './bloques-edit/bloques-edit.component';
import { BloquesOverviewComponent } from './bloques-overview/bloques-overview.component';
import { PlanificacionMensualEditComponent } from './planificacion-mensual-edit/planificacion-mensual-edit.component';
import { PlanificacionMensualOverviewComponent } from './planificacion-mensual-overview/planificacion-mensual-overview.component';
import { PlanificacionRoutingModule } from './planificacion-routing.module';
import { PlantillaSemanalEditComponent } from './plantilla-semanal-edit/plantilla-semanal-edit.component';
import { PlantillaSemanalOverviewComponent } from './plantilla-semanal-overview/plantilla-semanal-overview.component';
import { EditarSubBloqueDialogComponent } from './editar-sub-bloque-dialog/editar-sub-bloque-dialog.component';

@NgModule({
  declarations: [
    BloquesOverviewComponent,
    BloquesEditComponent,
    PlantillaSemanalOverviewComponent,
    PlantillaSemanalEditComponent,
    PlanificacionMensualOverviewComponent,
    PlanificacionMensualEditComponent,
    EditarSubBloqueDialogComponent,
  ],
  imports: [
    CommonModule,
    SharedModule,
    PlanificacionRoutingModule,
    CalendarModule,
    CardModule,
  ],
  providers: [ConfirmationService],
})
export class PlanificacionModule {}
