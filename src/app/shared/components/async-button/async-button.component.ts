import { CommonModule } from '@angular/common';
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';

@Component({
  selector: 'app-async-button',
  standalone: true,
  imports: [CommonModule, ButtonModule, TooltipModule],
  templateUrl: './async-button.component.html',
  styleUrls: ['./async-button.component.scss'],
})
export class AsyncButtonComponent {
  @Input() label: string = '';
  @Input() icon: string = '';
  @Input() disabled: boolean = false;
  @Input() styleClass: string = 'p-button-primary';
  @Input() link: boolean = false;
  @Input() tooltip: string = '';
  @Input() tooltipPosition: string = 'top';
  @Input()
  action: () => Promise<any> = () => Promise.resolve();

  @Output() actionSuccess = new EventEmitter<any>();
  @Output() actionError = new EventEmitter<any>();

  loading = false;

  async onClick() {
    if (this.disabled || this.loading) {
      return;
    }

    this.loading = true;
    try {
      const result = await this.action();
      this.actionSuccess.emit(result);
    } catch (error) {
      this.actionError.emit(error);
    } finally {
      this.loading = false;
    }
  }
} 