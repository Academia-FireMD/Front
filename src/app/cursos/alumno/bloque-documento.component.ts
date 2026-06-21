import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  OnDestroy,
  signal,
} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ButtonModule } from 'primeng/button';
import { firstValueFrom } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { Bloque } from '../models/curso.model';
import { CursosAlumnoService } from '../services/cursos-alumno.service';

/**
 * Renderiza un bloque DOCUMENTO en el aula (2026-06-16). La descarga es
 * PROTEGIDA: pide el archivo a `GET /cursos/bloques/:id/documento` con el token
 * de auth (vía HttpClient + AuthInterceptor), obtiene el blob y crea un
 * objectURL — nunca una URL pública. Tarjeta con icono + nombre + tamaño +
 * botón Descargar; si el MIME es PDF, además un visor inline (`<iframe>`).
 */
@Component({
  selector: 'app-bloque-documento',
  standalone: true,
  imports: [ButtonModule],
  templateUrl: './bloque-documento.component.html',
  styleUrl: './bloque-documento.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BloqueDocumentoComponent implements OnDestroy {
  bloque = input.required<Bloque>();
  /** En preview admin no se descarga del backend. */
  preview = input<boolean>(false);

  private readonly service = inject(CursosAlumnoService);
  private readonly toast = inject(ToastrService);
  private readonly sanitizer = inject(DomSanitizer);

  readonly descargando = signal(false);
  /** objectURL del blob para el visor inline de PDF (se revoca al destruir). */
  private readonly pdfObjectUrl = signal<string | null>(null);
  readonly cargandoVisor = signal(false);

  readonly esPdf = computed(
    () => this.bloque().documentoMime === 'application/pdf',
  );

  readonly nombre = computed(
    () => this.bloque().documentoNombre || 'Documento',
  );

  readonly tamanoLegible = computed(() => {
    const bytes = this.bloque().documentoTamanoBytes;
    if (bytes == null || bytes <= 0) return '';
    const units = ['B', 'KB', 'MB', 'GB'];
    let value = bytes;
    let i = 0;
    while (value >= 1024 && i < units.length - 1) {
      value /= 1024;
      i++;
    }
    return `${value.toFixed(value < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
  });

  readonly safePdfUrl = computed<SafeResourceUrl | null>(() => {
    const url = this.pdfObjectUrl();
    return url ? this.sanitizer.bypassSecurityTrustResourceUrl(url) : null;
  });

  /** Descarga el documento (blob protegido → objectURL → click sintético). */
  async descargar(): Promise<void> {
    if (this.preview() || this.descargando()) return;
    this.descargando.set(true);
    try {
      const blob = await firstValueFrom(
        this.service.descargarDocumento(this.bloque().id),
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = this.nombre();
      a.click();
      // Revocar tras un tick para no abortar la descarga en curso.
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch {
      this.toast.error('No se pudo descargar el documento.');
    } finally {
      this.descargando.set(false);
    }
  }

  /** Carga el PDF como blob y lo muestra en el visor inline. */
  async verEnVisor(): Promise<void> {
    if (this.preview() || this.cargandoVisor() || this.pdfObjectUrl()) return;
    this.cargandoVisor.set(true);
    try {
      const blob = await firstValueFrom(
        this.service.descargarDocumento(this.bloque().id),
      );
      this.pdfObjectUrl.set(URL.createObjectURL(blob));
    } catch {
      this.toast.error('No se pudo cargar el visor del PDF.');
    } finally {
      this.cargandoVisor.set(false);
    }
  }

  ngOnDestroy(): void {
    const url = this.pdfObjectUrl();
    if (url) URL.revokeObjectURL(url);
  }
}
