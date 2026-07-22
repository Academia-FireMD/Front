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
            { nombre: 'Cuerda 2', grupo: 'CUERDA', color: '#9fe2d0' },
            { nombre: 'Carrera 2', grupo: 'CARRERA', color: '#fdeaa8' },
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
        { nombre: 'Cuerda 2', grupo: 'CUERDA', color: '#9fe2d0' },
        { nombre: 'Carrera 2', grupo: 'CARRERA', color: '#fdeaa8' },
      ]);
    });

    it('disciplinasFisica devuelve [] cuando el día no tiene física (el chip no se pinta)', () => {
      expect(component.disciplinasFisica(new Date(2026, 6, 16))).toEqual([]);
    });
  });
});
