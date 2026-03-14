import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { COMMON_TEST_PROVIDERS } from '../../../../testing';


import { PieChartDashboardSecurityComponent } from './pie-chart-dashboard-security.component';

describe('PieChartDashboardSecurityComponent', () => {
  let component: PieChartDashboardSecurityComponent;
  let fixture: ComponentFixture<PieChartDashboardSecurityComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PieChartDashboardSecurityComponent],
      providers: [...COMMON_TEST_PROVIDERS],
      schemas: [NO_ERRORS_SCHEMA],
    })
    .compileComponents();

    fixture = TestBed.createComponent(PieChartDashboardSecurityComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
