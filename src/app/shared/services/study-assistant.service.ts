import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class StudyAssistantService {
  private document = inject<Document>(DOCUMENT);

  /**
   * Abre el widget del Asistente de Estudio con un mensaje pre-cargado y lo envía.
   * Devuelve false si el widget aún no está montado en el DOM.
   * NOTA (piloto): depende de los IDs internos del widget; sustituir por la
   * API pública window.PaidioWidget.open(msg) cuando exista.
   */
  openWithMessage(message: string): boolean {
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
