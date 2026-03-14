import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { COMMON_TEST_PROVIDERS } from '../../../testing';


import { CompletarTestSimulacroComponent } from './completar-test-simulacro.component';

describe('CompletarTestSimulacroComponent', () => {
  let component: CompletarTestSimulacroComponent;
  let fixture: ComponentFixture<CompletarTestSimulacroComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CompletarTestSimulacroComponent],
      providers: [...COMMON_TEST_PROVIDERS],
      schemas: [NO_ERRORS_SCHEMA],
    })
    .compileComponents();

    fixture = TestBed.createComponent(CompletarTestSimulacroComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
