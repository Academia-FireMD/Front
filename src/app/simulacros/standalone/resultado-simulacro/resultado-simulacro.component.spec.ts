import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ResultadoSimulacroComponent } from './resultado-simulacro.component';

describe('ResultadoSimulacroComponent', () => {
  let component: ResultadoSimulacroComponent;
  let fixture: ComponentFixture<ResultadoSimulacroComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ResultadoSimulacroComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ResultadoSimulacroComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
