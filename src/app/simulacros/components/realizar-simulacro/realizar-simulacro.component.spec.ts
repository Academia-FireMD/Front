import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RealizarSimulacroComponent } from './realizar-simulacro.component';

describe('RealizarSimulacroComponent', () => {
  let component: RealizarSimulacroComponent;
  let fixture: ComponentFixture<RealizarSimulacroComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [RealizarSimulacroComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RealizarSimulacroComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
