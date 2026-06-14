import { Routes } from '@angular/router';
import { CallejeroAppComponent } from './alumno/callejero-app.component';

/**
 * Rutas standalone del módulo Callejero (v3 — port del tool de Raúl).
 * Lazy-loaded desde `app-routing.module.ts` bajo `/app/callejero`.
 */
export const routes: Routes = [
  {
    path: '',
    component: CallejeroAppComponent,
    data: { title: 'Callejero' },
  },
];
