import { Routes } from '@angular/router';
import { CallejeroAppComponent } from './alumno/callejero-app.component';
import { CallejeroEmbedComponent } from './embed/callejero-embed.component';

/**
 * Rutas standalone del módulo Callejero.
 * Lazy-loaded desde `app-routing.module.ts` bajo `/app/callejero`.
 *
 * - `''`      → EMBED (iframe del HTML de Raúl, paridad 1:1 exacta). Es lo que
 *               ve el alumno hoy.
 * - `nativo`  → port nativo Angular (`CallejeroAppComponent`), CONSERVADO para
 *               retomar la re-introducción a futuro (leaderboard, progreso,
 *               examen server-side, gating por oposición, multi-ciudad).
 */
export const routes: Routes = [
  {
    path: '',
    component: CallejeroEmbedComponent,
    data: { title: 'Callejero' },
  },
  {
    path: 'nativo',
    component: CallejeroAppComponent,
    data: { title: 'Callejero (nativo)' },
  },
];
