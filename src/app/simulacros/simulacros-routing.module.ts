import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CompletarTestSimulacroComponent } from './components/completar-test-simulacro/completar-test-simulacro.component';
import { RealizarSimulacroComponent } from './components/realizar-simulacro/realizar-simulacro.component';

const routes: Routes = [
  {
    path: 'realizar-simulacro/:idExamen',
    component: RealizarSimulacroComponent,
    // Sin guard - acceso público, la lógica de consumibles se maneja dentro del componente
    data: { title: 'Realizar simulacro' }
  },
  {
    path: 'realizar-simulacro/:idExamen/completar/:idTest',
    component: CompletarTestSimulacroComponent,
    // Sin guard - la validación se hace dentro del componente
    data: { title: 'Completar simulacro' }
  },
  {
    path: 'resultado/:idExamen/:idTest',
    loadComponent: () =>
      import('./standalone/resultado-simulacro/resultado-simulacro.component').then(m => m.ResultadoSimulacroComponent),
    // Sin guard - la validación se hace dentro del componente
    data: { title: 'Resultados simulacro' }
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class SimulacrosRoutingModule { }
