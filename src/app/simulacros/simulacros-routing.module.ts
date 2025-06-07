import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CompletarTestSimulacroComponent } from './components/completar-test-simulacro/completar-test-simulacro.component';
import { RealizarSimulacroComponent } from './components/realizar-simulacro/realizar-simulacro.component';

const routes: Routes = [
  {
    path: 'realizar-simulacro/:idExamen',
    component: RealizarSimulacroComponent,
    data: { title: 'Realizar simulacro' }
  },
  {
    path: 'realizar-simulacro/:idExamen/completar/:idTest',
    component: CompletarTestSimulacroComponent,
    data: { title: 'Completar simulacro' }
  },
  {
    path: 'resultado/:idExamen/:idTest',
    loadComponent: () =>
      import('./standalone/resultado-simulacro/resultado-simulacro.component').then(m => m.ResultadoSimulacroComponent),
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class SimulacrosRoutingModule { }
