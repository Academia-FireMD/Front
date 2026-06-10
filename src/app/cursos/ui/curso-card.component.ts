import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { Curso } from '../models/curso.model';
import { ProgressRingComponent } from './progress-ring.component';

/**
 * Card de curso reutilizable (catálogo, mis cursos, "continuar"). Presentacional:
 * el caller decide qué pasa al abrir/comprar. CTA contextual:
 *  - sin acceso → "Comprar (1 clic)"
 *  - con acceso y progreso > 0 → "Continuar"
 *  - con acceso sin progreso → "Empezar"
 */
@Component({
  selector: 'app-curso-card',
  standalone: true,
  imports: [ButtonModule, DecimalPipe, ProgressRingComponent],
  templateUrl: './curso-card.component.html',
  styleUrl: './curso-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CursoCardComponent {
  curso = input.required<Curso>();
  tieneAcceso = input<boolean>(false);
  /** % de progreso (0..100) si se conoce; null = no mostrar overlay. */
  progreso = input<number | null>(null);
  comprando = input<boolean>(false);

  abrir = output<void>();
  comprar = output<void>();

  readonly cta = computed<'comprar' | 'continuar' | 'empezar'>(() => {
    if (!this.tieneAcceso()) return 'comprar';
    return (this.progreso() ?? 0) > 0 ? 'continuar' : 'empezar';
  });

  readonly mostrarProgreso = computed(
    () => this.tieneAcceso() && this.progreso() !== null,
  );

  /** Oposición visible como badge solo si es específica (no GENERAL). */
  readonly oposicionBadge = computed(() => {
    const o = this.curso().oposicion;
    return o && o !== 'GENERAL' ? o.replace(/_/g, ' ') : null;
  });

  onCta(event: Event): void {
    event.stopPropagation();
    if (this.cta() === 'comprar') this.comprar.emit();
    else this.abrir.emit();
  }
}
