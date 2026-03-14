import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { COMMON_TEST_PROVIDERS } from '../../../testing';


import { TestStatsGridComponent } from './test-stats-grid.component';

describe('TestStatsGridComponent', () => {
  let component: TestStatsGridComponent;
  let fixture: ComponentFixture<TestStatsGridComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TestStatsGridComponent],
      providers: [...COMMON_TEST_PROVIDERS],
      schemas: [NO_ERRORS_SCHEMA],
    })
    .compileComponents();

    fixture = TestBed.createComponent(TestStatsGridComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
