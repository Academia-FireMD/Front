import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FullStatsComponent } from './full-stats.component';

describe('FullStatsComponent', () => {
  let component: FullStatsComponent;
  let fixture: ComponentFixture<FullStatsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [FullStatsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FullStatsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
