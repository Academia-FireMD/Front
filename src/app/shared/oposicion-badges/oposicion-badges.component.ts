import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { TooltipModule } from 'primeng/tooltip';
import { colapsarOposiciones } from '../../utils/consts';
import { Oposicion } from '../models/subscription.model';

/**
 * Badges de relevancia (icono/imagen + tooltip) para una lista de oposiciones,
 * con el MISMO colapso a "Comunidad Valenciana" que usa el picker
 * (`colapsarOposiciones`, fuente única de la regla de agrupación) y el MISMO
 * markup/estilos que sus badges resumen — solo de lectura, sin estado de
 * selección, pensado para reusar en tablas/previews (planificación física,
 * cursos, etc.) donde antes se pintaba texto plano vía `labelOposicion()`.
 */
@Component({
  selector: 'app-oposicion-badges',
  standalone: true,
  imports: [TooltipModule],
  templateUrl: './oposicion-badges.component.html',
  styleUrl: './oposicion-badges.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OposicionBadgesComponent {
  @Input() oposiciones: Oposicion[] = [];

  get displayItems() {
    return colapsarOposiciones(this.oposiciones);
  }
}
