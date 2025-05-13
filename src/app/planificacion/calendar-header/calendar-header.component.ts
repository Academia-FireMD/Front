import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CalendarView } from 'angular-calendar';

@Component({
  selector: 'app-calendar-header',
  templateUrl: './calendar-header.component.html',
  styleUrl: './calendar-header.component.scss',
})
export class CalendarHeaderComponent {
  @Input() view!: CalendarView;
  @Input() viewDate!: Date;
  @Input() locale: string = 'es';
  @Input() role: 'ADMIN' | 'ALUMNO' = 'ALUMNO';
  @Input() startDate: Date | null = null;
  @Input() endDate: Date | null = null;

  @Output() viewChange = new EventEmitter<CalendarView>();
  @Output() viewDateChange = new EventEmitter<Date>();

  CalendarView = CalendarView;

  isPreviousDisabled(): boolean {
    if (this.role === 'ADMIN') return false;
    if (!this.startDate) return false;

    const nextDate = this.getNextDate('previous');
    return nextDate < this.startDate;
  }

  isNextDisabled(): boolean {
    if (this.role === 'ADMIN') return false;
    if (!this.endDate) return false;

    const nextDate = this.getNextDate('next');
    return nextDate > this.endDate;
  }



  private getNextDate(direction: 'previous' | 'next'): Date {
    const increment = direction === 'previous' ? -1 : 1;
    const nextDate = new Date(this.viewDate);

    if (this.view === CalendarView.Month) {
      nextDate.setMonth(nextDate.getMonth() + increment);
    } else if (this.view === CalendarView.Week) {
      nextDate.setDate(nextDate.getDate() + increment * 7);
    } else if (this.view === CalendarView.Day) {
      nextDate.setDate(nextDate.getDate() + increment);
    }

    return nextDate;
  }

  changeViewDate(direction: 'previous' | 'next'): void {
    if ((direction === 'previous' && this.isPreviousDisabled()) ||
        (direction === 'next' && this.isNextDisabled())) {
      return;
    }

    const increment = direction === 'previous' ? -1 : 1;

    if (this.view === CalendarView.Month) {
      this.viewDate.setMonth(this.viewDate.getMonth() + increment);
    } else if (this.view === CalendarView.Week) {
      this.viewDate.setDate(this.viewDate.getDate() + increment * 7);
    } else if (this.view === CalendarView.Day) {
      this.viewDate.setDate(this.viewDate.getDate() + increment);
    }

    this.viewDate = new Date(this.viewDate);
    this.viewDateChange.emit(this.viewDate);
  }

  setToday(): void {
    let targetDate = new Date();

    // Si es admin o no hay restricciones de fechas, simplemente ir a hoy
    if (this.role === 'ADMIN' || (!this.startDate && !this.endDate)) {
      this.viewDate = targetDate;
      this.viewDateChange.emit(this.viewDate);
      return;
    }

    // Para alumnos con restricciones de fechas
    if (this.startDate && this.endDate) {
      // Si hoy está dentro del rango permitido, usar hoy
      if (targetDate >= this.startDate && targetDate <= this.endDate) {
        this.viewDate = targetDate;
      }
      // Si hoy está antes del rango permitido, ir a la fecha de inicio
      else if (targetDate < this.startDate) {
        this.viewDate = new Date(this.startDate);
      }
      // Si hoy está después del rango permitido, ir a la fecha final
      else if (targetDate > this.endDate) {
        this.viewDate = new Date(this.endDate);
      }

      this.viewDateChange.emit(this.viewDate);
    }
  }
}
