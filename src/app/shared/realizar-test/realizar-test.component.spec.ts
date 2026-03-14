import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { COMMON_TEST_PROVIDERS } from '../../testing';


import { RealizarTestComponent } from './realizar-test.component';

describe('RealizarTestComponent', () => {
  let component: RealizarTestComponent;
  let fixture: ComponentFixture<RealizarTestComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [RealizarTestComponent],
      providers: [...COMMON_TEST_PROVIDERS],
      schemas: [NO_ERRORS_SCHEMA],
    })
    .compileComponents();

    fixture = TestBed.createComponent(RealizarTestComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
