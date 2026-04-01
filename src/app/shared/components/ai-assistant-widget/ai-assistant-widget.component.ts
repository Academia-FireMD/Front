import { DOCUMENT } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-ai-assistant-widget',
  standalone: true,
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiAssistantWidgetComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private document = inject<Document>(DOCUMENT);
  private authService = inject(AuthService);
  private scriptElement: HTMLScriptElement | null = null;

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
          { withCredentials: true }
        )
      );
      this.injectWidgetScript(response.token);
    } catch (err: unknown) {
      const httpErr = err as HttpErrorResponse;
      if (httpErr?.status === 401 || httpErr?.status === 403) {
        // No subscription or not authenticated - don't show widget
        return;
      }
      console.error('AI Assistant widget load failed:', err);
    }
  }

  private injectWidgetScript(preAuthToken: string): void {
    this.scriptElement = this.document.createElement('script');
    this.scriptElement.src = environment.aiAssistant.widgetUrl;
    this.scriptElement.setAttribute(
      'data-api-url',
      environment.aiAssistant.apiUrl
    );
    this.scriptElement.setAttribute(
      'data-embed-token',
      this.getEmbedToken()
    );
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
