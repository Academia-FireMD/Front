import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { roleGuard } from '../guards/auth/role.guard';
import { BloquesEditComponent } from './bloques-edit/bloques-edit.component';
import { BloquesOverviewComponent } from './bloques-overview/bloques-overview.component';
import { PlanificacionMensualEditComponent } from './planificacion-mensual-edit/planificacion-mensual-edit.component';
import { PlanificacionMensualOverviewComponent } from './planificacion-mensual-overview/planificacion-mensual-overview.component';
import { PlantillaSemanalEditComponent } from './plantilla-semanal-edit/plantilla-semanal-edit.component';
import { PlantillaSemanalOverviewComponent } from './plantilla-semanal-overview/plantilla-semanal-overview.component';

const routes: Routes = [
  {
    path: 'bloques',
    component: BloquesOverviewComponent,
    canActivate: [roleGuard],
    title: 'Bloques',
    data: { expectedRole: 'ADMIN', title: 'Bloques' },
  },
  {
    path: 'bloques/:id',
    component: BloquesEditComponent,
    canActivate: [roleGuard],
    title: 'Bloques',
    data: { expectedRole: 'ADMIN', title: 'Bloques' },
  },
  {
    path: 'plantillas-semanales',
    component: PlantillaSemanalOverviewComponent,
    canActivate: [roleGuard],
    title: 'Plantillas semanales',
    data: { expectedRole: 'ADMIN', title: 'Plantillas semanales' },
  },
  {
    path: 'plantillas-semanales/:id',
    component: PlantillaSemanalEditComponent,
    canActivate: [roleGuard],
    title: 'Plantillas semanales',
    data: { expectedRole: 'ADMIN', title: 'Plantillas semanales' },
  },
  {
    path: 'planificacion-mensual',
    component: PlanificacionMensualOverviewComponent,
    canActivate: [roleGuard],
    title: 'Planificación mensual',
    data: { expectedRole: 'ADMIN', title: 'Planificación mensual' },
  },
  {
    path: 'planificacion-mensual/:id',
    component: PlanificacionMensualEditComponent,
    canActivate: [roleGuard],
    title: 'Planificación mensual',
    data: { expectedRole: 'ADMIN', title: 'Planificación mensual' },
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class PlanificacionRoutingModule {}
