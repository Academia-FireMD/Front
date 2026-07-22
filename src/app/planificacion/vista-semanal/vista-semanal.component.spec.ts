import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { Router } from '@angular/router';
import { COMMON_TEST_PROVIDERS } from '../../testing';

import { VistaSemanalComponent } from './vista-semanal.component';

describe('VistaSemanalComponent', () => {
  let component: VistaSemanalComponent;
  let fixture: ComponentFixture<VistaSemanalComponent>;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [VistaSemanalComponent],
      providers: [...COMMON_TEST_PROVIDERS],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(VistaSemanalComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('bridge temario↔física', () => {
    const dia = new Date(2026, 6, 15); // 2026-07-15 (mes 0-indexado)

    beforeEach(() => {
      component.resumenFisica = [
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
      ];
    });

    it('tieneFisica es true para un día con disciplinas y false para uno sin datos', () => {
      expect(component.tieneFisica(dia)).toBe(true);
      expect(component.tieneFisica(new Date(2026, 6, 16))).toBe(false);
    });

    it('tieneFisica es false cuando el día trae disciplinas vacío (no debería pintar nada)', () => {
      component.resumenFisica = [{ fecha: '2026-07-15', disciplinas: [] }];
      expect(component.tieneFisica(dia)).toBe(false);
    });

    it('etiquetaFisica junta los nombres de las disciplinas separados por coma', () => {
      expect(component.etiquetaFisica(dia)).toBe('Cuerda 2, Carrera 2');
    });

    it('etiquetaFisica devuelve cadena vacía cuando no hay física ese día', () => {
      expect(component.etiquetaFisica(new Date(2026, 6, 16))).toBe('');
    });

    it('resumenFisica vacío (bloque BASIC/sin plan) no rompe nada: tieneFisica siempre false', () => {
      component.resumenFisica = [];
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

    it('el click de un evento de física NO cae en onEventClicked (no abre el diálogo de sub-bloque del temario)', () => {
      // El badge de física es un elemento aparte del calendario de eventos,
      // nunca un CalendarEvent — así que no puede colarse en onEventClicked,
      // que asume `event.meta.subBloque` (temario) o `event.meta.esPersonalizado`.
      const openDialogSpy = jest.spyOn(component, 'onEventClicked');
      const domEvent = {
        stopPropagation: jest.fn(),
        preventDefault: jest.fn(),
      } as unknown as Event;

      component.abrirFisica(dia, domEvent);

      expect(openDialogSpy).not.toHaveBeenCalled();
      expect(component.isDialogVisible).toBe(false);
      expect(router.navigate).toHaveBeenCalled();
    });

    it('disciplinasFisica devuelve las disciplinas del día con su color, para pintar el chip coloreado', () => {
      expect(component.disciplinasFisica(dia)).toEqual([
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
      ]);
    });

    it('disciplinasFisica devuelve [] cuando el día no tiene física (el chip no se pinta)', () => {
      expect(component.disciplinasFisica(new Date(2026, 6, 16))).toEqual([]);
    });
  });

  describe('sub-bloque vinculado a física (rediseño bridge 2026-07-22)', () => {
    const dia = new Date(2026, 6, 15); // 2026-07-15

    const eventoTemario = (
      fecha: Date,
      { vinculado = false, realizado = false } = {},
    ): any => ({
      title: vinculado ? 'ENTRENAMIENTO' : 'Tema 5',
      start: fecha,
      end: new Date(fecha.getTime() + 60 * 60000),
      meta: {
        esPersonalizado: false,
        subBloque: {
          id: vinculado ? 900 : 901,
          esEntrenamientoFisico: vinculado,
          realizado,
        },
      },
    });

    beforeEach(() => {
      component.resumenFisica = [
        {
          fecha: '2026-07-15',
          disciplinas: [
            {
              nombre: 'Cuerda 2',
              grupo: 'CUERDA',
              color: '#9fe2d0',
              realizado: true,
            },
            {
              nombre: 'Carrera 2',
              grupo: 'CARRERA',
              color: '#fdeaa8',
              realizado: false,
            },
          ],
        },
      ];
    });

    it('esEventoFisicaVinculado distingue el sub-bloque vinculado del normal', () => {
      expect(
        component.esEventoFisicaVinculado(
          eventoTemario(dia, { vinculado: true }),
        ),
      ).toBe(true);
      expect(component.esEventoFisicaVinculado(eventoTemario(dia))).toBe(false);
      expect(component.esEventoFisicaVinculado(null as any)).toBe(false);
    });

    it('diaTieneBloqueFisicaVinculado es true solo si hay un evento vinculado ese día', () => {
      component.events = [
        eventoTemario(dia, { vinculado: true }),
        eventoTemario(dia),
      ];
      expect(component.diaTieneBloqueFisicaVinculado(dia)).toBe(true);
      expect(
        component.diaTieneBloqueFisicaVinculado(new Date(2026, 6, 16)),
      ).toBe(false);

      component.events = [eventoTemario(dia)];
      expect(component.diaTieneBloqueFisicaVinculado(dia)).toBe(false);
    });

    it('progresoFisicaDia cuenta las disciplinas hechas del resumen; fisicaVinculadaRealizada exige TODAS', () => {
      expect(component.progresoFisicaDia(dia)).toEqual({ hechas: 1, total: 2 });
      expect(component.fisicaVinculadaRealizada(dia)).toBe(false);

      component.resumenFisica[0].disciplinas[1].realizado = true;
      expect(component.fisicaVinculadaRealizada(dia)).toBe(true);

      // Día sin física: nunca "hecho" (fallback a comportamiento normal).
      expect(component.fisicaVinculadaRealizada(new Date(2026, 6, 16))).toBe(
        false,
      );
    });

    it('el progreso del día deriva el "hecho" del vinculado de física, no del flag manual', () => {
      const normalHecho = eventoTemario(dia, { realizado: true });
      const vinculado = eventoTemario(dia, { vinculado: true }); // 1/2 hechas en física
      component.events = [normalHecho, vinculado];

      // 1 (normal hecho) + 0 (vinculado NO completado en física) = 1 de 2
      expect(component.getCompletedSubBlocksForDay(component.events, dia)).toBe(
        1,
      );
      expect(component.getProgressPercentageForDay(component.events, dia)).toBe(
        50,
      );

      // Con las 2 disciplinas hechas, el vinculado cuenta como completado.
      component.resumenFisica[0].disciplinas[1].realizado = true;
      expect(component.getCompletedSubBlocksForDay(component.events, dia)).toBe(
        2,
      );
      expect(component.getProgressPercentageForDay(component.events, dia)).toBe(
        100,
      );
      expect(component.getProgressBarColor(component.events, dia)).toBe(
        '#28a745',
      );
    });

    it('un vinculado en un día SIN física no cuenta como hecho aunque su flag manual sea false', () => {
      const vinculado = eventoTemario(new Date(2026, 6, 16), {
        vinculado: true,
      });
      component.events = [vinculado];
      expect(
        component.getCompletedSubBlocksForDay(
          component.events,
          new Date(2026, 6, 16),
        ),
      ).toBe(0);
    });
  });
});
