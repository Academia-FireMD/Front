import { TestBed } from '@angular/core/testing';
import { CalendarEvent } from 'angular-calendar';

import { EventsService } from './events.service';

describe('EventsService', () => {
  let service: EventsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(EventsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('calcula el progreso sin clonar ni modificar los eventos', () => {
    const date = new Date(2026, 9, 2);
    const event = Object.freeze({
      start: new Date(2026, 9, 2, 9),
      meta: Object.freeze({ subBloque: Object.freeze({ realizado: true }) }),
    }) as CalendarEvent;
    const events = Object.freeze([event]) as unknown as CalendarEvent[];

    expect(service.getDayProgress(events, date)).toEqual({
      total: 1,
      completed: 1,
      percentage: 100,
      color: '#28a745',
    });
    expect(service.getEventsForDay(events, date)[0]).toBe(event);
  });

  it('filtra solo eventos visibles, incluyendo los que cruzan el inicio', () => {
    const start = new Date(2026, 9, 5);
    const end = new Date(2026, 9, 12);
    const before = {
      start: new Date(2026, 9, 4, 9),
      end: start,
    } as CalendarEvent;
    const crossing = {
      start: new Date(2026, 9, 4, 23),
      end: new Date(2026, 9, 5, 1),
    } as CalendarEvent;
    const inside = { start: new Date(2026, 9, 8, 9) } as CalendarEvent;
    const after = { start: end } as CalendarEvent;

    expect(
      service.getEventsForRange([before, crossing, inside, after], start, end),
    ).toEqual([crossing, inside]);
  });
});
