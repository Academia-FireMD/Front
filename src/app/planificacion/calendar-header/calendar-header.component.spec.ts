import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { COMMON_TEST_PROVIDERS } from '../../testing';
import { CalendarView } from 'angular-calendar';

import { CalendarHeaderComponent } from './calendar-header.component';

describe('CalendarHeaderComponent', () => {
  let component: CalendarHeaderComponent;
  let fixture: ComponentFixture<CalendarHeaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CalendarHeaderComponent],
      providers: [...COMMON_TEST_PROVIDERS],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(CalendarHeaderComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('permite la semana siguiente aunque Hoy ocurra segundos después de calcular el límite', () => {
    component.role = 'ALUMNO';
    component.view = CalendarView.Week;
    component.viewDate = new Date(2026, 8, 27, 12, 0, 2);
    component.endDate = new Date(2026, 9, 4, 12, 0, 1);

    expect(component.isNextDisabled()).toBe(false);
    component.changeViewDate('next');
    expect(component.viewDate.getDate()).toBe(4);
    expect(component.isNextDisabled()).toBe(true);
  });

  it('Hoy no se limita a una hora anterior del mismo día', () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 8, 28, 12, 0, 2));
    try {
      component.role = 'ALUMNO';
      component.viewDate = new Date(2026, 8, 21);
      component.startDate = new Date(2026, 8, 14);
      component.endDate = new Date(2026, 8, 28, 12, 0, 1);

      component.setToday();

      expect(component.viewDate).toEqual(new Date(2026, 8, 28, 12, 0, 2));
    } finally {
      jest.useRealTimers();
    }
  });
});
