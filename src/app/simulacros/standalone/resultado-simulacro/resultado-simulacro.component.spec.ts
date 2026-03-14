import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { COMMON_TEST_PROVIDERS } from '../../../testing';


import { ResultadoSimulacroComponent } from './resultado-simulacro.component';

describe('ResultadoSimulacroComponent', () => {
  let component: ResultadoSimulacroComponent;
  let fixture: ComponentFixture<ResultadoSimulacroComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [...COMMON_TEST_PROVIDERS],
      schemas: [NO_ERRORS_SCHEMA],
    })
    .overrideComponent(ResultadoSimulacroComponent, {
      set: { imports: [], template: '' },
    })
    .compileComponents();

    fixture = TestBed.createComponent(ResultadoSimulacroComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
