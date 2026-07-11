import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { Oposicion } from '../../shared/models/subscription.model';
import { colapsarOposiciones } from '../../utils/consts';
import { Curso } from '../models/curso.model';
import { ProgressRingComponent } from './progress-ring.component';

/**
 * Card de curso reutilizable (catálogo, mis cursos, "continuar"). Presentacional:
 * el caller decide qué pasa al abrir/comprar. CTA contextual:
 *  - curso gratuito sin acceso → "Acceder gratis"
 *  - de pago sin acceso → "Comprar (1 clic)"
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

  readonly esGratuito = computed(() => this.curso().esGratuito === true);

  readonly cta = computed<
    'comprar' | 'acceder-gratis' | 'continuar' | 'empezar'
  >(() => {
    if (!this.tieneAcceso()) {
      return this.esGratuito() ? 'acceder-gratis' : 'comprar';
    }
    return (this.progreso() ?? 0) > 0 ? 'continuar' : 'empezar';
  });

  readonly mostrarProgreso = computed(
    () => this.tieneAcceso() && this.progreso() !== null,
  );

  /**
   * Badges de relevancia: oposiciones específicas (no GENERAL). Vacío o solo
   * GENERAL → ningún badge (visible para todas). Usa `colapsarOposiciones`
   * (misma lógica que el picker) para que Valencia + Alicante se muestren como
   * un solo badge "Comunidad Valenciana", consistente con el resto de la app.
   */
  readonly oposicionBadges = computed<string[]>(() => {
    const validValues = Object.values(Oposicion) as string[];
    const relevantes = (this.curso().relevancia ?? []).filter(
      (o) => validValues.includes(o) && o !== Oposicion.GENERAL,
    );
    return colapsarOposiciones(relevantes).map((o) => o.label);
  });

  onCta(event: Event): void {
    event.stopPropagation();
    // "Comprar" → cobro 1-clic (lo gestiona el caller). El resto (gratis,
    // continuar, empezar) → abrir el curso.
    if (this.cta() === 'comprar') this.comprar.emit();
    else this.abrir.emit();
  }
}
