import { Routes } from '@angular/router';
import { MisCursosPageComponent } from './alumno/mis-cursos-page.component';
import { CatalogoPageComponent } from './alumno/catalogo-page.component';
import { CursoDetailPageComponent } from './alumno/curso-detail-page.component';
import { LeccionPageComponent } from './alumno/leccion-page.component';

export const routes: Routes = [
  {
    path: '',
    component: MisCursosPageComponent,
  },
  {
    path: 'catalogo',
    component: CatalogoPageComponent,
  },
  {
    path: ':slug',
    component: CursoDetailPageComponent,
  },
  {
    path: ':slug/leccion/:id',
    component: LeccionPageComponent,
  },
];
