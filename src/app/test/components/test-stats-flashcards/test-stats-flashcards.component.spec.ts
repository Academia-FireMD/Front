import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TestStatsFlashcardsComponent } from './test-stats-flashcards.component';

describe('TestStatsFlashcardsComponent', () => {
  let component: TestStatsFlashcardsComponent;
  let fixture: ComponentFixture<TestStatsFlashcardsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TestStatsFlashcardsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TestStatsFlashcardsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
