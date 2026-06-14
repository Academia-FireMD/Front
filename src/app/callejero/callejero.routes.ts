import { Routes } from '@angular/router';
import { CallejeroMapComponent } from './alumno/callejero-map.component';
import { CallejeroExamenComponent } from './alumno/callejero-examen.component';

/**
 * Rutas standalone del módulo Callejero. Lazy-loaded desde
 * `app-routing.module.ts` bajo `/app/callejero` con `moduloGuard`.
 */
export const routes: Routes = [
  {
    path: '',
    component: CallejeroMapComponent,
    data: { title: 'Callejero' },
  },
  {
    path: 'examen',
    component: CallejeroExamenComponent,
    data: { title: 'Examen de callejero' },
  },
];
