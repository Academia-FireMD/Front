import { DOCUMENT } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../services/auth.service';

/**
 * Razones de acceso denegado al asistente (espejo del enum del backend
 * `AiAssistantAccessReason` en Server). Mantener los MISMOS valores string.
 */
type AiAssistantAccessReason = 'NO_SUBSCRIPTION' | 'EXPIRED' | 'TIER_TOO_LOW';

@Component({
  selector: 'app-ai-assistant-widget',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Cuando el acceso se deniega por tier insuficiente (TIER_TOO_LOW), en vez de
  // ocultar el asistente en silencio mostramos un CTA flotante de upsell (petición
  // Raúl 2026-06-14). El resto de razones (sin sub / caducada) siguen sin widget.
  template: `
    @if (showUpsell()) {
      <button
        type="button"
        class="ai-upsell-pill"
        (click)="openUpgrade()"
        aria-label="Mejora tu suscripción para acceder al asistente"
      >
        <i class="pi pi-lock"></i>
        <span>Mejora tu suscripción para acceder</span>
      </button>
    }
  `,
  styles: [
    `
      .ai-upsell-pill {
        position: fixed;
        right: 1.25rem;
        bottom: 1.25rem;
        z-index: 1000;
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.65rem 1rem;
        border: none;
        border-radius: 999px;
        background: var(--orange-500, #f97316);
        color: #fff;
        font-weight: 600;
        font-size: 0.9rem;
        cursor: pointer;
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
      }
      .ai-upsell-pill:hover {
        filter: brightness(0.95);
      }
    `,
  ],
})
export class AiAssistantWidgetComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private document = inject<Document>(DOCUMENT);
  private authService = inject(AuthService);
  private scriptElement: HTMLScriptElement | null = null;

  readonly showUpsell = signal(false);

  ngOnInit(): void {
    this.loadWidget();
  }

  private getEmbedToken(): string {
    try {
      const decodedToken = this.authService.decodeToken();
      const isAdmin = decodedToken?.rol === 'ADMIN';
      return isAdmin
        ? environment.aiAssistant.adminEmbedToken
        : environment.aiAssistant.embedToken;
    } catch {
      return environment.aiAssistant.embedToken;
    }
  }

  private async loadWidget(): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.http.get<{ token: string }>(
          `${environment.apiUrl}/ai-assistant/token`,
          { withCredentials: true },
        ),
      );
      this.injectWidgetScript(response.token);
    } catch (err: unknown) {
      const httpErr = err as HttpErrorResponse;
      const reason = httpErr?.error?.reason as
        | AiAssistantAccessReason
        | undefined;
      if (httpErr?.status === 403 && reason === 'TIER_TOO_LOW') {
        // Plan por debajo del que incluye el asistente → mostrar upsell.
        this.showUpsell.set(true);
        return;
      }
      if (httpErr?.status === 401 || httpErr?.status === 403) {
        // Sin sesión, sin suscripción o caducada → no mostrar nada.
        return;
      }
      console.error('AI Assistant widget load failed:', err);
    }
  }

  openUpgrade(): void {
    window.open(environment.wooCommerceUrl, '_blank');
  }

  private injectWidgetScript(preAuthToken: string): void {
    this.scriptElement = this.document.createElement('script');
    this.scriptElement.src = environment.aiAssistant.widgetUrl;
    this.scriptElement.setAttribute(
      'data-api-url',
      environment.aiAssistant.apiUrl,
    );
    this.scriptElement.setAttribute('data-embed-token', this.getEmbedToken());
    this.scriptElement.setAttribute('data-token', preAuthToken);
    this.scriptElement.setAttribute('data-mode', 'floating');
    this.document.body.appendChild(this.scriptElement);
  }

  ngOnDestroy(): void {
    if (this.scriptElement) {
      this.scriptElement.remove();
      this.scriptElement = null;
    }
    // Remove widget DOM elements injected by the script
    this.document.getElementById('ai-widget-btn')?.remove();
    this.document.getElementById('ai-widget-panel')?.remove();
  }
}
