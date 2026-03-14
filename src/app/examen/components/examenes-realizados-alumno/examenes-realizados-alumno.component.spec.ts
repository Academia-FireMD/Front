import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { COMMON_TEST_PROVIDERS } from '../../../testing';


import { ExamenesRealizadosAlumnoComponent } from './examenes-realizados-alumno.component';

describe('ExamenesRealizadosAlumnoComponent', () => {
  let component: ExamenesRealizadosAlumnoComponent;
  let fixture: ComponentFixture<ExamenesRealizadosAlumnoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ExamenesRealizadosAlumnoComponent],
      providers: [...COMMON_TEST_PROVIDERS],
      schemas: [NO_ERRORS_SCHEMA],
    })
    .compileComponents();

    fixture = TestBed.createComponent(ExamenesRealizadosAlumnoComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
