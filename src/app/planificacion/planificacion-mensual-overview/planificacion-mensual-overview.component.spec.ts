import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { COMMON_TEST_PROVIDERS } from '../../testing';


import { PlanificacionMensualOverviewComponent } from './planificacion-mensual-overview.component';

describe('PlanificacionMensualOverviewComponent', () => {
  let component: PlanificacionMensualOverviewComponent;
  let fixture: ComponentFixture<PlanificacionMensualOverviewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PlanificacionMensualOverviewComponent],
      providers: [...COMMON_TEST_PROVIDERS],
      schemas: [NO_ERRORS_SCHEMA],
    })
    .compileComponents();

    fixture = TestBed.createComponent(PlanificacionMensualOverviewComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
