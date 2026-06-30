import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-cj-zona-chips',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cj-zona-chips.component.html',
  styleUrls: ['./cj-zona-chips.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CjZonaChipsComponent {
  readonly parques = input.required<string[]>();
  readonly seleccion = input<Set<string>>(new Set());

  readonly seleccionChange = output<Set<string>>();

  readonly desc = computed(() => {
    const all = this.parques();
    const sel = this.seleccion();
    if (sel.size >= all.length)
      return `Todas las zonas marcadas (los ${all.length} parques).`;
    if (sel.size === 0) return 'Ninguna zona marcada — marca al menos una.';
    return `Solo: ${[...sel].join(' + ')}.`;
  });

  toggle(parque: string): void {
    const next = new Set(this.seleccion());
    if (next.has(parque)) next.delete(parque);
    else next.add(parque);
    this.seleccionChange.emit(next);
  }
}
