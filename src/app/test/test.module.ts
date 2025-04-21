import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';

import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgxEchartsDirective } from 'ngx-echarts';
import { MarkdownModule } from 'ngx-markdown';
import { ConfirmationService } from 'primeng/api';
import { AvatarModule } from 'primeng/avatar';
import { AvatarGroupModule } from 'primeng/avatargroup';
import { BadgeModule } from 'primeng/badge';
import { MessagesModule } from 'primeng/messages';
import { SharedModule } from '../shared/shared.module';
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
import { ReportarFalloDialogComponent } from './components/reportar-fallo-dialog/reportar-fallo-dialog.component';
import { TemaDetailviewComponent } from './components/tema-detailview/tema-detailview.component';
import { TemaOverviewComponent } from './components/tema-overview/tema-overview.component';
import { TestStatsFlashcardsComponent } from './components/test-stats-flashcards/test-stats-flashcards.component';
import { TestStatsGridComponent } from './components/test-stats-grid/test-stats-grid.component';
import { PieChartDashboardSecurityComponent } from './components/test-stats/pie-chart-dashboard-security/pie-chart-dashboard-security.component';
import { TestStatsComponent } from './components/test-stats/test-stats.component';
import { UserDashboardComponent } from './components/user-dashboard/user-dashboard.component';
import { TestRoutingModule } from './test-routing.module';
@NgModule({
  declarations: [
    UserDashboardComponent,
    PreguntasDashboardAdminComponent,
    PreguntasDashboardAdminDetailviewComponent,
    AjustesAdminComponent,
    CompletarTestComponent,
    TestStatsComponent,
    DashboardStatsComponent,
    PreguntasFallosOverviewComponent,
    TemaOverviewComponent,
    TemaDetailviewComponent,
    FlashcardOverviewAdminComponent,
    FlashcardDetailviewAdminComponent,
    RealizarFlashCardTestComponent,
    CompletarFlashCardTestComponent,
    TestStatsFlashcardsComponent,
    DashboardStatsFlashcardsComponent,
    ReportarFalloDialogComponent,
    PreguntasFallosFlashcardsOverviewComponent,
    TestStatsGridComponent,
    FullStatsComponent,
    PieChartDashboardSecurityComponent,
  ],
  imports: [
    CommonModule,
    MarkdownModule,
    TestRoutingModule,
    SharedModule,
    FormsModule,
    ReactiveFormsModule,
    FormsModule,
    NgxEchartsDirective,
    AvatarGroupModule,
    AvatarModule,
    MessagesModule,
    BadgeModule,
  ],
  providers: [ConfirmationService],
  exports: [
    CompletarTestComponent,
  ]
})
export class TestModule { }
