import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProgressBarModule } from 'primeng/progressbar';
import {
  ResumenGlobalCiudad,
  ResumenProgresoZona,
} from '../../models/callejero.model';

/**
 * Panel de progreso. Presentacional: recibe el resumen global de la ciudad
 * ("dominas X/Y calles") y el desglose por barrio (% dominado), y opcionalmente
 * la zona activa para resaltarla. Se refresca tras cada acierto/fallo.
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
  /** Resumen global de la ciudad (agregado). Null hasta que carga el backend. */
  readonly ciudad = input<ResumenGlobalCiudad | null>(null);
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
}
