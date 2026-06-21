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
 * MISMA config (`universalEditorConfig`, `previewStyle: 'vertical'`) que la
 * definición de preguntas/flashcards, así el contenido de bloques de texto se
 * edita igual que el resto del proyecto.
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

  // `Editor` (named export) es un namespace en los typings → se usa como valor
  // pero se tipa la instancia como `any` (mismo patrón que el resto del repo).
  private editor?: any;
  private pendingValue = '';
  private onChange: (v: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  ngAfterViewInit(): void {
    this.editor = new Editor({
      el: this.host.nativeElement,
      ...universalEditorConfig,
      height: this.height,
      initialValue: this.pendingValue,
      events: {
        change: () => {
          const md = this.editor?.getMarkdown() ?? '';
          this.onChange(md);
        },
        blur: () => this.onTouched(),
      },
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
