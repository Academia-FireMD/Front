import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { COMMON_TEST_PROVIDERS } from '../../../testing';


import { CompletarTestComponent } from './completar-test.component';

describe('CompletarTestComponent', () => {
  let component: CompletarTestComponent;
  let fixture: ComponentFixture<CompletarTestComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CompletarTestComponent],
      providers: [...COMMON_TEST_PROVIDERS],
      schemas: [NO_ERRORS_SCHEMA],
    })
    .compileComponents();

    fixture = TestBed.createComponent(CompletarTestComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
