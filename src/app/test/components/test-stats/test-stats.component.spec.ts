import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { COMMON_TEST_PROVIDERS } from '../../../testing';


import { TestStatsComponent } from './test-stats.component';

describe('TestStatsComponent', () => {
  let component: TestStatsComponent;
  let fixture: ComponentFixture<TestStatsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TestStatsComponent],
      providers: [...COMMON_TEST_PROVIDERS],
      schemas: [NO_ERRORS_SCHEMA],
    })
    .compileComponents();

    fixture = TestBed.createComponent(TestStatsComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
