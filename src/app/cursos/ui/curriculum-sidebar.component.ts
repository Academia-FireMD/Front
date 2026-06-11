import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import {
  Leccion,
  ProgresoLeccion,
  Seccion,
  TipoLeccion,
} from '../models/curso.model';
import { estaCompletada } from './progreso.util';
import { ProgressRingComponent } from './progress-ring.component';

/**
 * Currículum del curso (secciones → lecciones) con estado de progreso.
 * Lo usan el aula (interactivo, navega entre lecciones) y la página de detalle
 * (modo lectura). Presentacional: recibe datos, emite la lección seleccionada.
 */
@Component({
  selector: 'app-curriculum-sidebar',
  standalone: true,
  imports: [ProgressRingComponent],
  templateUrl: './curriculum-sidebar.component.html',
  styleUrl: './curriculum-sidebar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CurriculumSidebarComponent {
  secciones = input.required<Seccion[]>();
  progreso = input<ProgresoLeccion[]>([]);
  leccionActivaId = input<number | null>(null);
  /** true = clicks navegan; false = solo lectura (detalle sin acceso). */
  interactivo = input<boolean>(true);
  /** % del curso para la barra superior; null = no mostrar barra. */
  porcentaje = input<number | null>(null);

  seleccionar = output<Leccion>();

  /** Secciones colapsadas (por id). Por defecto todas abiertas. */
  private readonly colapsadas = signal<Set<number>>(new Set());

  readonly tipoIconos: Record<TipoLeccion, string> = {
    VIDEO: 'pi pi-play-circle',
    TEXTO: 'pi pi-file',
    TEST: 'pi pi-question-circle',
    FLASHCARDS: 'pi pi-clone',
  };

  readonly seccionesOrdenadas = computed(() =>
    [...this.secciones()].sort((a, b) => a.orden - b.orden),
  );

  completada(leccionId: number): boolean {
    return estaCompletada(leccionId, this.progreso());
  }

  estaColapsada(seccionId: number): boolean {
    return this.colapsadas().has(seccionId);
  }

  toggle(seccionId: number): void {
    this.colapsadas.update((set) => {
      const next = new Set(set);
      next.has(seccionId) ? next.delete(seccionId) : next.add(seccionId);
      return next;
    });
  }

  onLeccion(leccion: Leccion): void {
    if (this.interactivo()) this.seleccionar.emit(leccion);
  }

  leccionesOrdenadas(seccion: Seccion): Leccion[] {
    return [...seccion.lecciones].sort((a, b) => a.orden - b.orden);
  }
}
