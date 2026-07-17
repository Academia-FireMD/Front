import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA, Pipe, PipeTransform } from '@angular/core';
import { of, throwError } from 'rxjs';
import { COMMON_TEST_PROVIDERS } from '../../testing';
import { PlanificacionFisicaService } from '../../planificacion-fisica/services/planificacion-fisica.service';

import { PlanificacionMensualEditComponent } from './planificacion-mensual-edit.component';

@Pipe({ name: 'calendarDate' })
class MockCalendarDatePipe implements PipeTransform {
  transform(value: any): string {
    return '';
  }
}

describe('PlanificacionMensualEditComponent', () => {
  let component: PlanificacionMensualEditComponent;
  let fixture: ComponentFixture<PlanificacionMensualEditComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PlanificacionMensualEditComponent, MockCalendarDatePipe],
      providers: [...COMMON_TEST_PROVIDERS],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(PlanificacionMensualEditComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('bridge temario↔física', () => {
    it('resumenFisica arranca vacío — sin indicación hasta que cargue', () => {
      expect(component.resumenFisica()).toEqual([]);
    });

    it('onViewDateChange actualiza viewDate y recarga el bridge física para ALUMNO', () => {
      const svc = TestBed.inject(PlanificacionFisicaService);
      const spy = jest
        .spyOn(svc, 'resumenDias')
        .mockReturnValue(of([{ fecha: '2026-07-15', disciplinas: [] }]));
      component.expectedRole = 'ALUMNO';

      const nuevaFecha = new Date(2026, 7, 1);
      component.onViewDateChange(nuevaFecha);

      expect(component.viewDate).toBe(nuevaFecha);
      expect(spy).toHaveBeenCalled();
      expect(component.resumenFisica()).toEqual([
        { fecha: '2026-07-15', disciplinas: [] },
      ]);
    });

    it('onViewDateChange NO llama al bridge física para ADMIN (no aplica a esa vista)', () => {
      const svc = TestBed.inject(PlanificacionFisicaService);
      const spy = jest.spyOn(svc, 'resumenDias');
      component.expectedRole = 'ADMIN';

      component.onViewDateChange(new Date(2026, 7, 1));

      expect(spy).not.toHaveBeenCalled();
    });

    it('REGLA #1 no romper el temario: si el endpoint del bridge física falla (500/red), resumenFisica queda en [] sin lanzar excepción', () => {
      const svc = TestBed.inject(PlanificacionFisicaService);
      jest
        .spyOn(svc, 'resumenDias')
        .mockReturnValue(throwError(() => new Error('network down')));
      component.expectedRole = 'ALUMNO';

      expect(() => component.onViewDateChange(new Date())).not.toThrow();
      expect(component.resumenFisica()).toEqual([]);
    });

    it('un alumno BASIC/sin bloque activo recibe 200 [] (nunca 403) y no rompe nada', () => {
      const svc = TestBed.inject(PlanificacionFisicaService);
      jest.spyOn(svc, 'resumenDias').mockReturnValue(of([]));
      component.expectedRole = 'ALUMNO';

      component.onViewDateChange(new Date());

      expect(component.resumenFisica()).toEqual([]);
    });
  });
});
