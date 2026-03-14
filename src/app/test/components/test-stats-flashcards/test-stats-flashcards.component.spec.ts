import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { COMMON_TEST_PROVIDERS } from '../../../testing';


import { TestStatsFlashcardsComponent } from './test-stats-flashcards.component';

describe('TestStatsFlashcardsComponent', () => {
  let component: TestStatsFlashcardsComponent;
  let fixture: ComponentFixture<TestStatsFlashcardsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TestStatsFlashcardsComponent],
      providers: [...COMMON_TEST_PROVIDERS],
      schemas: [NO_ERRORS_SCHEMA],
    })
    .compileComponents();

    fixture = TestBed.createComponent(TestStatsFlashcardsComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
