import { LOCALE_ID, NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { registerLocaleData } from '@angular/common';
import {
  HTTP_INTERCEPTORS,
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import localeEs from '@angular/common/locales/es';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ToastrModule } from 'ngx-toastr';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { MenuModule } from 'primeng/menu';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { AuthInterceptor } from './services/auth.interceptor';
import { LayoutComponent } from './shared/layout/layout.component';
import { SharedModule } from './shared/shared.module';
registerLocaleData(localeEs);
@NgModule({
  declarations: [AppComponent, LayoutComponent],
  imports: [
    BrowserModule,
    AppRoutingModule,
    ButtonModule,
    CardModule,
    MenuModule,
    SharedModule,
    BrowserAnimationsModule, // required animations module
    ToastrModule.forRoot(), // ToastrModule added
  ],
  providers: [
    provideHttpClient(withInterceptorsFromDi()),
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      multi: true,
    },
    { provide: LOCALE_ID, useValue: 'es-ES' },
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
