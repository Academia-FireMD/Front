import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { COMMON_TEST_PROVIDERS } from '../../testing';


import { PlanificacionComentariosOverviewComponent } from './planificacion-comentarios-overview.component';

describe('PlanificacionComentariosOverviewComponent', () => {
  let component: PlanificacionComentariosOverviewComponent;
  let fixture: ComponentFixture<PlanificacionComentariosOverviewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PlanificacionComentariosOverviewComponent],
      providers: [...COMMON_TEST_PROVIDERS],
      schemas: [NO_ERRORS_SCHEMA],
    })
    .compileComponents();

    fixture = TestBed.createComponent(PlanificacionComentariosOverviewComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
