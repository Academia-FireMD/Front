import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { COMMON_TEST_PROVIDERS } from '../../../testing';


import { RealizarSimulacroComponent } from './realizar-simulacro.component';

describe('RealizarSimulacroComponent', () => {
  let component: RealizarSimulacroComponent;
  let fixture: ComponentFixture<RealizarSimulacroComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [RealizarSimulacroComponent],
      providers: [...COMMON_TEST_PROVIDERS],
      schemas: [NO_ERRORS_SCHEMA],
    })
    .compileComponents();

    fixture = TestBed.createComponent(RealizarSimulacroComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
