import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CalendarModule } from 'primeng/calendar';
import { FormsModule } from '@angular/forms';
import { HorariosUtilsService } from '../../servicios/horarios-utils.service';

export interface DiaEstado {
  fecha: Date;
  estado: 'disponible' | 'parcial' | 'completo' | 'sin-datos';
}

@Component({
  selector: 'app-calendario-horarios',
  templateUrl: './calendario-horarios.component.html',
  styleUrl: './calendario-horarios.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, CalendarModule, FormsModule]
})
export class CalendarioHorariosComponent {
  utils = inject(HorariosUtilsService);
  
  diasEstados = input<DiaEstado[]>([]);
  fechaSeleccionada = output<Date | null>();
  fechasSeleccionadas = output<Date[]>();
  modoMultiSeleccion = input<boolean>(false);
  fechasExternas = input<Date[]>([]);
  fechaExterna = input<Date | null>(null);

  fecha = signal<Date | null>(null);
  fechasMultiples = signal<Date[]>([]);

  valorCalendario = computed(() => {
    if (this.modoMultiSeleccion()) {
      // En modo múltiple, siempre retornar un array (nunca null o undefined)
      const fechas = this.fechasMultiples();
      return Array.isArray(fechas) ? fechas : [];
    } else {
      // En modo single, retornar Date o null (nunca array)
      const fecha = this.fecha();
      return fecha instanceof Date ? fecha : null;
    }
  });

  constructor() {
    effect(() => {
      if (this.modoMultiSeleccion()) {
        const fechasExt = this.fechasExternas();
        if (Array.isArray(fechasExt)) {
          this.fechasMultiples.set(fechasExt);
        } else {
          this.fechasMultiples.set([]);
        }
      } else {
        const fechaExt = this.fechaExterna();
        this.fecha.set(fechaExt);
      }
    }, { allowSignalWrites: true });

    effect(() => {
      const modoMulti = this.modoMultiSeleccion();
      if (modoMulti) {
        this.fecha.set(null);
      } else {
        this.fechasMultiples.set([]);
      }
    }, { allowSignalWrites: true });
  }

  diasConEstado = computed(() => {
    const estados = this.diasEstados();
    const mapa = new Map<string, DiaEstado['estado']>();
    estados.forEach(dia => {
      const key = this.utils.getDateKey(dia.fecha);
      mapa.set(key, dia.estado);
    });
    return mapa;
  });

  onDateSelect(event: any) {
    if (this.modoMultiSeleccion()) {
      // En modo múltiple, event es un array de fechas
      const fechas = Array.isArray(event) ? event : [];
      this.fechasMultiples.set(fechas);
      this.fechasSeleccionadas.emit(fechas);
    } else {
      // En modo single, event es una fecha o null
      this.fecha.set(event);
      this.fechaSeleccionada.emit(event);
    }
  }

  getDateClass = (date: any): string => {
    const fecha = new Date(date.year, date.month, date.day);
    const key = this.utils.getDateKey(fecha);
    const estado = this.diasConEstado().get(key);
    
    switch (estado) {
      case 'disponible':
        return 'dia-disponible';
      case 'parcial':
        return 'dia-parcial';
      case 'completo':
        return 'dia-completo';
      default:
        return '';
    }
  }
}

