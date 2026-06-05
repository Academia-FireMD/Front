import { DOCUMENT } from '@angular/common';
import { Directive, ElementRef, inject, input, OnDestroy } from '@angular/core';
import { StudyAssistantService } from '../services/study-assistant.service';

/**
 * Al seleccionar texto dentro del host (cuando appSeleccionCrearRegla=true),
 * muestra un botón flotante "Crear regla para memorizar" que abre el
 * Asistente de Estudio con el texto seleccionado. Reutilizable en cualquier
 * contenedor de texto HTML seleccionable (test ver-respuestas, lecciones, etc.).
 */
@Directive({
  selector: '[appSeleccionCrearRegla]',
  standalone: true,
})
export class SeleccionCrearReglaDirective implements OnDestroy {
  // Solo activa cuando es true (p.ej. modoVerRespuestas).
  readonly seleccionActiva = input<boolean>(false, {
    alias: 'appSeleccionCrearRegla',
  });

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly document = inject<Document>(DOCUMENT);
  private readonly studyAssistant = inject(StudyAssistantService);
  private boton: HTMLButtonElement | null = null;

  private readonly onSelectionEnd = () => this.handleSelection();

  constructor() {
    this.host.nativeElement.addEventListener('mouseup', this.onSelectionEnd);
    this.host.nativeElement.addEventListener('touchend', this.onSelectionEnd);
  }

  private handleSelection(): void {
    if (!this.seleccionActiva()) {
      this.removeBoton();
      return;
    }
    const sel = this.document.getSelection();
    const texto = sel?.toString().trim() ?? '';
    if (!sel || sel.rangeCount === 0 || texto.length < 8) {
      this.removeBoton();
      return;
    }
    const range = sel.getRangeAt(0);
    if (!this.host.nativeElement.contains(range.commonAncestorContainer)) {
      this.removeBoton();
      return;
    }
    const rect = range.getBoundingClientRect();
    this.showBoton(rect, texto);
  }

  private showBoton(rect: DOMRect, texto: string): void {
    this.removeBoton();
    const btn = this.document.createElement('button');
    btn.type = 'button';
    btn.textContent = '🧠 Crear regla para memorizar';
    btn.className = 'seleccion-crear-regla-btn';
    Object.assign(btn.style, {
      position: 'fixed',
      top: `${Math.max(rect.top - 44, 8)}px`,
      left: `${Math.max(rect.left, 8)}px`,
      zIndex: '10000',
      background: '#b91c1c',
      color: '#fff',
      border: 'none',
      borderRadius: '10px',
      padding: '8px 12px',
      fontSize: '13px',
      fontWeight: '600',
      cursor: 'pointer',
      boxShadow: '0 6px 18px rgba(0,0,0,.25)',
    });
    // mousedown (no click) para no perder la selección antes de leer el texto.
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const mensaje = `Quiero memorizar esto para el examen: "${texto}". ¿Me montas una nemotécnica para recordarlo?`;
      this.studyAssistant.openWithMessage(mensaje);
      this.document.getSelection()?.removeAllRanges();
      this.removeBoton();
    });
    this.document.body.appendChild(btn);
    this.boton = btn;
  }

  private removeBoton(): void {
    this.boton?.remove();
    this.boton = null;
  }

  ngOnDestroy(): void {
    this.host.nativeElement.removeEventListener('mouseup', this.onSelectionEnd);
    this.host.nativeElement.removeEventListener(
      'touchend',
      this.onSelectionEnd,
    );
    this.removeBoton();
  }
}
