import { Routes } from '@angular/router';
import { CallejeroMapComponent } from './alumno/callejero-map.component';

/**
 * Rutas standalone del módulo Callejero (Fase 1). Lazy-loaded desde
 * `app-routing.module.ts` bajo `/app/callejero` con `moduloGuard`.
 */
export const routes: Routes = [
  {
    path: '',
    component: CallejeroMapComponent,
    data: { title: 'Callejero' },
  },
];
