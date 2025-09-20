import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SubscriptionGuard } from '../guards/subscription.guard';
import { SuscripcionTipo } from '../shared/models/subscription.model';
import { CompletarTestSimulacroComponent } from './components/completar-test-simulacro/completar-test-simulacro.component';
import { RealizarSimulacroComponent } from './components/realizar-simulacro/realizar-simulacro.component';

const routes: Routes = [
  {
    path: 'realizar-simulacro/:idExamen',
    component: RealizarSimulacroComponent,
    canActivate: [SubscriptionGuard],
    data: { title: 'Realizar simulacro', allowedSubscriptions: [SuscripcionTipo.ADVANCED, SuscripcionTipo.PREMIUM] }
  },
  {
    path: 'realizar-simulacro/:idExamen/completar/:idTest',
    component: CompletarTestSimulacroComponent,
    canActivate: [SubscriptionGuard],
    data: { title: 'Completar simulacro', allowedSubscriptions: [SuscripcionTipo.ADVANCED, SuscripcionTipo.PREMIUM] }
  },
  {
    path: 'resultado/:idExamen/:idTest',
    loadComponent: () =>
      import('./standalone/resultado-simulacro/resultado-simulacro.component').then(m => m.ResultadoSimulacroComponent),
    canActivate: [SubscriptionGuard],
    data: { allowedSubscriptions: [SuscripcionTipo.ADVANCED, SuscripcionTipo.PREMIUM] }
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class SimulacrosRoutingModule { }
