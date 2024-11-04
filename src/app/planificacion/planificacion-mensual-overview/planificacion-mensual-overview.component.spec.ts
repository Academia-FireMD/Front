import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlanificacionMensualOverviewComponent } from './planificacion-mensual-overview.component';

describe('PlanificacionMensualOverviewComponent', () => {
  let component: PlanificacionMensualOverviewComponent;
  let fixture: ComponentFixture<PlanificacionMensualOverviewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PlanificacionMensualOverviewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PlanificacionMensualOverviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
