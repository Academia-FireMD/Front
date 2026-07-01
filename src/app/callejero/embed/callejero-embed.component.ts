import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

/**
 * Callejero (embed v27) — incrusta el HTML autónomo de Raúl tal cual en un
 * iframe, para paridad visual 1:1 exacta con lo que él mantiene.
 *
 * El fichero vive como estático en `public/callejero-embed/valencia_27.html`
 * (Netlify lo sirve directo, antes del catch-all `/* -> index.html`). Es
 * self-contained (Leaflet por CDN + datos embebidos + OSM en vivo).
 *
 * Trade-off asumido (ver eng-review): al embeber se pierde la integración de
 * plataforma del port nativo (leaderboard, progreso persistente, scoring
 * anti-trampa, gating por oposición, multi-ciudad). El código nativo se
 * conserva en la ruta `/app/callejero/nativo` (`CallejeroAppComponent`) para
 * retomar la re-introducción a futuro.
 */
@Component({
  selector: 'app-callejero-embed',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './callejero-embed.component.html',
  styleUrl: './callejero-embed.component.scss',
})
export class CallejeroEmbedComponent {
  private readonly sanitizer = inject(DomSanitizer);
  /** Ruta al estático servido por Netlify (fuera del router SPA). */
  readonly src: SafeResourceUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
    '/callejero-embed/valencia_27.html',
  );
}
