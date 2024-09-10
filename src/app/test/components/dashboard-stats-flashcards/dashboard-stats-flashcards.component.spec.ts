import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DashboardStatsFlashcardsComponent } from './dashboard-stats-flashcards.component';

describe('DashboardStatsFlashcardsComponent', () => {
  let component: DashboardStatsFlashcardsComponent;
  let fixture: ComponentFixture<DashboardStatsFlashcardsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [DashboardStatsFlashcardsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DashboardStatsFlashcardsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
