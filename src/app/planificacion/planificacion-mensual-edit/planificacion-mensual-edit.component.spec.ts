import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA, Pipe, PipeTransform } from '@angular/core';
import { COMMON_TEST_PROVIDERS } from '../../testing';

import { PlanificacionMensualEditComponent } from './planificacion-mensual-edit.component';

@Pipe({ name: 'calendarDate' })
class MockCalendarDatePipe implements PipeTransform {
  transform(value: any): string { return ''; }
}

describe('PlanificacionMensualEditComponent', () => {
  let component: PlanificacionMensualEditComponent;
  let fixture: ComponentFixture<PlanificacionMensualEditComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PlanificacionMensualEditComponent, MockCalendarDatePipe],
      providers: [...COMMON_TEST_PROVIDERS],
      schemas: [NO_ERRORS_SCHEMA],
    })
    .compileComponents();

    fixture = TestBed.createComponent(PlanificacionMensualEditComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
