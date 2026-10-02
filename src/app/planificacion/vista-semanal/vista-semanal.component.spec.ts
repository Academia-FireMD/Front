import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, throwError } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { COMMON_TEST_PROVIDERS } from '../../testing';
import { PlanificacionesService } from '../../services/planificaciones.service';
import { EventsService } from '../services/events.service';

import { VistaSemanalComponent } from './vista-semanal.component';
import { COLORES_TIPO_SUBBLOQUE } from '../sub-bloque-colores';

describe('VistaSemanalComponent', () => {
  let component: VistaSemanalComponent;
  let fixture: ComponentFixture<VistaSemanalComponent>;
  let router: Router;
  let progressService: { actualizarProgresoSubBloque$: jest.Mock };

  beforeEach(async () => {
    progressService = { actualizarProgresoSubBloque$: jest.fn() };
    await TestBed.configureTestingModule({
      declarations: [VistaSemanalComponent],
      providers: [
        ...COMMON_TEST_PROVIDERS,
        { provide: EventsService, useClass: EventsService },
        { provide: PlanificacionesService, useValue: progressService },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(VistaSemanalComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('muestra un evento nuevo aunque ya se hubiera calculado la semana visible', () => {
    const fecha = new Date(2026, 9, 2, 10);
    component.viewDate = fecha;
    component.events = [];
    expect(component.visibleCalendarEvents).toHaveLength(0);
    component.selectedEvent = { start: fecha, title: 'Nuevo', meta: {} } as any;

    component.saveEvent({
      nombre: 'Nuevo',
      color: '#b82025',
      duracion: 60,
    } as any);

    expect(
      component.visibleCalendarEvents.map((evento) => evento.title),
    ).toEqual(['Nuevo']);
  });

  it('copia subbloques en el calendario manual sin guardarlos antes de confirmar el padre', () => {
    const inicio = new Date(2026, 8, 28, 9, 0);
    (component as any).onTimeClickedDate = inicio;
    component.seleccionandoSubbloques = true;
    const emit = jest.spyOn(component.eventsChange, 'emit');
    const save = jest.spyOn(component.saveChanges, 'emit');
    component.subbloquesSeleccionados([
      {
        catalogoContenidoId: 7,
        nombre: 'Tema uno',
        duracion: 45,
        comentarios: '**Nota**',
        color: '#123456',
      },
      {
        catalogoContenidoId: 7,
        nombre: 'Tema dos',
        duracion: 30,
        comentarios: 'Otra nota',
        color: '#123456',
      },
    ] as any);
    expect(component.events).toHaveLength(2);
    expect(component.events[0].meta.subBloque.id).toBeNull();
    expect(component.events[1].start.getTime()).toBe(
      inicio.getTime() + 45 * 60000,
    );
    expect(emit).toHaveBeenCalledTimes(1);
    expect(save).not.toHaveBeenCalled();
    expect(component.seleccionandoSubbloques).toBe(false);
  });

  describe('menú de contexto — añadir entrenamiento físico', () => {
    it('no abre el menú de la franja al pulsar una actividad', () => {
      const sourceEvent = {
        target: { closest: jest.fn().mockReturnValue({}) },
        stopPropagation: jest.fn(),
      };
      const menu = { show: jest.fn() };

      component.onTimeClicked(
        { date: new Date(2027, 0, 4, 7), sourceEvent },
        menu as any,
      );

      expect(menu.show).not.toHaveBeenCalled();
      expect(sourceEvent.stopPropagation).not.toHaveBeenCalled();
    });

    it('crea el evento con el color de tipo Entrenamiento', () => {
      const fecha = new Date(2026, 6, 15, 10, 0, 0);
      (component as any).onTimeClickedDate = fecha;

      const items = component.getMenuItems('ADMIN');
      const itemFisico = items.find(
        (i) => i.label === 'Añadir entrenamiento físico',
      );

      expect(itemFisico).toBeTruthy();
      itemFisico!.command!();

      expect(component.selectedEvent?.title).toBe('ENTRENAMIENTO FÍSICO');
      expect(component.selectedEvent?.color).toEqual({
        primary: COLORES_TIPO_SUBBLOQUE.entrenamiento,
        secondary: COLORES_TIPO_SUBBLOQUE.entrenamiento,
      });
      expect(component.editSubBloqueData.color).toBe(
        COLORES_TIPO_SUBBLOQUE.entrenamiento,
      );
      expect(component.editSubBloqueData.esEntrenamientoFisico).toBe(true);
    });
  });

  describe('bridge temario↔física', () => {
    const dia = new Date(2026, 6, 15); // 2026-07-15 (mes 0-indexado)

    beforeEach(() => {
      component.resumenFisica = [
        {
          fecha: '2026-07-15',
          bloqueId: 33,
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
      component.resumenFisica = [
        { fecha: '2026-07-15', bloqueId: 33, disciplinas: [] },
      ];
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
      expect(router.navigate).toHaveBeenCalledWith(
        ['/app/planificacion-fisica', 'dia', '2026-07-15'],
        {
          queryParams: {
            bloqueId: 33,
            originPlanificacionId: undefined,
          },
        },
      );
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
          bloqueId: 33,
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

    it('el progreso del calendario usa la marca propia, aunque exista física vinculada', () => {
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

      // Completar el módulo físico no marca la tarjeta del calendario.
      component.resumenFisica[0].disciplinas[1].realizado = true;
      expect(component.getCompletedSubBlocksForDay(component.events, dia)).toBe(
        1,
      );
      expect(component.getProgressPercentageForDay(component.events, dia)).toBe(
        50,
      );

      vinculado.meta.subBloque.realizado = true;
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

    it('un entrenamiento sin plan físico se puede completar en el calendario', () => {
      const vinculado = eventoTemario(new Date(2026, 6, 16), {
        vinculado: true,
        realizado: true,
      });
      component.events = [vinculado];
      expect(
        component.getCompletedSubBlocksForDay(
          component.events,
          new Date(2026, 6, 16),
        ),
      ).toBe(1);
    });

    it('el doble clic no duplica la petición y la UI responde antes de la red', () => {
      component.role = 'ALUMNO';
      const event = eventoTemario(dia, { vinculado: true });
      const respuesta = new Subject<unknown>();
      progressService.actualizarProgresoSubBloque$.mockReturnValue(respuesta);

      component.updateEventProgress(event);
      component.updateEventProgress(event);

      expect(event.meta.subBloque.realizado).toBe(true);
      expect(component.isProgressSaving(event)).toBe(true);
      expect(
        progressService.actualizarProgresoSubBloque$,
      ).toHaveBeenCalledTimes(1);
      respuesta.next({});
      respuesta.complete();
      expect(component.isProgressSaving(event)).toBe(false);
    });

    it('si falla el guardado, restaura la casilla y el progreso', () => {
      component.role = 'ALUMNO';
      const event = eventoTemario(dia, { vinculado: true });
      progressService.actualizarProgresoSubBloque$.mockReturnValue(
        throwError(() => new Error('sin red')),
      );
      const toast = TestBed.inject(ToastrService);

      component.updateEventProgress(event);

      expect(event.meta.subBloque.realizado).toBe(false);
      expect(component.isProgressSaving(event)).toBe(false);
      expect(toast.error).toHaveBeenCalled();
    });
  });
});
