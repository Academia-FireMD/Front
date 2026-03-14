import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { COMMON_TEST_PROVIDERS } from '../../../testing';


import { DashboardStatsFlashcardsComponent } from './dashboard-stats-flashcards.component';

describe('DashboardStatsFlashcardsComponent', () => {
  let component: DashboardStatsFlashcardsComponent;
  let fixture: ComponentFixture<DashboardStatsFlashcardsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [DashboardStatsFlashcardsComponent],
      providers: [...COMMON_TEST_PROVIDERS],
      schemas: [NO_ERRORS_SCHEMA],
    })
    .compileComponents();

    fixture = TestBed.createComponent(DashboardStatsFlashcardsComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
