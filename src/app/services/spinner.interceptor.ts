import {
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
} from '@angular/common/http';
import { Injectable } from '@angular/core';
import { NgxSpinnerService } from 'ngx-spinner';
import { Observable, timer } from 'rxjs';
import { finalize } from 'rxjs/operators';

@Injectable()
export class SpinnerInterceptor implements HttpInterceptor {
  private activeRequests = 0; // Contador de peticiones activas

  constructor(private spinner: NgxSpinnerService) {}

  intercept(
    req: HttpRequest<any>,
    next: HttpHandler
  ): Observable<HttpEvent<any>> {
    this.activeRequests++; // Incrementar contador cuando la petición comienza

    const request$ = next.handle(req);

    timer(1000).subscribe(() => {
      if (this.activeRequests > 0) {
        this.spinner.show(); // Mostrar el spinner si hay peticiones activas
      }
    });

    return request$.pipe(
      finalize(() => {
        this.activeRequests--; // Decrementar contador cuando la petición finaliza
        if (this.activeRequests === 0) {
          this.spinner.hide(); // Ocultar el spinner cuando no haya más peticiones activas
        }
      })
    );
  }
}
