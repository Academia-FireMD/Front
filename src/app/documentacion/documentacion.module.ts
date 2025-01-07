import { CommonModule, registerLocaleData } from '@angular/common';
import { LOCALE_ID, NgModule } from '@angular/core';

import localeEs from '@angular/common/locales/es';
import { ConfirmationService } from 'primeng/api';
import { FileUploadModule } from 'primeng/fileupload';
import { PrimengModule } from '../shared/primeng.module';
import { SharedModule } from '../shared/shared.module';
import { DocumentacionRoutingModule } from './documentacion-routing.module';
import { DocumentationOverviewComponent } from './documentation-overview/documentation-overview.component';
registerLocaleData(localeEs);
@NgModule({
  declarations: [DocumentationOverviewComponent],
  imports: [
    CommonModule,
    SharedModule,
    PrimengModule,
    FileUploadModule,
    DocumentacionRoutingModule,
  ],
  providers: [ConfirmationService, { provide: LOCALE_ID, useValue: 'es' }],
})
export class DocumentacionModule {}
