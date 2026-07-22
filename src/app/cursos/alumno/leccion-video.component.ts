import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  inject,
  input,
  signal,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { ToastrService } from 'ngx-toastr';
import { BunnyPlayerComponent } from '../../shared/bunny-player/bunny-player.component';
import { CursosAlumnoService } from '../services/cursos-alumno.service';
import { Leccion } from '../models/curso.model';

const HEARTBEAT_INTERVAL_MS = 15_000;

@Component({
  selector: 'app-leccion-video',
  standalone: true,
  imports: [ButtonModule, DecimalPipe, BunnyPlayerComponent],
  templateUrl: './leccion-video.component.html',
  styleUrl: './leccion-video.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeccionVideoComponent implements OnInit, OnDestroy {
  leccion = input.required<Leccion>();
  playbackUrl = input.required<string>();
  /**
   * Dentro del aula el control "Marcar completada" lo dueña el footer del shell
   * (evita botón duplicado). El heartbeat de progreso sigue activo igualmente.
   */
  enAula = input<boolean>(false);

  private readonly service = inject(CursosAlumnoService);
  private readonly toastr = inject(ToastrService);

  segundosVisto = signal(0);
  marcando = signal(false);
  // Set true once the user marks the lesson complete (manually or by
  // reaching 100% playback). Stops the heartbeat from clobbering the
  // server-side completed state with a later partial update.
  completada = signal(false);

  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.startHeartbeat();
  }

  ngOnDestroy(): void {
    this.clearHeartbeat();
  }

  /** Progreso real: lo emite app-bunny-player (timeupdate del <video>). */
  onTiempoActual(segundos: number): void {
    this.segundosVisto.set(segundos);
  }

  onTerminado(): void {
    const duracion = this.leccion().duracionSegundos;
    const segs = duracion ?? this.segundosVisto();
    this.segundosVisto.set(segs);
    this.enviarProgreso(segs, 100, false);
    this.clearHeartbeat();
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.completada()) {
        // Already marked complete on the server. Stop heartbeating so a
        // later partial tick doesn't overwrite completada back to false.
        this.clearHeartbeat();
        return;
      }
      const segs = this.segundosVisto();
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
          this.completada.set(true);
          this.clearHeartbeat();
          this.toastr.success('Lección marcada como vista');
        },
        error: () => {
          this.marcando.set(false);
        },
      });
  }
}
