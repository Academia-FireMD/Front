import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CalendarModule } from 'primeng/calendar';
import { FormsModule } from '@angular/forms';

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
  diasEstados = input<DiaEstado[]>([]);
  fechaSeleccionada = output<Date | null>();
  fechasSeleccionadas = output<Date[]>();
  modoMultiSeleccion = input<boolean>(false);
  fechasExternas = input<Date[]>([]); // Para sincronizar desde el componente padre

  fecha = signal<Date | null>(new Date());
  fechasMultiples = signal<Date[]>([]);

  constructor() {
    // Sincronizar fechas externas con el signal interno
    effect(() => {
      if (this.modoMultiSeleccion()) {
        const fechasExt = this.fechasExternas();
        if (fechasExt.length === 0 && this.fechasMultiples().length > 0) {
          // Si las fechas externas están vacías, limpiar las internas
          this.fechasMultiples.set([]);
        }
      }
    });
  }

  diasConEstado = computed(() => {
    const estados = this.diasEstados();
    const mapa = new Map<string, DiaEstado['estado']>();
    estados.forEach(dia => {
      const key = this.getDateKey(dia.fecha);
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
    // El objeto date del template tiene propiedades day, month, year
    const fecha = new Date(date.year, date.month, date.day);
    const key = this.getDateKey(fecha);
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

  private getDateKey(date: Date): string {
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  }
}

