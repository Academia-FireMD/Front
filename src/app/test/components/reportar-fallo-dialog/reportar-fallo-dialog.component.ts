import { Component, EventEmitter, Input, Output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, Validators } from '@angular/forms';
@Component({
  selector: 'app-reportar-fallo-dialog',
  templateUrl: './reportar-fallo-dialog.component.html',
  styleUrl: './reportar-fallo-dialog.component.scss',
})
export class ReportarFalloDialogComponent {
  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  public descripcionFallo = new FormControl('', [
    Validators.required,
    Validators.minLength(10),
  ]);
  @Output() sendReport = new EventEmitter<string>();
  @Output() onHide = new EventEmitter<void>();
  constructor() {
    this.sendReport
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.descripcionFallo.reset());
  }
}
