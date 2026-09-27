import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-excel-file-picker',
  standalone: true,
  imports: [CommonModule, ButtonModule],
  template: `
    <div class="excel-file-picker">
      <input
        #fileInput
        class="sr-only"
        type="file"
        [accept]="accept"
        [disabled]="disabled"
        [attr.aria-label]="ariaLabel"
        (change)="selectFile($event)"
      />
      <p-button
        [label]="buttonLabel"
        icon="pi pi-folder-open"
        severity="secondary"
        [disabled]="disabled"
        (onClick)="fileInput.click()"
      />
      <span class="file-name" aria-live="polite">{{
        file?.name || 'Ningún archivo seleccionado'
      }}</span>
    </div>
  `,
  styles: [
    `
      .excel-file-picker {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 0.75rem;
        min-width: 0;
      }
      .file-name {
        min-width: 0;
        overflow-wrap: anywhere;
        color: var(--text-color-secondary);
      }
      @media (max-width: 640px) {
        .excel-file-picker {
          align-items: stretch;
          flex-direction: column;
        }
        :host ::ng-deep .p-button {
          width: 100%;
          min-height: 44px;
        }
      }
    `,
  ],
})
export class ExcelFilePickerComponent {
  @Input() file: File | null = null;
  @Input() accept = '.xlsx,.xls';
  @Input() ariaLabel = 'Seleccionar archivo Excel';
  @Input() buttonLabel = 'Seleccionar Excel';
  @Input() disabled = false;
  @Output() fileSelected = new EventEmitter<File | null>();

  selectFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.fileSelected.emit(input.files?.[0] ?? null);
    input.value = '';
  }
}
