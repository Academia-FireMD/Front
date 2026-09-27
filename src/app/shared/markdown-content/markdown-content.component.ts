import { Component, Input } from '@angular/core';
import { MarkdownModule } from 'ngx-markdown';

/** Visor de contenido Markdown; no interpreta HTML sin pasar por ngx-markdown. */
@Component({
  selector: 'app-markdown-content',
  standalone: true,
  imports: [MarkdownModule],
  template: `
    @if (content?.trim()) {
      <markdown [data]="content ?? ''"></markdown>
    } @else {
      <span class="empty">{{ emptyText }}</span>
    }
  `,
  styles: [
    `
      :host {
        display: block;
        min-width: 0;
        overflow-wrap: anywhere;
      }
      :host ::ng-deep markdown > :first-child {
        margin-top: 0;
      }
      :host ::ng-deep markdown > :last-child {
        margin-bottom: 0;
      }
      .empty {
        color: var(--text-color-secondary);
      }
    `,
  ],
})
export class MarkdownContentComponent {
  @Input() content: string | null | undefined = null;
  @Input() emptyText = 'Sin comentarios';
}
