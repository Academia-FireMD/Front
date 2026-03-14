import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { COMMON_TEST_PROVIDERS } from '../../../testing';


import { FullStatsComponent } from './full-stats.component';

describe('FullStatsComponent', () => {
  let component: FullStatsComponent;
  let fixture: ComponentFixture<FullStatsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [FullStatsComponent],
      providers: [...COMMON_TEST_PROVIDERS],
      schemas: [NO_ERRORS_SCHEMA],
    })
    .compileComponents();

    fixture = TestBed.createComponent(FullStatsComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
