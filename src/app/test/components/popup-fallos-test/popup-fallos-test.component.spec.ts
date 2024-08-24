import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PopupFallosTestComponent } from './popup-fallos-test.component';

describe('PopupFallosTestComponent', () => {
  let component: PopupFallosTestComponent;
  let fixture: ComponentFixture<PopupFallosTestComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PopupFallosTestComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PopupFallosTestComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
