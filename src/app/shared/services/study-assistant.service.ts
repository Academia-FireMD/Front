import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class StudyAssistantService {
  private document = inject<Document>(DOCUMENT);

  /**
   * Abre el Asistente de Estudio con un mensaje pre-cargado y lo envía.
   * Prefiere la API pública del widget (window.PaidioWidget.open), robusta y
   * desacoplada del DOM interno. Si no existe (widget antiguo), cae a un
   * fallback que manipula el DOM. Devuelve false si no se pudo abrir.
   */
  openWithMessage(message: string): boolean {
    const paidio = (
      this.document.defaultView as unknown as {
        PaidioWidget?: { open?: (text: string) => unknown };
      } | null
    )?.PaidioWidget;
    if (paidio?.open) {
      paidio.open(message);
      return true;
    }

    // Fallback: el widget aún no expone la API pública.
    const panel = this.document.getElementById('ai-widget-panel');
    const input = this.document.getElementById(
      'ai-widget-input',
    ) as HTMLInputElement | null;
    const send = this.document.getElementById('ai-widget-send');
    if (!panel || !input || !send) return false;
    panel.classList.add('open');
    input.value = message;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    send.click();
    return true;
  }
}
