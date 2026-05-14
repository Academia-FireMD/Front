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
        @if (selectedFile()) {
          <span class="bunny-upload__filename">{{ selectedFile()!.name }}</span>
          <p-button
            label="Subir"
            icon="pi pi-cloud-upload"
            (onClick)="startUpload()"
          />
        }
      } @else {
        <div class="bunny-upload__progress">
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

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.selectedFile.set(file);
    this.done.set(false);
    this.progress.set(0);
  }

  async startUpload(): Promise<void> {
    const file = this.selectedFile();
    if (!file) return;

    const title = this.videoTitle() || file.name;

    try {
      const credentials = await firstValueFrom(
        this.cursosAdminService.requestVideoUploadUrl(title),
      );

      this.uploading.set(true);
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
        onProgress: (sent, total) => {
          this.progress.set(Math.round((sent / total) * 100));
        },
        onSuccess: () => {
          this.uploading.set(false);
          this.done.set(true);
          this.uploaded.emit({ guid: credentials.VideoId });
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
}
