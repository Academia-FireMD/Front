import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { PlanificacionBloqueadaComponent } from './planificacion-bloqueada.component';

describe('PlanificacionBloqueadaComponent', () => {
  let component: PlanificacionBloqueadaComponent;
  let fixture: ComponentFixture<PlanificacionBloqueadaComponent>;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlanificacionBloqueadaComponent],
      providers: [{ provide: Router, useValue: { navigate: jest.fn() } }],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(PlanificacionBloqueadaComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('el CTA de mejora de tarifa navega a /app/profile', () => {
    component.irAMejorarTarifa();
    expect(router.navigate).toHaveBeenCalledWith(['/app/profile']);
  });
});
