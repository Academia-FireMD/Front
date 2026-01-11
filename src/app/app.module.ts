import { APP_INITIALIZER, Injectable, LOCALE_ID, NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { EffectsModule } from '@ngrx/effects';
import { StoreModule } from '@ngrx/store';
import { StoreDevtoolsModule } from '@ngrx/store-devtools';

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
import { ConfirmationService, PrimeNGConfig } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { MenuModule } from 'primeng/menu';
import { PanelMenuModule } from 'primeng/panelmenu';
import { environment } from '../environments/environment';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { BajaSuscripcionComponent } from './profile/baja-suscripcion/baja-suscripcion.component';
import { CambioOposicionComponent } from './profile/cambio-oposicion/cambio-oposicion.component';
import { CambioSuscripcionComponent } from './profile/cambio-suscripcion/cambio-suscripcion.component';
import { ProfileComponent } from './profile/profile.component';
import { AuthInterceptor } from './services/auth.interceptor';
import { SpinnerInterceptor } from './services/spinner.interceptor';
import { AsyncButtonComponent } from './shared/components/async-button/async-button.component';
import { ErrorInterceptor } from './shared/interceptors/error.interceptor';
import { LayoutComponent } from './shared/layout/layout.component';
import { SharedModule } from './shared/shared.module';
import { UserEffects } from './store/user/user.effects';
import { userReducer } from './store/user/user.reducer';
registerLocaleData(localeEs);

// Inicializador para configurar PrimeNG globalmente en v17
export function primengInitFactory(primeng: PrimeNGConfig) {
  return () => {
    primeng.ripple = true; // opcional
    primeng.setTranslation({
      dayNames: ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'],
      dayNamesShort: ['dom','lun','mar','mié','jue','vie','sáb'],
      dayNamesMin: ['D','L','M','X','J','V','S'],
      monthNames: ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'],
      monthNamesShort: ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'],
      firstDayOfWeek: 1,
      dateFormat: 'dd/mm/yy', // dd/mm/yyyy en PrimeNG
      today: 'Hoy',
      clear: 'Limpiar',
    });
  };
}
@Injectable()
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
  declarations: [AppComponent, LayoutComponent, ProfileComponent, CambioOposicionComponent],
  imports: [
    BrowserModule,
    AppRoutingModule,
    ButtonModule,
    CardModule,
    MenuModule,
    SharedModule,
    PanelMenuModule,
    ConfirmDialogModule,
    MarkdownModule.forRoot(),
    BrowserAnimationsModule, // required animations module
    ToastrModule.forRoot({ positionClass: 'toast-top-center' }), // ToastrModule added
    NgxEchartsModule.forRoot({ echarts }),
    NgxSpinnerModule.forRoot(),
    CalendarModule.forRoot({
      provide: DateAdapter,
      useFactory: adapterFactory,
    }),
    AsyncButtonComponent,
    BajaSuscripcionComponent,
    CambioSuscripcionComponent,
    StoreModule.forRoot({ user: userReducer }),
    EffectsModule.forRoot([UserEffects]),
    StoreDevtoolsModule.instrument({
      maxAge: 25,
      logOnly: environment.production,
    }),
  ],
  providers: [
    provideHttpClient(withInterceptorsFromDi()),
    ConfirmationService,
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
    {
      provide: HTTP_INTERCEPTORS,
      useClass: ErrorInterceptor,
      multi: true,
    },
    { provide: LOCALE_ID, useValue: 'es' },
    {
      provide: APP_INITIALIZER,
      useFactory: primengInitFactory,
      deps: [PrimeNGConfig],   // <- IMPORTANTE
      multi: true,
    },
    {
      provide: DateAdapter,
      useFactory: adapterFactory,
    },
    { provide: CalendarDateFormatter, useClass: CustomDateFormatter },
  ],
  bootstrap: [AppComponent],
})
export class AppModule { }
