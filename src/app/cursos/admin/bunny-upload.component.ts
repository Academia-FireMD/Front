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
  imports: [CommonModule, ProgressBarModule],
  template: `
    <div class="bunny-upload">
      <input
        #fileInput
        type="file"
        accept="video/*"
        style="display: none"
        (change)="onFileSelected($event)"
      />

      @if (!uploading() && !done()) {
        <div
          class="bunny-upload__dropzone"
          [class.is-dragging]="isDragging()"
          (click)="fileInput.click()"
          (dragover)="onDragOver($event)"
          (dragleave)="onDragLeave()"
          (drop)="onDrop($event)"
        >
          <i class="pi pi-video bunny-upload__dropzone-icon"></i>
          <span class="bunny-upload__dropzone-title"
            >Selecciona o arrastra un vídeo</span
          >
          <span class="bunny-upload__dropzone-hint"
            >MP4, MOV, WebM… la duración se detecta automáticamente</span
          >
        </div>
      }

      @if (uploading()) {
        <div class="bunny-upload__progress">
          <div class="bunny-upload__progress-head">
            <i class="pi pi-video"></i>
            @if (selectedFile(); as file) {
              <span class="bunny-upload__filename">{{ file.name }}</span>
            }
            <span class="bunny-upload__percent">{{ progress() }}%</span>
          </div>
          <p-progressBar [value]="progress()" [showValue]="false" />
          <span class="bunny-upload__progress-caption">Subiendo…</span>
        </div>
      }

      @if (done()) {
        <div class="bunny-upload__done">
          <i class="pi pi-check-circle bunny-upload__done-icon"></i>
          <div class="bunny-upload__done-body">
            <span class="bunny-upload__done-title"
              >Vídeo subido correctamente</span
            >
            <small class="bunny-upload__processing-hint">
              Bunny está procesando el vídeo; puede tardar unos minutos en estar
              disponible para reproducir (más tiempo cuanto más largo sea el
              vídeo). Si al abrirlo da error, espera un poco y recarga.
            </small>
          </div>
          <button
            type="button"
            class="bunny-upload__change-btn"
            (click)="fileInput.click()"
          >
            Cambiar vídeo
          </button>
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

      .bunny-upload__dropzone {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.35rem;
        padding: 1.75rem 1rem;
        border: 1.5px dashed var(--cursos-border, #e9ecef);
        border-radius: var(--cursos-radius-sm, 8px);
        background: var(--cursos-canvas, #f8f9fa);
        color: var(--cursos-text-soft, #6b7280);
        cursor: pointer;
        text-align: center;
        transition:
          border-color 0.15s ease,
          background-color 0.15s ease;

        &:hover,
        &.is-dragging {
          border-color: var(--cursos-brand, #bb292a);
          background: var(--cursos-brand-soft, #fbe9e9);
          color: var(--cursos-text, #1f2429);
        }
      }

      .bunny-upload__dropzone-icon {
        font-size: 1.75rem;
        color: var(--cursos-brand, #bb292a);
      }

      .bunny-upload__dropzone-title {
        font-weight: 600;
        color: var(--cursos-text, #1f2429);
      }

      .bunny-upload__dropzone-hint {
        font-size: 0.8rem;
      }

      .bunny-upload__progress {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
        padding: 0.85rem 1rem;
        border: 1px solid var(--cursos-border, #e9ecef);
        border-radius: var(--cursos-radius-sm, 8px);
        background: var(--cursos-surface, #fff);
      }

      .bunny-upload__progress-head {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        color: var(--cursos-text, #1f2429);

        i {
          color: var(--cursos-brand, #bb292a);
        }
      }

      .bunny-upload__filename {
        font-size: 0.875rem;
        font-weight: 600;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .bunny-upload__percent {
        margin-left: auto;
        font-size: 0.85rem;
        font-weight: 600;
        color: var(--cursos-text-soft, #6b7280);
      }

      .bunny-upload__progress-caption {
        font-size: 0.8rem;
        color: var(--cursos-text-soft, #6b7280);
      }

      .bunny-upload__done {
        display: flex;
        align-items: flex-start;
        gap: 0.6rem;
        padding: 0.85rem 1rem;
        border: 1px solid var(--cursos-ok, #1f9d55);
        border-radius: var(--cursos-radius-sm, 8px);
        background: color-mix(in srgb, var(--cursos-ok, #1f9d55) 8%, white);
      }

      .bunny-upload__done-icon {
        color: var(--cursos-ok, #1f9d55);
        font-size: 1.1rem;
        margin-top: 0.15rem;
      }

      .bunny-upload__done-body {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        flex: 1;
        min-width: 0;
      }

      .bunny-upload__done-title {
        font-weight: 600;
        color: var(--cursos-text, #1f2429);
      }

      .bunny-upload__processing-hint {
        color: var(--cursos-text-soft, #6b7280);
      }

      .bunny-upload__change-btn {
        flex-shrink: 0;
        background: none;
        border: none;
        padding: 0;
        color: var(--cursos-brand, #bb292a);
        font-size: 0.85rem;
        font-weight: 600;
        cursor: pointer;
        text-decoration: underline;

        &:hover {
          opacity: 0.8;
        }
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
  protected isDragging = signal(false);

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
    await this.handleFile(file);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(true);
  }

  onDragLeave(): void {
    this.isDragging.set(false);
  }

  async onDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    this.isDragging.set(false);
    const file = event.dataTransfer?.files?.[0] ?? null;
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      this.toast.warning('El archivo debe ser un vídeo.');
      return;
    }
    await this.handleFile(file);
  }

  private async handleFile(file: File): Promise<void> {
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
