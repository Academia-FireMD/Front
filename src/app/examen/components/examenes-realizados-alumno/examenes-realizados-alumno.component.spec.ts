import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExamenesRealizadosAlumnoComponent } from './examenes-realizados-alumno.component';

describe('ExamenesRealizadosAlumnoComponent', () => {
  let component: ExamenesRealizadosAlumnoComponent;
  let fixture: ComponentFixture<ExamenesRealizadosAlumnoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ExamenesRealizadosAlumnoComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ExamenesRealizadosAlumnoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
