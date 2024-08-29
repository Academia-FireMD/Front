import {
  ChangeDetectorRef,
  inject,
  OnDestroy,
  Pipe,
  PipeTransform,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';

@Pipe({
  name: 'countdown',
  pure: false, // Hacer que el pipe se reevalúe constantemente
})
export class CountdownPipe implements PipeTransform, OnDestroy {
  private intervalId: any;
  private lastValue: string = '';
  private activatedRoute: ActivatedRoute = inject(ActivatedRoute);
  private router = inject(Router);
  private toast = inject(ToastrService);

  constructor(private cdr: ChangeDetectorRef) {
    // Inicia el intervalo para actualizar el valor cada segundo
    this.intervalId = setInterval(() => {
      this.cdr.markForCheck(); // Marca para comprobación de cambios
    }, 1000);
  }

  transform(value: Date): string {
    const now = new Date().getTime();
    const endTime = new Date(value).getTime();
    const distance = endTime - now;

    if (distance < 0) {
      this.cleanup();
      if (
        this.activatedRoute?.snapshot?.routeConfig?.path == 'realizar-test/:id'
      ) {
        this.router.navigate([
          'app/test/alumno/stats-test/' +
            (this.activatedRoute.snapshot?.params as any)?.id,
        ]);
        this.toast.info('El tiempo ha terminado!');
      }
      return '00:00:00'; // El tiempo ha expirado
    }

    const hours = Math.floor((distance / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((distance / (1000 * 60)) % 60);
    const seconds = Math.floor((distance / 1000) % 60);

    this.lastValue = `${this.pad(hours)}:${this.pad(minutes)}:${this.pad(
      seconds
    )}`;
    return this.lastValue;
  }

  private pad(num: number): string {
    return num < 10 ? '0' + num : num.toString();
  }

  ngOnDestroy() {
    this.cleanup();
  }

  private cleanup() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }
}
