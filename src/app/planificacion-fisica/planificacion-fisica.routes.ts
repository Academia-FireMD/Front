import { Routes } from '@angular/router';
import { roleGuard } from '../guards/auth/role.guard';
import { PlanificacionFisicaAdminComponent } from './admin/planificacion-fisica-admin.component';
import { PlanificacionFisicaDetallesComponent } from './admin/planificacion-fisica-detalles.component';
import { PlanificacionFisicaCalendarioComponent } from './alumno/planificacion-fisica-calendario.component';
import { PlanificacionFisicaDiaComponent } from './alumno/planificacion-fisica-dia.component';
import { PlanificacionFisicaMarcasComponent } from './alumno/planificacion-fisica-marcas.component';

/**
 * Rutas de planificación física: panel admin (Task 8, Fase 1a) + calendario
 * y detalle de día del alumno (Tasks 11/12, Fase 1b), como hermanas del
 * mismo módulo.
 *
 * `roleGuard` se aplica AQUÍ, a nivel de ruta hija (mismo patrón que
 * `cursos-routing.module.ts` y `facturacion-routing.module.ts`), NO en
 * `app-routing.module.ts` — ese nivel superior solo gatea por módulo
 * (`moduloGuard`). Este módulo YA NO es 100% admin (mezcla ADMIN + ALUMNO),
 * así que a diferencia de `callejero` (100% alumno, `roleGuard` en el nivel
 * superior) el rol se decide POR RUTA aquí: `admin`/`admin/:id/detalles` →
 * ADMIN, `''`/`dia/:fecha` → ALUMNO.
 */
export const routes: Routes = [
  {
    // Calendario de 4 semanas del alumno (Task 11). Ruta base del módulo:
    // `/app/planificacion-fisica`.
    path: '',
    component: PlanificacionFisicaCalendarioComponent,
    canActivate: [roleGuard],
    data: { expectedRole: 'ALUMNO', title: 'Planificación física' },
  },
  {
    // Detalle de un día concreto, con los checks de progreso (Task 12).
    path: 'dia/:fecha',
    component: PlanificacionFisicaDiaComponent,
    canActivate: [roleGuard],
    data: { expectedRole: 'ALUMNO', title: 'Día de entrenamiento' },
  },
  {
    // Histórico de marcas personales del alumno (Fase 2): independiente del
    // plan/bloque del entrenador, así que va como ruta hermana propia en
    // lugar de colgar de `mi-plan`.
    path: 'marcas',
    component: PlanificacionFisicaMarcasComponent,
    canActivate: [roleGuard],
    data: { expectedRole: 'ALUMNO', title: 'Mis marcas' },
  },
  {
    path: 'admin',
    component: PlanificacionFisicaAdminComponent,
    canActivate: [roleGuard],
    data: { expectedRole: 'ADMIN', title: 'Planificación física (admin)' },
  },
  {
    // Ventana de edición del texto de los ejercicios de un bloque, disciplina
    // a disciplina (la parrilla la sube el entrenador por Excel; el texto se
    // escribe aquí). Mismo gate ADMIN que `admin` — panel 100% admin.
    path: 'admin/:bloqueId/detalles',
    component: PlanificacionFisicaDetallesComponent,
    canActivate: [roleGuard],
    data: { expectedRole: 'ADMIN', title: 'Detalles del bloque' },
  },
];
