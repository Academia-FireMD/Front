import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RealizarTestComponent } from './realizar-test.component';

describe('RealizarTestComponent', () => {
  let component: RealizarTestComponent;
  let fixture: ComponentFixture<RealizarTestComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [RealizarTestComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RealizarTestComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
