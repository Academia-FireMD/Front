import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProgressBarModule } from 'primeng/progressbar';
import { ResumenProgresoZona } from '../../models/callejero.model';

/**
 * Panel de progreso por zona (% de calles dominadas). Presentacional: recibe el
 * resumen del backend y, opcionalmente, la zona activa para resaltarla. Se
 * refresca tras cada acierto/fallo de los modos con scoring.
 */
@Component({
  selector: 'app-progreso-panel',
  standalone: true,
  imports: [CommonModule, ProgressBarModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './progreso-panel.component.html',
  styleUrl: './progreso-panel.component.scss',
})
export class ProgresoPanelComponent {
  /** Filas de progreso por zona (de `GET /ciudades/:id/progreso`). */
  readonly zonas = input<ResumenProgresoZona[] | null | undefined>([]);
  /** Id de la zona seleccionada, para resaltarla en la lista. */
  readonly zonaActivaId = input<number | null>(null);

  /**
   * Vista segura: el padre puede pasar `undefined` antes de que cargue el
   * resumen del backend, y un `input` con default no protege contra un
   * `undefined` explícito. Normalizamos a `[]` para no romper el render.
   */
  readonly zonasSafe = computed<ResumenProgresoZona[]>(() => this.zonas() ?? []);

  porcentaje(z: ResumenProgresoZona): number {
    if (z.totalCalles <= 0) return 0;
    return Math.round((z.dominadas / z.totalCalles) * 100);
  }
}
