import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  ViewChild,
  inject,
} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { take } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../environments/environment';

const AUTH_REQUEST_TYPE = 'tf-callejero-auth-request';
const AUTH_RESPONSE_TYPE = 'tf-callejero-auth';
const MAX_REQUEST_ID_LENGTH = 128;

interface AuthRequestMessage {
  type: typeof AUTH_REQUEST_TYPE;
  requestId: string;
  forceRefresh: boolean;
}

function esMensajeAuthRequest(value: unknown): value is AuthRequestMessage {
  if (!value || typeof value !== 'object') return false;
  const data = value as Record<string, unknown>;
  const keys = Object.keys(data).sort();
  return (
    keys.length === 3 &&
    keys.join(',') === 'forceRefresh,requestId,type' &&
    data['type'] === AUTH_REQUEST_TYPE &&
    typeof data['requestId'] === 'string' &&
    data['requestId'].length > 0 &&
    data['requestId'].length <= MAX_REQUEST_ID_LENGTH &&
    typeof data['forceRefresh'] === 'boolean'
  );
}

/**
 * Callejero (embed v27) — incrusta el HTML autónomo de Raúl tal cual en un
 * iframe, para paridad visual 1:1 exacta con lo que él mantiene.
 *
 * El fichero vive como estático en `public/callejero-embed/valencia_27.html`
 * (Netlify lo sirve directo, antes del catch-all `/* -> index.html`). Es
 * self-contained (Leaflet por CDN + datos embebidos); las calles, búsquedas y
 * recorridos se resuelven exclusivamente mediante la API propia.
 *
 * Auth: el HTML estático no puede leer sessionStorage del SPA. El componente
 * padre escucha `tf-callejero-auth-request` por postMessage same-origin y
 * responde con el JWT + URL base de la API para que el iframe use únicamente
 * nuestros endpoints propios.
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
  private readonly auth = inject(AuthService);
  /** Referencia al iframe para validar `event.source` en postMessage. */
  @ViewChild('callejeroFrame', { static: true })
  iframeRef!: ElementRef<HTMLIFrameElement>;

  /** Ruta al estático servido por Netlify (fuera del router SPA). */
  readonly src: SafeResourceUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
    '/callejero-embed/valencia_27.html',
  );

  /** Responde únicamente a una petición ya autenticada del iframe. */
  private responderAuth(request: AuthRequestMessage): void {
    const iframe = this.iframeRef?.nativeElement;
    if (!iframe || !iframe.contentWindow) return;

    const enviar = (token: string | null): void => {
      iframe.contentWindow?.postMessage(
        {
          type: AUTH_RESPONSE_TYPE,
          requestId: request.requestId,
          forceRefresh: request.forceRefresh,
          token,
          apiBase: environment.apiUrl,
        },
        window.location.origin,
      );
    };

    if (!request.forceRefresh) {
      enviar(this.auth.getToken());
      return;
    }

    this.auth
      .refreshToken$()
      .pipe(take(1))
      .subscribe({
        next: (tokens: { access_token?: unknown } | null | undefined) => {
          const token =
            typeof tokens?.access_token === 'string' &&
            tokens.access_token.length > 0
              ? tokens.access_token
              : null;
          enviar(token);
        },
        error: () => enviar(null),
      });
  }

  @HostListener('window:message', ['$event'])
  onMessage(event: MessageEvent): void {
    const iframe = this.iframeRef?.nativeElement;
    if (!iframe) return;
    if (event.origin !== window.location.origin) return;
    if (event.source !== iframe.contentWindow) return;
    if (!esMensajeAuthRequest(event.data)) return;
    this.responderAuth(event.data);
  }
}
