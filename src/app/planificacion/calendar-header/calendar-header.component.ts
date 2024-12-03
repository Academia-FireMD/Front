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

  @Output() viewChange = new EventEmitter<CalendarView>();

  @Output() viewDateChange = new EventEmitter<Date>();

  CalendarView = CalendarView;

  changeViewDate(direction: 'previous' | 'next'): void {
    const increment = direction === 'previous' ? -1 : 1;

    if (this.view === 'month') {
      this.viewDate.setMonth(this.viewDate.getMonth() + increment);
    } else if (this.view === 'week') {
      this.viewDate.setDate(this.viewDate.getDate() + increment * 7);
    } else if (this.view === 'day') {
      this.viewDate.setDate(this.viewDate.getDate() + increment);
    }

    this.viewDate = new Date(this.viewDate);
    this.viewDateChange.emit(this.viewDate);
  }

  setToday(): void {
    this.viewDate = new Date();
    this.viewDateChange.emit(this.viewDate);
  }
}
