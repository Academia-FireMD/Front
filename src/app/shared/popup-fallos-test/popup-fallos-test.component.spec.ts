import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { COMMON_TEST_PROVIDERS } from '../../testing';


import { PopupFallosTestComponent } from './popup-fallos-test.component';

describe('PopupFallosTestComponent', () => {
  let component: PopupFallosTestComponent;
  let fixture: ComponentFixture<PopupFallosTestComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PopupFallosTestComponent],
      providers: [...COMMON_TEST_PROVIDERS],
      schemas: [NO_ERRORS_SCHEMA],
    })
    .compileComponents();

    fixture = TestBed.createComponent(PopupFallosTestComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
