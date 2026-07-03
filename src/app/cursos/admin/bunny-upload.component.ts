import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  signal,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import * as tus from 'tus-js-client';
import { firstValueFrom } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { ProgressBarModule } from 'primeng/progressbar';
import { ToastrService } from 'ngx-toastr';
import { CursosAdminService } from '../services/cursos-admin.service';

export interface UploadedEvent {
  guid: string;
  duracionSegundos?: number;
}

@Component({
  selector: 'app-bunny-upload',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ButtonModule, ProgressBarModule],
  template: `
    <div class="bunny-upload">
      @if (!uploading()) {
        <input
          #fileInput
          type="file"
          accept="video/*"
          style="display:none"
          (change)="onFileSelected($event)"
        />
        <p-button
          label="Seleccionar vídeo"
          icon="pi pi-upload"
          severity="secondary"
          (onClick)="fileInput.click()"
        />
      } @else {
        <div class="bunny-upload__progress">
          @if (selectedFile(); as file) {
            <span class="bunny-upload__filename">{{ file.name }}</span>
          }
          <span>Subiendo… {{ progress() }}%</span>
          <p-progressBar [value]="progress()" />
        </div>
      }
      @if (done()) {
        <div class="bunny-upload__done">
          <i class="pi pi-check-circle" style="color: var(--green-500)"></i>
          <span>Vídeo subido correctamente</span>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .bunny-upload {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }
      .bunny-upload__filename {
        font-size: 0.875rem;
        color: var(--text-color-secondary);
      }
      .bunny-upload__progress {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }
      .bunny-upload__done {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
    `,
  ],
})
export class BunnyUploadComponent {
  readonly videoTitle = input<string>('');

  readonly uploaded = output<UploadedEvent>();

  protected selectedFile = signal<File | null>(null);
  protected uploading = signal(false);
  protected progress = signal(0);
  protected done = signal(false);

  private cursosAdminService = inject(CursosAdminService);
  private toast = inject(ToastrService);

  /**
   * Auto-inicio de subida (2026-07-03): al seleccionar el archivo se arranca
   * la subida inmediatamente — ya no hay botón "Subir" ni paso intermedio.
   * `uploading` se marca aquí mismo (no dentro de `startUpload`) para que la
   * UI cambie de inmediato a la vista de progreso y no deje una ventana en
   * la que se pueda volver a pulsar "Seleccionar vídeo" mientras se piden
   * las credenciales/duración.
   */
  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    // Limpia el input para que seleccionar el MISMO fichero dos veces
    // seguidas (p.ej. tras un error) vuelva a disparar el evento `change`.
    input.value = '';
    if (!file) return;

    this.selectedFile.set(file);
    this.done.set(false);
    this.progress.set(0);
    this.uploading.set(true);

    await this.startUpload(file);
  }

  private async startUpload(file: File): Promise<void> {
    const title = this.videoTitle() || file.name;

    try {
      // Se piden credenciales y duración en paralelo: la lectura de
      // duración (hasta ~5s de timeout defensivo) no debe alargar el
      // arranque de la subida más de lo necesario.
      const [credentials, duracionSegundos] = await Promise.all([
        firstValueFrom(this.cursosAdminService.requestVideoUploadUrl(title)),
        this.leerDuracionVideo(file),
      ]);

      this.progress.set(0);

      const upload = new tus.Upload(file, {
        endpoint: credentials.endpoint,
        retryDelays: [0, 3000, 5000, 10000, 20000, 60000, 120000],
        headers: {
          AuthorizationSignature: credentials.AuthorizationSignature,
          AuthorizationExpire: String(credentials.AuthorizationExpire),
          LibraryId: credentials.LibraryId,
          VideoId: credentials.VideoId,
        },
        metadata: {
          filetype: file.type,
          title,
        },
        onError: (err) => {
          this.uploading.set(false);
          this.toast.error(`Error al subir el vídeo: ${err.message ?? err}`);
        },
        onProgress: (sent: number, total: number) => {
          this.progress.set(Math.round((sent / total) * 100));
        },
        onSuccess: () => {
          this.uploading.set(false);
          this.done.set(true);
          this.uploaded.emit({
            guid: credentials.VideoId,
            duracionSegundos: duracionSegundos ?? undefined,
          });
        },
      });

      upload.start();
    } catch {
      this.uploading.set(false);
      this.toast.error(
        'No se pudo obtener la URL de subida. Intenta de nuevo.',
      );
    }
  }

  /**
   * Lee la duración del vídeo EN EL NAVEGADOR (sin depender de que Bunny
   * procese el archivo, que tarda) creando un `<video>` fuera del DOM
   * visible y escuchando `loadedmetadata`. Defensivo: nunca rechaza y nunca
   * bloquea la subida — ante timeout (~5s) o error de lectura, resuelve
   * `null` y el campo de duración del formulario de bloque se queda
   * editable manualmente como fallback (ver `bloque-form.component.ts`).
   */
  private leerDuracionVideo(file: File): Promise<number | null> {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;

      const objectUrl = URL.createObjectURL(file);
      let settled = false;

      const finish = (value: number | null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        video.removeEventListener('loadedmetadata', onLoadedMetadata);
        video.removeEventListener('error', onError);
        URL.revokeObjectURL(objectUrl);
        resolve(value);
      };

      const onLoadedMetadata = () => {
        const duration = video.duration;
        finish(Number.isFinite(duration) ? Math.round(duration) : null);
      };

      const onError = () => finish(null);

      const timeoutId = setTimeout(() => finish(null), 5000);

      video.addEventListener('loadedmetadata', onLoadedMetadata);
      video.addEventListener('error', onError);
      video.src = objectUrl;
    });
  }
}
