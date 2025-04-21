import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CompletarTestSimulacroComponent } from './completar-test-simulacro.component';

describe('CompletarTestSimulacroComponent', () => {
  let component: CompletarTestSimulacroComponent;
  let fixture: ComponentFixture<CompletarTestSimulacroComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CompletarTestSimulacroComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CompletarTestSimulacroComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
