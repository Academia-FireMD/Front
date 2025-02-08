import { CommonModule, registerLocaleData } from '@angular/common';
import { LOCALE_ID, NgModule } from '@angular/core';

import { CalendarModule, DateAdapter } from 'angular-calendar';
import { ConfirmationService } from 'primeng/api';
import { CardModule } from 'primeng/card';
import { SpeedDialModule } from 'primeng/speeddial';
import { StepperModule } from 'primeng/stepper';

import localeEs from '@angular/common/locales/es';
import { FormsModule } from '@angular/forms';
import { adapterFactory } from 'angular-calendar/date-adapters/date-fns';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { ContextMenuModule } from 'primeng/contextmenu';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { PaginatorModule } from 'primeng/paginator';
import { ProgressBarModule } from 'primeng/progressbar';
import { TableModule } from 'primeng/table';
import { SharedModule } from '../shared/shared.module';
import { BloquesEditComponent } from './bloques-edit/bloques-edit.component';
import { BloquesOverviewComponent } from './bloques-overview/bloques-overview.component';
import { CalendarHeaderComponent } from './calendar-header/calendar-header.component';
import { EditarSubBloqueDialogComponent } from './editar-sub-bloque-dialog/editar-sub-bloque-dialog.component';
import { PlanificacionComentariosOverviewComponent } from './planificacion-comentarios-overview/planificacion-comentarios-overview.component';
import { PlanificacionMensualEditComponent } from './planificacion-mensual-edit/planificacion-mensual-edit.component';
import { PlanificacionMensualOverviewComponent } from './planificacion-mensual-overview/planificacion-mensual-overview.component';
import { PlanificacionRoutingModule } from './planificacion-routing.module';
import { PlantillaSemanalEditComponent } from './plantilla-semanal-edit/plantilla-semanal-edit.component';
import { PlantillaSemanalOverviewComponent } from './plantilla-semanal-overview/plantilla-semanal-overview.component';
import { VistaSemanalComponent } from './vista-semanal/vista-semanal.component';
import { MarkdownModule } from 'ngx-markdown';
registerLocaleData(localeEs);
@NgModule({
  declarations: [
    BloquesOverviewComponent,
    BloquesEditComponent,
    PlantillaSemanalOverviewComponent,
    PlantillaSemanalEditComponent,
    PlanificacionMensualOverviewComponent,
    PlanificacionMensualEditComponent,
    EditarSubBloqueDialogComponent,
    VistaSemanalComponent,
    CalendarHeaderComponent,
    PlanificacionComentariosOverviewComponent,
  ],
  imports: [
    CommonModule,
    SharedModule,
    PlanificacionRoutingModule,
    MarkdownModule,
    CalendarModule,
    CardModule,
    StepperModule,
    SpeedDialModule,
    TableModule,
    CheckboxModule,
    ButtonModule,
    DialogModule,
    PaginatorModule,
    InputTextModule,
    FormsModule,
    ProgressBarModule,
    ContextMenuModule,
  ],
  providers: [
    ConfirmationService,
    { provide: LOCALE_ID, useValue: 'es' },
    {
      provide: DateAdapter,
      useFactory: adapterFactory,
    },
  ],
})
export class PlanificacionModule {}
