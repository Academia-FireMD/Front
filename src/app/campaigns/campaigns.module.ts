import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CampaignsRoutingModule } from './campaigns-routing.module';
import { CampaignOverviewComponent } from './components/campaign-overview/campaign-overview.component';
import { CampaignDetailComponent } from './components/campaign-detail/campaign-detail.component';
import { CampaignFormComponent } from './components/campaign-form/campaign-form.component';
import { SharedModule } from '../shared/shared.module';
import { GenericListComponent } from '../shared/generic-list/generic-list.component';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { CalendarModule } from 'primeng/calendar';
import { InputSwitchModule } from 'primeng/inputswitch';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { DropdownModule } from 'primeng/dropdown';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { BadgeModule } from 'primeng/badge';
import { ConfirmationService } from 'primeng/api';

@NgModule({
  declarations: [
    CampaignOverviewComponent,
    CampaignDetailComponent,
    CampaignFormComponent,
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    CampaignsRoutingModule,
    SharedModule,
    GenericListComponent,
    ButtonModule,
    CardModule,
    TableModule,
    InputTextModule,
    CalendarModule,
    InputSwitchModule,
    InputTextareaModule,
    DropdownModule,
    TagModule,
    TooltipModule,
    ConfirmDialogModule,
    IconFieldModule,
    InputIconModule,
    BadgeModule,
  ],
  providers: [ConfirmationService],
})
export class CampaignsModule {}
