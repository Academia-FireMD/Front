import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  forwardRef,
  Input,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { Editor } from '@toast-ui/editor';
import { universalEditorConfig } from '../../utils/utils';

/**
 * Editor Markdown con preview en vivo al lado (Toast UI Editor), envuelto como
 * ControlValueAccessor para usarlo con `formControlName`/`ngModel`. Reutiliza la
 * MISMA config base (`universalEditorConfig`) que la definición de
 * preguntas/flashcards, así el contenido de bloques de texto se edita igual
 * que el resto del proyecto. `previewStyle` (default `vertical`, igual que
 * `universalEditorConfig`) permite que un consumidor concreto pida el modo
 * `tab` de Toast UI (pestañas Write/Preview) en vez del split lateral
 * permanente — pensado para contenedores estrechos.
 */
@Component({
  selector: 'app-markdown-editor',
  standalone: true,
  template: `<div #host class="markdown-editor-host"></div>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => MarkdownEditorComponent),
      multi: true,
    },
  ],
})
export class MarkdownEditorComponent
  implements AfterViewInit, OnDestroy, ControlValueAccessor
{
  @ViewChild('host', { static: true }) host!: ElementRef<HTMLDivElement>;
  @Input() height = '300px';
  /**
   * `vertical` (default, sin cambios) = Write/Preview partidos en dos columnas
   * permanentes, bien cuando el editor tiene ancho completo. `tab` = pestañas
   * nativas de Toast UI (Write/Preview, una vista visible a la vez) — pensado
   * para tarjetas estrechas (p.ej. varias por fila) donde el split lateral
   * queda apretado. NO cambia el default global (`universalEditorConfig`
   * sigue siendo `vertical` para el resto de editores de la app).
   */
  @Input() previewStyle: 'vertical' | 'tab' = 'vertical';

  // `Editor` (named export) es un namespace en los typings → se usa como valor
  // pero se tipa la instancia como `any` (mismo patrón que el resto del repo).
  private editor?: any;
  private pendingValue = '';
  private onChange: (v: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  ngAfterViewInit(): void {
    // Defer initialization to next tick to allow layout/CSS to stabilize
    // and avoid visual glitch where Markdown and WYSIWYG views overlap briefly.
    requestAnimationFrame(() => {
      this.editor = new Editor({
        el: this.host.nativeElement,
        ...universalEditorConfig,
        height: this.height,
        previewStyle: this.previewStyle,
        initialValue: this.pendingValue,
        events: {
          change: () => {
            const md = this.editor?.getMarkdown() ?? '';
            this.onChange(md);
          },
          blur: () => this.onTouched(),
        },
      });
    });
  }

  ngOnDestroy(): void {
    this.editor?.destroy();
  }

  // ---- ControlValueAccessor ----
  writeValue(value: string | null): void {
    const v = value ?? '';
    if (this.editor) {
      // Evita re-emitir change al setear programáticamente.
      if (this.editor.getMarkdown() !== v) this.editor.setMarkdown(v, false);
    } else {
      this.pendingValue = v;
    }
  }

  registerOnChange(fn: (v: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(): void {
    // Toast UI no expone disable simple; no-op (el form admin no lo usa).
  }
}
