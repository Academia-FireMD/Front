import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import Hls from 'hls.js';
import { ToastrService } from 'ngx-toastr';

/**
 * Reproductor de vídeos de Bunny Stream (URL firmada del playlist HLS).
 *
 * 2026-07-22 — Fix Safari/iPad: antes se iframaba la URL firmada del .m3u8
 * en crudo y Safari mostraba el reproductor negro bloqueado (sus políticas
 * anti-rastreo/precarga en iframes de terceros). Ahora usamos un <video>
 * propio: Safari reproduce HLS nativamente y el resto de navegadores van
 * con hls.js sobre la misma URL firmada de Bunny.
 */
@Component({
  selector: 'app-bunny-player',
  standalone: true,
  templateUrl: './bunny-player.component.html',
  styleUrl: './bunny-player.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BunnyPlayerComponent implements AfterViewInit, OnDestroy {
  /** URL firmada del playlist HLS (vz-*.b-cdn.net/<guid>/playlist.m3u8?token=…). */
  playbackUrl = input.required<string>();
  /** Segundos de reproducción actuales (timeupdate real del <video>). */
  tiempoActual = output<number>();
  /** El vídeo llegó al final. */
  terminado = output<void>();

  private readonly player = viewChild<ElementRef<HTMLVideoElement>>('player');

  private readonly toastr = inject(ToastrService);

  private hls: Hls | null = null;

  ngAfterViewInit(): void {
    const video = this.player()?.nativeElement;
    if (!video) return;
    this.initPlayer(video, this.playbackUrl());
  }

  ngOnDestroy(): void {
    this.hls?.destroy();
    this.hls = null;
  }

  private initPlayer(video: HTMLVideoElement, url: string): void {
    if (Hls.isSupported()) {
      // MSE disponible → hls.js (Chrome, Firefox, Edge y Safari moderno).
      // NO decidimos por canPlayType('application/vnd.apple.mpegurl'): hay
      // Chromiums que devuelven 'maybe' y luego no reproducen ("no supported
      // sources", visto en QA 2026-07-22). MSE es un hecho; canPlayType, una
      // promesa.
      this.hls = new Hls();
      this.hls.loadSource(url);
      this.hls.attachMedia(video);
      this.hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          this.toastr.error(
            'No se pudo cargar el vídeo. Recarga la página e inténtalo de nuevo.',
          );
        }
      });
    } else {
      // Sin MSE (Safari antiguo, iPhone < 17): HLS nativo del navegador.
      video.src = url;
    }

    video.addEventListener('timeupdate', this.onTimeUpdate);
    video.addEventListener('ended', this.onEnded);
  }

  private readonly onTimeUpdate = (event: Event): void => {
    const video = event.target as HTMLVideoElement;
    this.tiempoActual.emit(Math.floor(video.currentTime));
  };

  private readonly onEnded = (): void => {
    this.terminado.emit();
  };
}
