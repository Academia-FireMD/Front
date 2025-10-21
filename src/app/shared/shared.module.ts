import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { NgxEchartsModule } from 'ngx-echarts';
import { BadgeModule } from 'primeng/badge';
import { ButtonModule } from 'primeng/button';
import { CalendarModule } from 'primeng/calendar';
import { DataViewModule } from 'primeng/dataview';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { FloatLabelModule } from 'primeng/floatlabel';
import { InputTextModule } from 'primeng/inputtext';
import { PaginatorModule } from 'primeng/paginator';
import { TooltipModule } from 'primeng/tooltip';
import { AvatarUploadComponent } from './avatar-upload/avatar-upload.component';
import { AsyncButtonComponent } from './components/async-button/async-button.component';
import { AttachmentsManagerComponent } from './components/attachments-manager/attachments-manager.component';
import { ConfidenceAnalysisCardsComponent } from './components/confidence-analysis-cards/confidence-analysis-cards.component';
import { KpiStatsCardsComponent } from './components/kpi-stats-cards/kpi-stats-cards.component';
import { MetodoCalificacionPickerComponent } from './components/metodo-calificacion-picker/metodo-calificacion-picker.component';
import { QrCodeShareComponent } from './components/qr-code-share/qr-code-share.component';
import { ScoreChartCardComponent } from './components/score-chart-card/score-chart-card.component';
import { ComunidadDropdownComponent } from './comunidad-dropdown/comunidad-dropdown.component';
import { ComunidadPickerComponent } from './comunidad-picker/comunidad-picker.component';
import { DificultadDropdownComponent } from './dificultad-dropdown/dificultad-dropdown.component';
import { GenericListComponent } from './generic-list/generic-list.component';
import { OnboardingFormComponent } from './onboarding-form/onboarding-form.component';
import { PasswordInputComponent } from './password-input/password-input.component';
import { PieChartComponent } from './pie-chart/pie-chart.component';
import { CountdownPipe } from './pipes/countdown.pipe';
import { PopupFallosTestComponent } from './popup-fallos-test/popup-fallos-test.component';
import { PrimengModule } from './primeng.module';
import { RealizarTestComponent } from './realizar-test/realizar-test.component';
import { SharedGridComponent } from './shared-grid/shared-grid.component';
import { TemaSelectComponent } from './tema-select/tema-select.component';

@NgModule({
  declarations: [
    SharedGridComponent,
    ComunidadPickerComponent,
    ComunidadDropdownComponent,
    PieChartComponent,
    CountdownPipe,
    DificultadDropdownComponent,
    PasswordInputComponent,
    AvatarUploadComponent,
    TemaSelectComponent, RealizarTestComponent,
    PopupFallosTestComponent,
    QrCodeShareComponent,
    MetodoCalificacionPickerComponent,
    ScoreChartCardComponent,
    KpiStatsCardsComponent,
    ConfidenceAnalysisCardsComponent,
    AttachmentsManagerComponent
  ],
  imports: [
    CommonModule,
    BadgeModule,
    ButtonModule,
    CalendarModule,
    DialogModule,
    DropdownModule,
    FloatLabelModule,
    FormsModule,
    ReactiveFormsModule,
    PrimengModule,
    RouterModule,
    InputTextModule,
    TooltipModule,
    DataViewModule,
    PaginatorModule,
    NgxEchartsModule,
    GenericListComponent,
    OnboardingFormComponent,
    AsyncButtonComponent
  ],
  exports: [
    SharedGridComponent,
    ComunidadPickerComponent,
    ComunidadDropdownComponent,
    PieChartComponent,
    CountdownPipe,
    PrimengModule,
    FormsModule,
    ReactiveFormsModule,
    DificultadDropdownComponent,
    PasswordInputComponent,
    AvatarUploadComponent, RealizarTestComponent,
    TemaSelectComponent,
    PopupFallosTestComponent,
    QrCodeShareComponent,
    MetodoCalificacionPickerComponent,
    ScoreChartCardComponent,
    KpiStatsCardsComponent,
    ConfidenceAnalysisCardsComponent,
    AttachmentsManagerComponent,
    AsyncButtonComponent,
    BadgeModule,
    FloatLabelModule,
    OnboardingFormComponent
  ],
})
export class SharedModule { }
