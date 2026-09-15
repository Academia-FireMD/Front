import { Routes } from '@angular/router';
import { callejeroAlicanteGuard } from '../guards/callejero-alicante.guard';
import { CallejeroAppComponent } from './alumno/callejero-app.component';
import { CallejeroAlicanteComponent } from './alicante/callejero-alicante.component';
import { CallejeroEmbedComponent } from './embed/callejero-embed.component';
import { CallejeroEntradaComponent } from './entrada/callejero-entrada.component';

/**
 * Rutas standalone del módulo Callejero.
 * Lazy-loaded desde `app-routing.module.ts` bajo `/app/callejero`.
 *
 * - `''`       → decide automáticamente por oposición o muestra el selector.
 * - `valencia` → EMBED existente de Valencia, incluido su puente de auth.
 * - `alicante` → beta autónoma de Alicante, sin credenciales de la plataforma.
 * - `nativo`  → port nativo Angular (`CallejeroAppComponent`), CONSERVADO para
 *               retomar la re-introducción a futuro (leaderboard, progreso,
 *               examen server-side, gating por oposición, multi-ciudad).
 */
export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    component: CallejeroEntradaComponent,
    data: { title: 'Callejero' },
  },
  {
    path: 'valencia',
    component: CallejeroEmbedComponent,
    data: { title: 'Callejero Valencia' },
  },
  {
    path: 'alicante',
    component: CallejeroAlicanteComponent,
    canActivate: [callejeroAlicanteGuard],
    data: { title: 'Callejero Alicante' },
  },
  {
    path: 'nativo',
    component: CallejeroAppComponent,
    data: { title: 'Callejero (nativo)' },
  },
];
