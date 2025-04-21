import { CommonModule } from '@angular/common';
import { LOCALE_ID, NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';

import { MarkdownModule } from 'ngx-markdown';
import { ConfirmationService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ChipModule } from 'primeng/chip';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { DividerModule } from 'primeng/divider';
import { InputOtpModule } from 'primeng/inputotp';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TableModule } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';
import { RegistroComponent } from '../login/components/registro/registro.component';
import { PrimengModule } from '../shared/primeng.module';
import { SharedModule } from '../shared/shared.module';
import { TestModule } from '../test/test.module';
import { CompletarTestSimulacroComponent } from './components/completar-test-simulacro/completar-test-simulacro.component';
import { RealizarSimulacroComponent } from './components/realizar-simulacro/realizar-simulacro.component';
import { ResultadoSimulacroComponent } from './components/resultado-simulacro/resultado-simulacro.component';
import { SimulacrosRoutingModule } from './simulacros-routing.module';
@NgModule({
  declarations: [
    RealizarSimulacroComponent,
    CompletarTestSimulacroComponent,
    ResultadoSimulacroComponent
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    PrimengModule,
    MarkdownModule,
    SimulacrosRoutingModule,
    SharedModule,
    ButtonModule,
    ChipModule,
    DividerModule,
    DialogModule,
    ConfirmDialogModule,
    InputOtpModule,
    RegistroComponent,
    TestModule,
    ProgressSpinnerModule,
    TableModule,
    CardModule,
    TooltipModule
  ],
  providers: [
    ConfirmationService,
    { provide: LOCALE_ID, useValue: 'es' },

  ],
})
export class SimulacrosModule { }
