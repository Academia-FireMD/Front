import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

/**
 * Wrapper aislado para la beta de Alicante. No incorpora AuthService ni
 * postMessage: el documento no recibe credenciales de la plataforma.
 */
@Component({
  selector: 'app-callejero-alicante',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './callejero-alicante.component.html',
  styleUrl: '../embed/callejero-embed.component.scss',
})
export class CallejeroAlicanteComponent {
  private readonly sanitizer = inject(DomSanitizer);
  readonly src: SafeResourceUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
    '/callejero-embed/alicante_16.html',
  );
}
