import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TemaOverviewComponent } from './tema-overview.component';

describe('TemaOverviewComponent', () => {
  let component: TemaOverviewComponent;
  let fixture: ComponentFixture<TemaOverviewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TemaOverviewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TemaOverviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
