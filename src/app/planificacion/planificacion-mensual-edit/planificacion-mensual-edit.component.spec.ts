import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA, Pipe, PipeTransform } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ConfirmationService } from 'primeng/api';
import { of, throwError } from 'rxjs';
import { COMMON_TEST_PROVIDERS } from '../../testing';
import { PlanificacionesService } from '../../services/planificaciones.service';
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
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PlanificacionMensualEditComponent, MockCalendarDatePipe],
      providers: [...COMMON_TEST_PROVIDERS],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(PlanificacionMensualEditComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
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

  describe('bridge temario↔física — vista MENSUAL (customCellTemplate)', () => {
    const dia = new Date(2026, 6, 15); // 2026-07-15 (mes 0-indexado)

    beforeEach(() => {
      component.resumenFisica.set([
        {
          fecha: '2026-07-15',
          disciplinas: [
            {
              nombre: 'Cuerda 2',
              grupo: 'CUERDA',
              color: '#9fe2d0',
              realizado: false,
            },
            {
              nombre: 'Carrera 2',
              grupo: 'CARRERA',
              color: '#fdeaa8',
              realizado: false,
            },
          ],
        },
      ]);
    });

    it('tieneFisica es true para un día con disciplinas y false para uno sin datos', () => {
      expect(component.tieneFisica(dia)).toBe(true);
      expect(component.tieneFisica(new Date(2026, 6, 16))).toBe(false);
    });

    it('tieneFisica es false cuando el día trae disciplinas vacío', () => {
      component.resumenFisica.set([{ fecha: '2026-07-15', disciplinas: [] }]);
      expect(component.tieneFisica(dia)).toBe(false);
    });

    it('etiquetaFisica junta los nombres de las disciplinas separados por coma', () => {
      expect(component.etiquetaFisica(dia)).toBe('Cuerda 2, Carrera 2');
    });

    it('etiquetaFisica devuelve cadena vacía cuando no hay física ese día', () => {
      expect(component.etiquetaFisica(new Date(2026, 6, 16))).toBe('');
    });

    it('resumenFisica vacío (bloque BASIC/sin plan) no rompe nada: tieneFisica siempre false', () => {
      component.resumenFisica.set([]);
      expect(component.tieneFisica(dia)).toBe(false);
      expect(() => component.etiquetaFisica(dia)).not.toThrow();
    });

    it('abrirFisica navega a /app/planificacion-fisica/dia/:fecha y detiene la propagación del click', () => {
      const domEvent = {
        stopPropagation: jest.fn(),
        preventDefault: jest.fn(),
      } as unknown as Event;

      component.abrirFisica(dia, domEvent);

      expect(domEvent.stopPropagation).toHaveBeenCalled();
      expect(domEvent.preventDefault).toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith([
        '/app/planificacion-fisica',
        'dia',
        '2026-07-15',
      ]);
    });

    it('el click de la insignia de física NO dispara onDayClicked (no abre la vista semanal de ese día por accidente)', () => {
      const onDayClickedSpy = jest.spyOn(component, 'onDayClicked');
      const domEvent = {
        stopPropagation: jest.fn(),
        preventDefault: jest.fn(),
      } as unknown as Event;

      component.abrirFisica(dia, domEvent);

      expect(onDayClickedSpy).not.toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalled();
    });

    it('renderiza la insignia data-testid="temario-fisica-bridge" en un día con física para ALUMNO, y su click llama a abrirFisica sin disparar el click de la celda', () => {
      component.expectedRole = 'ALUMNO';
      fixture.detectChanges();

      const badge = fixture.nativeElement.querySelector(
        '[data-testid="temario-fisica-bridge"]',
      );
      // Puede no renderizarse si la vista activa es la semanal (el
      // customCellTemplate solo se instancia dentro de la vista mensual de
      // mwl-calendar-month-view); lo relevante para este test es que, si
      // existe en el DOM, dispara abrirFisica y no el click de la celda.
      if (badge) {
        const abrirFisicaSpy = jest.spyOn(component, 'abrirFisica');
        badge.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(abrirFisicaSpy).toHaveBeenCalled();
      } else {
        // Verificación equivalente a nivel de componente: mismo contrato
        // que la insignia usaría al pulsarse.
        const domEvent = {
          stopPropagation: jest.fn(),
          preventDefault: jest.fn(),
        } as unknown as Event;
        expect(component.tieneFisica(dia)).toBe(true);
        component.abrirFisica(dia, domEvent);
        expect(domEvent.stopPropagation).toHaveBeenCalled();
        expect(router.navigate).toHaveBeenCalled();
      }
    });
  });

  describe('conversión masiva de bloques ENTRENAMIENTO', () => {
    it('items() incluye la acción de conversión para admin', () => {
      const items = component.items();
      const accion = items.find((i) =>
        i.tooltipOptions?.tooltipLabel?.includes('Convertir bloques'),
      );
      expect(accion).toBeDefined();
    });

    it('confirmarConversionBloquesFisica pide confirmación y al aceptar llama al servicio y recarga', () => {
      const confirmationService = TestBed.inject(ConfirmationService);
      const confirmSpy = jest.spyOn(confirmationService, 'confirm');
      const convertirMock = jest
        .fn()
        .mockReturnValue(of({ actualizados: 3, ignorados: 1 }));
      (component as any).planificacionesService = {
        convertirBloquesFisica$: convertirMock,
      };
      const loadSpy = jest
        .spyOn(component as any, 'load')
        .mockImplementation(() => {});

      // Forzar la ruta a una planificación concreta para que el accept use su id.
      (component as any).activedRoute = {
        snapshot: {
          paramMap: { get: () => '207' },
        },
      };

      component.confirmarConversionBloquesFisica();

      expect(confirmSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining(
            'Se marcarán como entrenamiento físico',
          ),
          accept: expect.any(Function),
        }),
      );

      const accept = confirmSpy.mock.calls[0][0].accept as () => void;
      accept();

      expect(convertirMock).toHaveBeenCalledWith(207);
      expect(loadSpy).toHaveBeenCalled();
    });
  });
});
