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

/**
 * Widget del Asistente de Estudio (Paidio embebido).
 *
 * Cuando el acceso se deniega por TIER insuficiente, en vez de ocultar el
 * asistente o mostrar una píldora muda, presentamos un **paywall**: una burbuja
 * con candado que, al abrirse, muestra el asistente como vista previa BORROSA +
 * candado + el requisito (tier) + CTA para mejorar la suscripción. Patrón
 * portado también al SaaS Paidio (universal-assistant).
 */
@Component({
  selector: 'app-ai-assistant-widget',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (paywall()) {
      <!-- Burbuja bloqueada (ocupa el sitio del botón del asistente) -->
      <button
        type="button"
        class="ai-pw-bubble"
        (click)="abrirPaywall()"
        aria-label="Asistente de Estudio bloqueado"
      >
        <i class="pi pi-comments"></i>
        <span class="ai-pw-bubble__lock"><i class="pi pi-lock"></i></span>
      </button>

      @if (paywallOpen()) {
        <div class="ai-pw" (click)="cerrarPaywall()">
          <div class="ai-pw__panel" (click)="$event.stopPropagation()">
            <button
              class="ai-pw__x"
              (click)="cerrarPaywall()"
              aria-label="Cerrar"
            >
              ✕
            </button>

            <!-- Vista previa borrosa del asistente (mock) -->
            <div class="ai-pw__preview" aria-hidden="true">
              <div class="ai-pw__msg ai-pw__msg--bot">
                ¡Hola! Soy tu Asistente de Estudio. ¿Te ayudo con nemotécnicas?
              </div>
              <div class="ai-pw__msg ai-pw__msg--user">
                Dame un truco para memorizar el temario…
              </div>
              <div class="ai-pw__msg ai-pw__msg--bot">
                Claro, usa el palacio de memoria: asocia cada concepto a…
              </div>
            </div>

            <!-- Candado + paywall -->
            <div class="ai-pw__gate">
              <div class="ai-pw__lock"><i class="pi pi-lock"></i></div>
              <h3>Asistente de Estudio</h3>
              <p>
                Disponible con la suscripción
                <strong>{{ requisitoTexto() }}</strong> o superior. Tu plan
                actual no lo incluye.
              </p>
              <button class="ai-pw__cta" (click)="mejorar()">
                Mejorar suscripción
              </button>
            </div>
          </div>
        </div>
      }
    }
  `,
  styles: [
    `
      .ai-pw-bubble {
        position: fixed;
        right: 1.25rem;
        bottom: 1.25rem;
        z-index: 1000;
        width: 56px;
        height: 56px;
        border: none;
        border-radius: 50%;
        background: #1e293b;
        color: #fff;
        font-size: 1.4rem;
        cursor: pointer;
        box-shadow: 0 6px 18px rgba(0, 0, 0, 0.28);
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .ai-pw-bubble__lock {
        position: absolute;
        right: -2px;
        bottom: -2px;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: #f97316;
        color: #fff;
        font-size: 0.7rem;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 2px solid #fff;
      }
      .ai-pw {
        position: fixed;
        inset: 0;
        z-index: 2000;
        background: rgba(15, 23, 42, 0.55);
        display: flex;
        align-items: flex-end;
        justify-content: flex-end;
        padding: 1.25rem;
      }
      .ai-pw__panel {
        position: relative;
        width: min(360px, 100%);
        background: #fff;
        border-radius: 16px;
        overflow: hidden;
        box-shadow: 0 18px 50px rgba(0, 0, 0, 0.35);
      }
      .ai-pw__x {
        position: absolute;
        top: 8px;
        right: 10px;
        z-index: 3;
        border: 0;
        background: rgba(255, 255, 255, 0.85);
        border-radius: 50%;
        width: 26px;
        height: 26px;
        cursor: pointer;
        font-size: 0.85rem;
      }
      .ai-pw__preview {
        padding: 16px 14px 60px;
        background: #f1f5f9;
        filter: blur(4px);
        user-select: none;
        pointer-events: none;
      }
      .ai-pw__msg {
        max-width: 80%;
        margin: 0 0 10px;
        padding: 8px 11px;
        border-radius: 12px;
        font-size: 0.85rem;
        line-height: 1.3;
      }
      .ai-pw__msg--bot {
        background: #fff;
        color: #1e293b;
        border-bottom-left-radius: 3px;
      }
      .ai-pw__msg--user {
        background: #2563eb;
        color: #fff;
        margin-left: auto;
        border-bottom-right-radius: 3px;
      }
      .ai-pw__gate {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        background: linear-gradient(
          180deg,
          rgba(255, 255, 255, 0) 0%,
          #fff 38%
        );
        padding: 40px 20px 22px;
        text-align: center;
      }
      .ai-pw__lock {
        width: 52px;
        height: 52px;
        margin: 0 auto 6px;
        border-radius: 50%;
        background: #f97316;
        color: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.4rem;
        box-shadow: 0 4px 14px rgba(249, 115, 22, 0.4);
      }
      .ai-pw__gate h3 {
        margin: 4px 0 6px;
        font-size: 1.1rem;
        color: #0f172a;
      }
      .ai-pw__gate p {
        margin: 0 0 14px;
        font-size: 0.88rem;
        color: #475569;
      }
      .ai-pw__cta {
        border: 0;
        border-radius: 999px;
        background: #f97316;
        color: #fff;
        font-weight: 700;
        font-size: 0.95rem;
        padding: 0.7rem 1.3rem;
        cursor: pointer;
      }
      .ai-pw__cta:hover {
        filter: brightness(0.96);
      }
    `,
  ],
})
export class AiAssistantWidgetComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private document = inject<Document>(DOCUMENT);
  private authService = inject(AuthService);
  private scriptElement: HTMLScriptElement | null = null;

  /** Paywall activo (tier insuficiente). */
  readonly paywall = signal(false);
  /** Overlay del paywall abierto. */
  readonly paywallOpen = signal(false);
  /** Tier requerido (del 403 del backend), p.ej. 'ADVANCED'. */
  readonly requiredTier = signal<string>('ADVANCED');

  /** Texto legible del requisito para el copy del paywall. */
  requisitoTexto(): string {
    const t = this.requiredTier();
    const map: Record<string, string> = {
      ADVANCED: 'Avanzada',
      PREMIUM: 'Premium',
      NORMAL: 'Avanzada',
      PRO: 'Premium',
    };
    return map[t] ?? t;
  }

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
        // Plan por debajo del que incluye el asistente → paywall.
        const tier = httpErr?.error?.requiredTier as string | undefined;
        if (tier) this.requiredTier.set(tier);
        this.paywall.set(true);
        return;
      }
      if (httpErr?.status === 401 || httpErr?.status === 403) {
        // Sin sesión, sin suscripción o caducada → no mostrar nada.
        return;
      }
      console.error('AI Assistant widget load failed:', err);
    }
  }

  abrirPaywall(): void {
    this.paywallOpen.set(true);
  }
  cerrarPaywall(): void {
    this.paywallOpen.set(false);
  }
  mejorar(): void {
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
