import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlanificacionComentariosOverviewComponent } from './planificacion-comentarios-overview.component';

describe('PlanificacionComentariosOverviewComponent', () => {
  let component: PlanificacionComentariosOverviewComponent;
  let fixture: ComponentFixture<PlanificacionComentariosOverviewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PlanificacionComentariosOverviewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PlanificacionComentariosOverviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
