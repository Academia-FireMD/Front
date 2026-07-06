import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';
import { SharedModule } from '../../shared.module';
import { Dificultad } from '../../models/pregunta.model';

export interface ExportDialogEvent {
  filtros: { temas?: number[]; dificultad?: Dificultad };
  formato: 'excel' | 'word';
}

@Component({
  selector: 'app-export-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, SharedModule],
  templateUrl: './export-dialog.component.html',
})
export class ExportDialogComponent {
  readonly visible = input<boolean>(false);
  readonly titulo = input<string>('Exportar');
  readonly loading = input<boolean>(false);

  readonly cerrar = output<void>();
  readonly exportar = output<ExportDialogEvent>();

  /** FormControls for child components that require them */
  readonly temasControl = new FormControl<number[]>([]);
  readonly dificultadControl = new FormControl<Dificultad | null>(null);
  readonly selectedFormato = signal<'excel' | 'word'>('excel');

  // El export de fallos produce siempre Excel importable; el "informe" Word se
  // eliminó (D5 del diseño 2026-07-06), por lo que solo se ofrece Excel.
  readonly formatoOptions: Array<{ label: string; value: 'excel' | 'word' }> = [
    { label: 'Excel (.xlsx)', value: 'excel' },
  ];

  onCerrar(): void {
    this.temasControl.setValue([]);
    this.dificultadControl.setValue(null);
    this.selectedFormato.set('excel');
    this.cerrar.emit();
  }

  onExportar(): void {
    const temas = this.temasControl.value ?? [];
    const dificultad = this.dificultadControl.value;
    const filtros: { temas?: number[]; dificultad?: Dificultad } = {};
    if (temas.length > 0) filtros.temas = temas;
    if (dificultad !== null && dificultad !== undefined) {
      filtros.dificultad = dificultad;
    }
    this.exportar.emit({ filtros, formato: this.selectedFormato() });
  }
}
