import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { COMMON_TEST_PROVIDERS } from '../../testing';


import { BloquesEditComponent } from './bloques-edit.component';

describe('BloquesEditComponent', () => {
  let component: BloquesEditComponent;
  let fixture: ComponentFixture<BloquesEditComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [BloquesEditComponent],
      providers: [...COMMON_TEST_PROVIDERS],
      schemas: [NO_ERRORS_SCHEMA],
    })
    .compileComponents();

    fixture = TestBed.createComponent(BloquesEditComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
