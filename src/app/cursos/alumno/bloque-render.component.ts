import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { MarkdownComponent } from 'ngx-markdown';
import { BunnyPlayerComponent } from '../../shared/bunny-player/bunny-player.component';
import { Bloque } from '../models/curso.model';
import { HidraulicaSyncEstado } from '../services/hidraulica-interactivo.service';
import { BloqueCuestionarioComponent } from './bloque-cuestionario.component';
import { BloqueDocumentoComponent } from './bloque-documento.component';
import { BloqueInteractivoComponent } from './bloque-interactivo.component';
import { BloqueTestInlineComponent } from './bloque-test-inline.component';

/**
 * Renderiza un bloque de la lección en el aula. Un bloque es un widget de
 * contenido; la lección los apila. Tipos:
 *  - VIDEO  → reproductor Bunny (app-bunny-player; sin heartbeat, el
 *    progreso es por lección).
 *  - TEXTO  → markdown.
 *  - TEST   → motor de tests embebido in situ (app-bloque-test-inline).
 *  - CUESTIONARIO → quiz propio autocorregido (app-bloque-cuestionario).
 *  - DOCUMENTO → tarjeta de descarga protegida + visor PDF inline.
 *  - INTERACTIVO → aplicación autocontenida (Hidráulica) en iframe Blob.
 */
@Component({
  selector: 'app-bloque-render',
  standalone: true,
  imports: [
    MarkdownComponent,
    BunnyPlayerComponent,
    BloqueTestInlineComponent,
    BloqueCuestionarioComponent,
    BloqueDocumentoComponent,
    BloqueInteractivoComponent,
  ],
  templateUrl: './bloque-render.component.html',
  styleUrl: './bloque-render.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.bloque-render-inmersivo]': 'inmersivo()',
  },
})
export class BloqueRenderComponent {
  bloque = input.required<Bloque>();
  /** URL firmada del vídeo (solo bloques VIDEO). */
  playbackUrl = input<string | null>(null);
  /** En preview admin no se llama al backend ni se navega. */
  preview = input<boolean>(false);
  /** Aula APLICACION a pantalla completa. */
  inmersivo = input<boolean>(false);
  /** Contador del padre para reintentar la app sin recrear el iframe. */
  solicitudReintento = input<number>(0);
  /** Burbujea el estado de sync del bloque interactivo a la cabecera nativa. */
  readonly syncInteractivo = output<{
    estado: HidraulicaSyncEstado;
    texto: string;
    puedeReintentar: boolean;
  }>();

  /** Burbujea cuando un bloque interactivo (TEST/CUESTIONARIO) se completa. */
  readonly completado = output<void>();
}
