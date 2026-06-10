import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';

/**
 * Indicador de progreso del módulo Cursos. Dos variantes:
 *  - `bar` (default): barra horizontal con etiqueta "{value}% {label}".
 *  - `ring`: anillo SVG con el % en el centro (para overlays sobre miniaturas).
 * Presentacional puro: recibe `value` (0..100), no calcula nada.
 */
@Component({
  selector: 'app-progress-ring',
  standalone: true,
  templateUrl: './progress-ring.component.html',
  styleUrl: './progress-ring.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProgressRingComponent {
  value = input.required<number>();
  label = input<string>('completado');
  variant = input<'bar' | 'ring'>('bar');
  /** Tamaño del anillo en px (solo variant=ring). */
  size = input<number>(44);

  readonly clamped = computed(() => Math.max(0, Math.min(100, this.value())));
  // Circunferencia para el dash del anillo (r=16 → 2πr ≈ 100.5).
  readonly radius = 16;
  readonly circ = 2 * Math.PI * this.radius;
  readonly dash = computed(() => (this.clamped() / 100) * this.circ);
}
