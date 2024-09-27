import {
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
} from '@angular/common/http';
import { Injectable } from '@angular/core';
import { NgxSpinnerService } from 'ngx-spinner';
import { Observable, of, timer } from 'rxjs';
import { finalize, switchMap } from 'rxjs/operators';

@Injectable()
export class SpinnerInterceptor implements HttpInterceptor {
  constructor(private spinner: NgxSpinnerService) {}

  intercept(
    req: HttpRequest<any>,
    next: HttpHandler
  ): Observable<HttpEvent<any>> {
    let hasTimedOut = false;

    // Temporizador de 500ms antes de mostrar el spinner
    const spinnerTimer = timer(1000).pipe(
      switchMap(() => {
        hasTimedOut = true;
        this.spinner.show();
        return of(null); // Devuelve un observable vacío para continuar
      })
    );

    return spinnerTimer.pipe(
      switchMap(() => next.handle(req)), // Continuar con la solicitud HTTP
      finalize(() => {
        if (hasTimedOut) {
          this.spinner.hide();
        }
      })
    );
  }
}
