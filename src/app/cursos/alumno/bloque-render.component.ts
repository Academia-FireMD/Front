import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { MarkdownComponent } from 'ngx-markdown';
import { Bloque } from '../models/curso.model';
import { BloqueCuestionarioComponent } from './bloque-cuestionario.component';
import { BloqueDocumentoComponent } from './bloque-documento.component';
import { BloqueTestInlineComponent } from './bloque-test-inline.component';

/**
 * Renderiza un bloque de la lección en el aula. Un bloque es un widget de
 * contenido; la lección los apila. Tipos:
 *  - VIDEO  → iframe Bunny (sin heartbeat; el progreso es por lección).
 *  - TEXTO  → markdown.
 *  - TEST   → motor de tests embebido in situ (app-bloque-test-inline).
 *  - CUESTIONARIO → quiz propio autocorregido (app-bloque-cuestionario).
 *  - DOCUMENTO → tarjeta de descarga protegida + visor PDF inline.
 */
@Component({
  selector: 'app-bloque-render',
  standalone: true,
  imports: [
    MarkdownComponent,
    BloqueTestInlineComponent,
    BloqueCuestionarioComponent,
    BloqueDocumentoComponent,
  ],
  templateUrl: './bloque-render.component.html',
  styleUrl: './bloque-render.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BloqueRenderComponent {
  bloque = input.required<Bloque>();
  /** URL firmada del vídeo (solo bloques VIDEO). */
  playbackUrl = input<string | null>(null);
  /** En preview admin no se llama al backend ni se navega. */
  preview = input<boolean>(false);

  /** Burbujea cuando un bloque interactivo (TEST/CUESTIONARIO) se completa. */
  readonly completado = output<void>();

  private readonly sanitizer = inject(DomSanitizer);

  readonly safeVideoUrl = computed<SafeResourceUrl | null>(() => {
    const url = this.playbackUrl();
    return url ? this.sanitizer.bypassSecurityTrustResourceUrl(url) : null;
  });
}
