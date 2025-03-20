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
import {
  CalendarDateFormatter,
  CalendarModule,
  CalendarNativeDateFormatter,
  DateAdapter,
  DateFormatterParams,
} from 'angular-calendar';
import { adapterFactory } from 'angular-calendar/date-adapters/date-fns';
import { endOfWeek, format, getISOWeek, startOfWeek } from 'date-fns';
import * as echarts from 'echarts';
import { NgxEchartsModule } from 'ngx-echarts';
import { MarkdownModule } from 'ngx-markdown';
import { NgxSpinnerModule } from 'ngx-spinner';
import { ToastrModule } from 'ngx-toastr';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { MenuModule } from 'primeng/menu';
import { PanelMenuModule } from 'primeng/panelmenu';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { AuthInterceptor } from './services/auth.interceptor';
import { SpinnerInterceptor } from './services/spinner.interceptor';
import { LayoutComponent } from './shared/layout/layout.component';
import { SharedModule } from './shared/shared.module';
registerLocaleData(localeEs);
class CustomDateFormatter extends CalendarNativeDateFormatter {
  // Sobrescribe la hora en la vista diaria
  public override dayViewHour({ date, locale }: DateFormatterParams): string {
    return new Intl.DateTimeFormat(locale, {
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23', // Usa el ciclo de 24 horas
    }).format(date);
  }

  // Sobrescribe la hora en la vista semanal
  public override weekViewHour({ date, locale }: DateFormatterParams): string {
    return new Intl.DateTimeFormat(locale, {
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23', // Usa el ciclo de 24 horas
    }).format(date);
  }
  public override weekViewTitle({ date, locale }: DateFormatterParams): string {
    // Calcula el inicio y el fin de la semana
    const start = startOfWeek(date, { weekStartsOn: 1 }); // Semana comienza en lunes
    const end = endOfWeek(date, { weekStartsOn: 1 });

    // Formatea las fechas
    const formattedStart = new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
    }).format(start);

    const formattedEnd = new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
    }).format(end);

    // Obtiene el número de la semana
    const weekNumber = getISOWeek(date);

    // Devuelve el rango con el número de la semana
    return `Semana ${weekNumber}: ${formattedStart} - ${formattedEnd} ${format(
      start,
      'yyyy'
    )}`;
  }
}
@NgModule({
  declarations: [AppComponent, LayoutComponent],
  imports: [
    BrowserModule,
    AppRoutingModule,
    ButtonModule,
    CardModule,
    MenuModule,
    SharedModule,
    PanelMenuModule,
    MarkdownModule.forRoot(),
    BrowserAnimationsModule, // required animations module
    ToastrModule.forRoot({ positionClass: 'toast-top-left' }), // ToastrModule added
    NgxEchartsModule.forRoot({ echarts }),
    NgxSpinnerModule.forRoot(),
    CalendarModule.forRoot({
      provide: DateAdapter,
      useFactory: adapterFactory,
    }),
  ],
  providers: [
    provideHttpClient(withInterceptorsFromDi()),
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      multi: true,
    },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: SpinnerInterceptor,
      multi: true,
    },
    { provide: LOCALE_ID, useValue: 'es' },
    {
      provide: DateAdapter,
      useFactory: adapterFactory,
    },
    { provide: CalendarDateFormatter, useClass: CustomDateFormatter },
  ],
  bootstrap: [AppComponent],
})
export class AppModule { }
