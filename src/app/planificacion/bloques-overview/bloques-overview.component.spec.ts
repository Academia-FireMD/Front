import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BloquesOverviewComponent } from './bloques-overview.component';

describe('BloquesOverviewComponent', () => {
  let component: BloquesOverviewComponent;
  let fixture: ComponentFixture<BloquesOverviewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [BloquesOverviewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BloquesOverviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
