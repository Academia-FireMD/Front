import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';

import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MarkdownModule } from 'ngx-markdown';
import { ConfirmationService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { CheckboxModule } from 'primeng/checkbox';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DataViewModule } from 'primeng/dataview';
import { DialogModule } from 'primeng/dialog';
import { DividerModule } from 'primeng/divider';
import { DropdownModule } from 'primeng/dropdown';
import { FloatLabelModule } from 'primeng/floatlabel';
import { IconFieldModule } from 'primeng/iconfield';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { InputIconModule } from 'primeng/inputicon';
import { InputSwitchModule } from 'primeng/inputswitch';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { ListboxModule } from 'primeng/listbox';
import { MultiSelectModule } from 'primeng/multiselect';
import { PaginatorModule } from 'primeng/paginator';
import { PanelModule } from 'primeng/panel';
import { RadioButtonModule } from 'primeng/radiobutton';
import { RippleModule } from 'primeng/ripple';
import { TagModule } from 'primeng/tag';
import { SharedModule } from '../shared/shared.module';
import { AjustesAdminComponent } from './components/ajustes-admin/ajustes-admin.component';
import { CompletarTestComponent } from './components/completar-test/completar-test.component';
import { DashboardStatsComponent } from './components/dashboard-stats/dashboard-stats.component';
import { FlashcardDetailviewAdminComponent } from './components/flashcard-detailview-admin/flashcard-detailview-admin.component';
import { FlashcardOverviewAdminComponent } from './components/flashcard-overview-admin/flashcard-overview-admin.component';
import { PopupFallosTestComponent } from './components/popup-fallos-test/popup-fallos-test.component';
import { PreguntasDashboardAdminDetailviewComponent } from './components/preguntas-dashboard-admin-detailview/preguntas-dashboard-admin-detailview.component';
import { PreguntasDashboardAdminComponent } from './components/preguntas-dashboard-admin/preguntas-dashboard-admin.component';
import { PreguntasFallosOverviewComponent } from './components/preguntas-fallos-overview/preguntas-fallos-overview.component';
import { RealizarTestComponent } from './components/realizar-test/realizar-test.component';
import { TemaDetailviewComponent } from './components/tema-detailview/tema-detailview.component';
import { TemaOverviewComponent } from './components/tema-overview/tema-overview.component';
import { TestStatsComponent } from './components/test-stats/test-stats.component';
import { UserDashboardComponent } from './components/user-dashboard/user-dashboard.component';
import { TestRoutingModule } from './test-routing.module';
import { RealizarFlashCardTestComponent } from './components/realizar-flash-card-test/realizar-flash-card-test.component';
import { CompletarFlashCardTestComponent } from './components/completar-flash-card-test/completar-flash-card-test.component';
import { TestStatsFlashcardsComponent } from './components/test-stats-flashcards/test-stats-flashcards.component';
import { DashboardStatsFlashcardsComponent } from './components/dashboard-stats-flashcards/dashboard-stats-flashcards.component';
import { ReportarFalloDialogComponent } from './components/reportar-fallo-dialog/reportar-fallo-dialog.component';
import { PreguntasFallosFlashcardsOverviewComponent } from './components/preguntas-fallos-flashcards-overview/preguntas-fallos-flashcards-overview.component';

@NgModule({
  declarations: [
    UserDashboardComponent,
    PreguntasDashboardAdminComponent,
    RealizarTestComponent,
    PreguntasDashboardAdminDetailviewComponent,
    AjustesAdminComponent,
    CompletarTestComponent,
    PopupFallosTestComponent,
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
  ],
  imports: [
    CommonModule,
    MarkdownModule,
    TestRoutingModule,
    CardModule,
    DataViewModule,
    TagModule,
    ButtonModule,
    IconFieldModule,
    InputIconModule,
    InputTextModule,
    PaginatorModule,
    ConfirmDialogModule,
    SharedModule,
    FloatLabelModule,
    FormsModule,
    ReactiveFormsModule,
    RippleModule,
    ListboxModule,
    InputTextareaModule,
    DropdownModule,
    InputGroupModule,
    InputGroupAddonModule,
    RadioButtonModule,
    FormsModule,
    InputGroupModule,
    CheckboxModule,
    MultiSelectModule,
    PanelModule,
    DialogModule,
    InputSwitchModule,
    DividerModule,
  ],
  providers: [ConfirmationService],
})
export class TestModule {}
