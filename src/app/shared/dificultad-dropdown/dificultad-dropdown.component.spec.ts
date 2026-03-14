import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { COMMON_TEST_PROVIDERS } from '../../testing';


import { DificultadDropdownComponent } from './dificultad-dropdown.component';

describe('DificultadDropdownComponent', () => {
  let component: DificultadDropdownComponent;
  let fixture: ComponentFixture<DificultadDropdownComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [DificultadDropdownComponent],
      providers: [...COMMON_TEST_PROVIDERS],
      schemas: [NO_ERRORS_SCHEMA],
    })
    .compileComponents();

    fixture = TestBed.createComponent(DificultadDropdownComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
