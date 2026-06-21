import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  model,
  signal,
} from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { ButtonModule } from 'primeng/button';
import { firstValueFrom } from 'rxjs';
import { CursosAdminService } from '../services/cursos-admin.service';

/**
 * Subida de imagen del curso (miniatura/portada) a Supabase vía el backend.
 * Misma idea que `app-avatar-upload` pero generalizada para cursos: preview +
 * botón de subir/cambiar/quitar. `imageUrl` es un `model()` bidireccional para
 * enlazarlo cómodo con el form de metadatos.
 */
@Component({
  selector: 'app-image-upload',
  standalone: true,
  imports: [ButtonModule],
  templateUrl: './image-upload.component.html',
  styleUrl: './image-upload.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImageUploadComponent {
  /** URL actual (bidireccional: se actualiza al subir/quitar). */
  readonly imageUrl = model<string | null>(null);
  readonly label = input<string>('Imagen');

  private readonly service = inject(CursosAdminService);
  private readonly toast = inject(ToastrService);

  readonly uploading = signal(false);

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.toast.warning('El archivo debe ser una imagen.');
      return;
    }
    this.uploading.set(true);
    try {
      const { url } = await firstValueFrom(this.service.uploadImage(file));
      this.imageUrl.set(url);
      this.toast.success('Imagen subida.');
    } catch {
      this.toast.error('No se pudo subir la imagen.');
    } finally {
      this.uploading.set(false);
      input.value = ''; // permite re-subir el mismo archivo
    }
  }

  quitar(): void {
    this.imageUrl.set(null);
  }
}
