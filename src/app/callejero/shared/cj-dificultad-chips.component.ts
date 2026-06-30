import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DificultadCallejero } from '../models/callejero.model';

@Component({
  selector: 'app-cj-dificultad-chips',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cj-dificultad-chips.component.html',
  styleUrls: ['./cj-dificultad-chips.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CjDificultadChipsComponent {
  readonly dificultad = input.required<DificultadCallejero>();
  readonly descripciones =
    input.required<Record<DificultadCallejero, string>>();
  readonly prefix = input<string>('cj-dif-');

  readonly dificultadChange = output<DificultadCallejero>();

  readonly niveles: { valor: DificultadCallejero; label: string }[] = [
    { valor: 'FACIL', label: 'Fácil' },
    { valor: 'MEDIO', label: 'Medio' },
    { valor: 'DIFICIL', label: 'Difícil' },
  ];

  readonly descripcionActiva = computed(
    () => this.descripciones()[this.dificultad()],
  );
}
