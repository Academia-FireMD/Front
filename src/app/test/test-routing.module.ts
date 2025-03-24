import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { roleGuard } from '../guards/auth/role.guard';
import { RealizarTestComponent } from '../shared/realizar-test/realizar-test.component';
import { AjustesAdminComponent } from './components/ajustes-admin/ajustes-admin.component';
import { CompletarFlashCardTestComponent } from './components/completar-flash-card-test/completar-flash-card-test.component';
import { CompletarTestComponent } from './components/completar-test/completar-test.component';
import { DashboardStatsFlashcardsComponent } from './components/dashboard-stats-flashcards/dashboard-stats-flashcards.component';
import { DashboardStatsComponent } from './components/dashboard-stats/dashboard-stats.component';
import { FlashcardDetailviewAdminComponent } from './components/flashcard-detailview-admin/flashcard-detailview-admin.component';
import { FlashcardOverviewAdminComponent } from './components/flashcard-overview-admin/flashcard-overview-admin.component';
import { FullStatsComponent } from './components/full-stats/full-stats.component';
import { PreguntasDashboardAdminDetailviewComponent } from './components/preguntas-dashboard-admin-detailview/preguntas-dashboard-admin-detailview.component';
import { PreguntasDashboardAdminComponent } from './components/preguntas-dashboard-admin/preguntas-dashboard-admin.component';
import { PreguntasFallosFlashcardsOverviewComponent } from './components/preguntas-fallos-flashcards-overview/preguntas-fallos-flashcards-overview.component';
import { PreguntasFallosOverviewComponent } from './components/preguntas-fallos-overview/preguntas-fallos-overview.component';
import { RealizarFlashCardTestComponent } from './components/realizar-flash-card-test/realizar-flash-card-test.component';
import { TemaDetailviewComponent } from './components/tema-detailview/tema-detailview.component';
import { TemaOverviewComponent } from './components/tema-overview/tema-overview.component';
import { TestStatsFlashcardsComponent } from './components/test-stats-flashcards/test-stats-flashcards.component';
import { TestStatsGridComponent } from './components/test-stats-grid/test-stats-grid.component';
import { TestStatsComponent } from './components/test-stats/test-stats.component';
import { UserDashboardComponent } from './components/user-dashboard/user-dashboard.component';

const routes: Routes = [
  {
    path: 'realizar-test/vista-previa/:id',
    component: CompletarTestComponent,
    canActivate: [roleGuard],
    data: { title: 'Vista previa del test', vistaPrevia: true, expectedRole: 'ADMIN' },
  },

  {
    path: 'user',
    component: UserDashboardComponent,
    canActivate: [roleGuard],
    title: 'Usuarios',
    data: { expectedRole: 'ADMIN', title: 'Usuarios' },
  },
  {
    path: 'tema',
    component: TemaOverviewComponent,
    canActivate: [roleGuard],
    title: 'Temas',
    data: { expectedRole: 'ADMIN', title: 'Temas' },
  },
  {
    path: 'tema/:id',
    component: TemaDetailviewComponent,
    canActivate: [roleGuard],
    title: 'Tema',
    data: { expectedRole: 'ADMIN', title: 'Tema' },
  },
  {
    path: 'preguntas',
    component: PreguntasDashboardAdminComponent,
    canActivate: [roleGuard],
    title: 'Preguntas',
    data: { expectedRole: 'ADMIN', title: 'Preguntas' },
  },
  {
    path: 'preguntas/:id',
    component: PreguntasDashboardAdminDetailviewComponent,
    canActivate: [roleGuard],
    title: 'Preguntas',
    data: { expectedRole: 'ADMIN', title: 'Preguntas' },
  },
  {
    path: 'flashcards',
    component: FlashcardOverviewAdminComponent,
    canActivate: [roleGuard],
    title: 'Flash Cards',
    data: { expectedRole: 'ADMIN', title: 'Flash Cards' },
  },
  {
    path: 'flashcards/:id',
    component: FlashcardDetailviewAdminComponent,
    canActivate: [roleGuard],
    title: 'Flash Cards',
    data: { expectedRole: 'ADMIN', title: 'Flash Cards' },
  },
  {
    path: 'preguntas-fallos',
    component: PreguntasFallosOverviewComponent,
    canActivate: [roleGuard],
    title: 'Fallos reportados',
    data: { expectedRole: 'ADMIN', title: 'Fallos reportados' },
  },
  {
    path: 'flashcards-fallos',
    component: PreguntasFallosFlashcardsOverviewComponent,
    canActivate: [roleGuard],
    title: 'Fallos en flashcards reportados',
    data: { expectedRole: 'ADMIN', title: 'Fallos en flashcards reportados' },
  },
  {
    path: 'ajustes',
    component: AjustesAdminComponent,
    canActivate: [roleGuard],
    data: { expectedRole: 'ADMIN' },
  },
  {
    path: 'test-stats',
    component: TestStatsGridComponent,
    canActivate: [roleGuard],
    data: { expectedRole: 'ADMIN', type: 'TESTS' },
  },
  {
    path: 'flashcard-stats',
    component: TestStatsGridComponent,
    canActivate: [roleGuard],
    data: { expectedRole: 'ADMIN', type: 'FLASHCARDS' },
  },
  {
    path: 'stats-test/:id',
    component: TestStatsComponent,
    canActivate: [roleGuard],
    data: { expectedRole: 'ADMIN' },
  },
  {
    path: 'stats-test-flashcard/:id',
    component: TestStatsFlashcardsComponent,
    canActivate: [roleGuard],
    data: { expectedRole: 'ADMIN' },
  },
  {
    path: 'full-stats-test',
    component: FullStatsComponent,
    canActivate: [roleGuard],
    data: { expectedRole: 'ADMIN', type: 'TESTS' },
  },
  {
    path: 'full-stats-flashcard',
    component: FullStatsComponent,
    canActivate: [roleGuard],
    data: { expectedRole: 'ADMIN', type: 'FLASHCARDS' },
  },
  {
    path: 'alumno',
    children: [
      {
        path: 'realizar-test/modo-ver-respuestas/:id',
        component: CompletarTestComponent,
        canActivate: [roleGuard],
        data: { title: 'Modo ver respuestas', modoVerRespuestas: true, expectedRole: 'ALUMNO' },
      },
      {
        path: 'realizar-test',
        component: RealizarTestComponent,
        canActivate: [roleGuard],
        data: { expectedRole: 'ALUMNO' },
      },
      {
        path: 'realizar-test/:id',
        component: CompletarTestComponent,
        canActivate: [roleGuard],
        data: { expectedRole: 'ALUMNO' },
      },
      {
        path: 'stats-test/:id',
        component: TestStatsComponent,
        canActivate: [roleGuard],
        data: { expectedRole: 'ALUMNO' },
      },
      {
        path: 'stats-test-flashcard/:id',
        component: TestStatsFlashcardsComponent,
        canActivate: [roleGuard],
        data: { expectedRole: 'ALUMNO' },
      },
      {
        path: 'estadistica-dashboard',
        component: DashboardStatsComponent,
        canActivate: [roleGuard],
        data: { expectedRole: 'ALUMNO' },
      },
      {
        path: 'realizar-flash-cards-test',
        component: RealizarFlashCardTestComponent,
        canActivate: [roleGuard],
        data: { expectedRole: 'ALUMNO' },
      },
      {
        path: 'realizar-flash-cards-test/:id',
        component: CompletarFlashCardTestComponent,
        canActivate: [roleGuard],
        data: { expectedRole: 'ALUMNO' },
      },
      {
        path: 'estadistica-flashcards-dashboard',
        component: DashboardStatsFlashcardsComponent,
        canActivate: [roleGuard],
        data: { expectedRole: 'ALUMNO' },
      },
      {
        path: 'test-stats',
        component: TestStatsGridComponent,
        canActivate: [roleGuard],
        data: { expectedRole: 'ALUMNO', type: 'TESTS' },
      },
      {
        path: 'flashcard-stats',
        component: TestStatsGridComponent,
        canActivate: [roleGuard],
        data: { expectedRole: 'ALUMNO', type: 'FLASHCARDS' },
      },
      {
        path: 'full-stats-test',
        component: FullStatsComponent,
        canActivate: [roleGuard],
        data: { expectedRole: 'ALUMNO', type: 'TESTS' },
      },
      {
        path: 'full-stats-flashcard',
        component: FullStatsComponent,
        canActivate: [roleGuard],
        data: { expectedRole: 'ALUMNO', type: 'FLASHCARDS' },
      },
      {
        path: 'preguntas',
        component: PreguntasDashboardAdminComponent,
        canActivate: [roleGuard],
        title: 'Preguntas',
        data: { expectedRole: 'ALUMNO', title: 'Preguntas' },
      },
      {
        path: 'preguntas/:id',
        component: PreguntasDashboardAdminDetailviewComponent,
        canActivate: [roleGuard],
        title: 'Preguntas',
        data: { expectedRole: 'ALUMNO', title: 'Preguntas' },
      },
      {
        path: 'flashcards',
        component: FlashcardOverviewAdminComponent,
        canActivate: [roleGuard],
        title: 'Flash Cards',
        data: { expectedRole: 'ALUMNO', title: 'Flash Cards' },
      },
      {
        path: 'flashcards/:id',
        component: FlashcardDetailviewAdminComponent,
        canActivate: [roleGuard],
        title: 'Flash Cards',
        data: { expectedRole: 'ALUMNO', title: 'Flash Cards' },
      },
      {
        path: '',
        redirectTo: 'realizar-test',
        pathMatch: 'full',
      },
      {
        path: '**',
        redirectTo: 'realizar-test',
      },
    ],
  },
  {
    path: '',
    redirectTo: 'user',
    pathMatch: 'full',
  },
  {
    path: '**',
    redirectTo: 'user',
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class TestRoutingModule { }
