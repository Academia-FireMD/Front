import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { COMMON_TEST_PROVIDERS } from '../../../testing';


import { RealizarFlashCardTestComponent } from './realizar-flash-card-test.component';

describe('RealizarFlashCardTestComponent', () => {
  let component: RealizarFlashCardTestComponent;
  let fixture: ComponentFixture<RealizarFlashCardTestComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [RealizarFlashCardTestComponent],
      providers: [...COMMON_TEST_PROVIDERS],
      schemas: [NO_ERRORS_SCHEMA],
    })
    .compileComponents();

    fixture = TestBed.createComponent(RealizarFlashCardTestComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
