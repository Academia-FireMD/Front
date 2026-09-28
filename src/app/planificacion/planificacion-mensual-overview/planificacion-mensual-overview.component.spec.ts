import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ConfirmationService } from 'primeng/api';
import { COMMON_TEST_PROVIDERS } from '../../testing';

import { PlanificacionMensualOverviewComponent } from './planificacion-mensual-overview.component';

describe('PlanificacionMensualOverviewComponent', () => {
  let component: PlanificacionMensualOverviewComponent;
  let fixture: ComponentFixture<PlanificacionMensualOverviewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PlanificacionMensualOverviewComponent],
      providers: [...COMMON_TEST_PROVIDERS],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(PlanificacionMensualOverviewComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('descarta el autocompletado del navegador al activar la búsqueda', () => {
    const input = document.createElement('input');
    input.readOnly = true;
    input.value = 'admin@example.com';
    component.pagination.set({ ...component.pagination(), searchTerm: 'Plan QA' });

    component.activarBusqueda({ target: input } as unknown as FocusEvent);

    expect(component.searchReadOnly).toBe(false);
    expect(input.readOnly).toBe(false);
    expect(input.value).toBe('Plan QA');
  });

  it('mantiene el historial del alumno en solo lectura', () => {
    const confirmationService = TestBed.inject(ConfirmationService);
    const confirmSpy = jest.spyOn(confirmationService, 'confirm');
    component.expectedRole = 'ALUMNO';

    component.eliminar(42, new Event('click'));

    expect(confirmSpy).not.toHaveBeenCalled();
  });
});
