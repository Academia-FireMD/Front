import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ButtonModule } from 'primeng/button';
import { ToastrService } from 'ngx-toastr';
import { CursosAlumnoService } from '../services/cursos-alumno.service';
import { Leccion } from '../models/curso.model';

const HEARTBEAT_INTERVAL_MS = 15_000;

@Component({
  selector: 'app-leccion-video',
  standalone: true,
  imports: [ButtonModule, DecimalPipe],
  templateUrl: './leccion-video.component.html',
  styleUrl: './leccion-video.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeccionVideoComponent implements OnInit, OnDestroy {
  leccion = input.required<Leccion>();
  playbackUrl = input.required<string>();

  private readonly sanitizer = inject(DomSanitizer);
  private readonly service = inject(CursosAlumnoService);
  private readonly toastr = inject(ToastrService);

  safeUrl = signal<SafeResourceUrl>('');
  segundosVisto = signal(0);
  marcando = signal(false);

  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.safeUrl.set(
      this.sanitizer.bypassSecurityTrustResourceUrl(this.playbackUrl()),
    );
    this.startHeartbeat();
  }

  ngOnDestroy(): void {
    this.clearHeartbeat();
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      const segs = this.segundosVisto() + HEARTBEAT_INTERVAL_MS / 1000;
      this.segundosVisto.set(segs);
      const duracion = this.leccion().duracionSegundos;
      const porcentaje = duracion
        ? Math.min(100, Math.round((segs / duracion) * 100))
        : 0;
      this.enviarProgreso(segs, porcentaje, false);
    }, HEARTBEAT_INTERVAL_MS);
  }

  private clearHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private enviarProgreso(
    segundos: number,
    porcentaje: number,
    completada: boolean,
  ): void {
    this.service
      .upsertProgreso(this.leccion().id, {
        segundosVisto: Math.round(segundos),
        porcentajeVisto: porcentaje,
        completada,
      })
      .subscribe({ error: () => {} }); // silencioso en heartbeat
  }

  marcarComoVista(): void {
    this.marcando.set(true);
    const segs = this.segundosVisto();
    this.service
      .upsertProgreso(this.leccion().id, {
        segundosVisto: Math.round(segs),
        porcentajeVisto: 100,
        completada: true,
      })
      .subscribe({
        next: () => {
          this.marcando.set(false);
          this.toastr.success('Lección marcada como vista');
        },
        error: () => {
          this.marcando.set(false);
        },
      });
  }
}
