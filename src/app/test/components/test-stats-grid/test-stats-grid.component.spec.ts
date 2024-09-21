import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TestStatsGridComponent } from './test-stats-grid.component';

describe('TestStatsGridComponent', () => {
  let component: TestStatsGridComponent;
  let fixture: ComponentFixture<TestStatsGridComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TestStatsGridComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TestStatsGridComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
