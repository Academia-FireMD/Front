import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  Output,
  ViewChild,
} from '@angular/core';
import { Editor } from '@toast-ui/editor';
import { MarkdownModule } from 'ngx-markdown';
import { universalEditorConfig } from '../../utils/utils';

@Component({
  selector: 'app-sub-bloque-markdown-field',
  standalone: true,
  imports: [CommonModule, MarkdownModule],
  template: `
    @if (readOnly) {
      <div class="markdown-preview"><markdown [data]="value"></markdown></div>
    } @else {
      <div #editorHost class="markdown-editor"></div>
    }
  `,
  styles: [
    `
      :host {
        display: block;
        min-width: 0;
      }
      .markdown-preview,
      .markdown-editor {
        max-width: 100%;
        overflow-wrap: anywhere;
      }
      :host ::ng-deep .toastui-editor-defaultUI {
        max-width: 100%;
      }
    `,
  ],
})
export class SubBloqueMarkdownFieldComponent implements OnDestroy {
  private editor: {
    getMarkdown(): string;
    setMarkdown(value: string): void;
    destroy(): void;
  } | null = null;
  private host: ElementRef<HTMLElement> | null = null;
  private labelObserver: MutationObserver | null = null;
  private syncing = false;
  private currentValue = '';

  @Input() set value(value: string | null | undefined) {
    this.currentValue = value ?? '';
    if (this.editor && this.editor.getMarkdown() !== this.currentValue) {
      this.syncing = true;
      this.editor.setMarkdown(this.currentValue);
      this.syncing = false;
    }
  }
  get value(): string {
    return this.currentValue;
  }
  @Input() readOnly = false;
  @Input() ariaLabel = '';
  @Output() valueChange = new EventEmitter<string>();

  @ViewChild('editorHost') set editorHost(
    host: ElementRef<HTMLElement> | undefined,
  ) {
    if (this.host === host) return;
    this.destroyEditor();
    this.host = host ?? null;
    if (host) {
      const mobile = window.matchMedia?.('(max-width: 640px)').matches ?? false;
      this.editor = new Editor({
        el: host.nativeElement,
        ...universalEditorConfig,
        height: mobile ? '220px' : universalEditorConfig.height,
        previewStyle: mobile ? 'tab' : 'vertical',
        initialValue: this.currentValue,
        events: {
          change: () => {
            if (!this.editor || this.syncing) return;
            const markdown = this.editor.getMarkdown();
            if (markdown !== this.currentValue) {
              this.currentValue = markdown;
              this.valueChange.emit(markdown);
            }
          },
        },
      });
      if (this.ariaLabel) {
        this.labelObserver = new MutationObserver(() => this.etiquetarEditor());
        this.labelObserver.observe(host.nativeElement, {
          childList: true,
          subtree: true,
        });
        this.etiquetarEditor();
      }
    }
  }

  private etiquetarEditor(): void {
    this.host?.nativeElement
      .querySelectorAll('[contenteditable="true"]')
      .forEach((element) => element.setAttribute('aria-label', this.ariaLabel));
  }

  private destroyEditor(): void {
    this.labelObserver?.disconnect();
    this.labelObserver = null;
    this.editor?.destroy();
    this.editor = null;
  }

  ngOnDestroy(): void {
    this.destroyEditor();
  }
}
