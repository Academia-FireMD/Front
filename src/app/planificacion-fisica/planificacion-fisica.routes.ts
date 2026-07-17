import { Routes } from '@angular/router';
import { roleGuard } from '../guards/auth/role.guard';
import { PlanificacionFisicaAdminComponent } from './admin/planificacion-fisica-admin.component';

/**
 * Panel admin de import de planificación física (Task 8, Fase 1a). Solo
 * contiene `/admin` de momento — la vista de alumno (Fase 1b) se añade
 * como hermana de este path cuando se cierre el diseño con datos reales.
 *
 * `roleGuard` + `expectedRole: 'ADMIN'` se aplica AQUÍ, a nivel de ruta hija
 * (mismo patrón que `cursos-routing.module.ts` y
 * `facturacion-routing.module.ts`), NO en `app-routing.module.ts` — ese
 * nivel superior solo gatea por módulo (`moduloGuard`), igual que
 * `cursos-admin`. Es un panel 100% admin, así que gatearlo con
 * `expectedRole: 'ALUMNO'` en el nivel superior (como hace `callejero`,
 * que sí es 100% alumno) dejaría entrar a cualquier ALUMNO logueado.
 */
export const routes: Routes = [
  {
    path: 'admin',
    component: PlanificacionFisicaAdminComponent,
    canActivate: [roleGuard],
    data: { expectedRole: 'ADMIN', title: 'Planificación física (admin)' },
  },
];
