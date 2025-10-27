import { CommonModule, registerLocaleData } from '@angular/common';
import { LOCALE_ID, NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import localeEs from '@angular/common/locales/es';
import { AccordionModule } from 'primeng/accordion';
import { ConfirmationService } from 'primeng/api';
import { FileUploadModule } from 'primeng/fileupload';
import { AsyncButtonComponent } from '../shared/components/async-button/async-button.component';
import { GenericListComponent } from '../shared/generic-list/generic-list.component';
import { PrimengModule } from '../shared/primeng.module';
import { SharedModule } from '../shared/shared.module';
import { DocumentacionRoutingModule } from './documentacion-routing.module';
import { DocumentationOverviewComponent } from './documentation-overview/documentation-overview.component';
import { ReleaseManagementComponent } from './release-management/release-management.component';
registerLocaleData(localeEs);
@NgModule({
  declarations: [DocumentationOverviewComponent, ReleaseManagementComponent],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    SharedModule,
    PrimengModule,
    FileUploadModule,
    AccordionModule,
    DocumentacionRoutingModule,
    AsyncButtonComponent,
    GenericListComponent,
  ],
  providers: [ConfirmationService, { provide: LOCALE_ID, useValue: 'es' }],
})
export class DocumentacionModule { }
