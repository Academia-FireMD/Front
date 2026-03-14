import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { COMMON_TEST_PROVIDERS } from '../../../testing';


import { DashboardStatsComponent } from './dashboard-stats.component';

describe('DashboardStatsComponent', () => {
  let component: DashboardStatsComponent;
  let fixture: ComponentFixture<DashboardStatsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [DashboardStatsComponent],
      providers: [...COMMON_TEST_PROVIDERS],
      schemas: [NO_ERRORS_SCHEMA],
    })
    .compileComponents();

    fixture = TestBed.createComponent(DashboardStatsComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
