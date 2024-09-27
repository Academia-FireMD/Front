import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PieChartDashboardSecurityComponent } from './pie-chart-dashboard-security.component';

describe('PieChartDashboardSecurityComponent', () => {
  let component: PieChartDashboardSecurityComponent;
  let fixture: ComponentFixture<PieChartDashboardSecurityComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PieChartDashboardSecurityComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PieChartDashboardSecurityComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
