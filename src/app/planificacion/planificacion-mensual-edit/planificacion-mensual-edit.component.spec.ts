import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlanificacionMensualEditComponent } from './planificacion-mensual-edit.component';

describe('PlanificacionMensualEditComponent', () => {
  let component: PlanificacionMensualEditComponent;
  let fixture: ComponentFixture<PlanificacionMensualEditComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PlanificacionMensualEditComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PlanificacionMensualEditComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
