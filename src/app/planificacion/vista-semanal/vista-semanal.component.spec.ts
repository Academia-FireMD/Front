import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { COMMON_TEST_PROVIDERS } from '../../testing';

import { VistaSemanalComponent } from './vista-semanal.component';
import { COLORES_TIPO_SUBBLOQUE } from '../sub-bloque-colores';

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

  describe('menú de contexto — añadir entrenamiento físico', () => {
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

    it('contextoFisicaDia incluye el resumen y el estado de cada disciplina', () => {
      expect(component.contextoFisicaDia(dia)).toBe(
        'Plan físico: 0/2. Cuerda 2 (pendiente), Carrera 2 (pendiente)',
      );

      component.resumenFisica = [
        {
          ...component.resumenFisica[0],
          disciplinas: component.resumenFisica[0].disciplinas.map(
            (disciplina, index) =>
              index === 0 ? { ...disciplina, realizado: true } : disciplina,
          ),
        },
      ];
      expect(component.contextoFisicaDia(dia)).toBe(
        'Plan físico: 1/2. Cuerda 2 (realizada), Carrera 2 (pendiente)',
      );
      expect(component.contextoFisicaDia(new Date(2026, 6, 16))).toBe('');
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

    it('progresoFisicaDia resume las disciplinas físicas para información', () => {
      expect(component.progresoFisicaDia(dia)).toEqual({ hechas: 1, total: 2 });

      const actualizado = [
        {
          ...component.resumenFisica[0],
          disciplinas: component.resumenFisica[0].disciplinas.map(
            (disciplina, index) =>
              index === 1 ? { ...disciplina, realizado: true } : disciplina,
          ),
        },
      ];
      component.resumenFisica = actualizado;
      expect(component.progresoFisicaDia(dia)).toEqual({ hechas: 2, total: 2 });
      expect(component.progresoFisicaDia(new Date(2026, 6, 16))).toEqual({
        hechas: 0,
        total: 0,
      });
    });

    it('la barra del calendario cuenta la marca propia incluso en entrenamiento vinculado', () => {
      const normalHecho = eventoTemario(dia, { realizado: true });
      const vinculadoPendiente = eventoTemario(dia, { vinculado: true });
      component.events = [normalHecho, vinculadoPendiente];

      // El progreso de las disciplinas es informativo y no sustituye la casilla.
      component.resumenFisica[0].disciplinas.forEach((disciplina) => {
        disciplina.realizado = true;
      });
      expect(component.getCompletedSubBlocksForDay(component.events, dia)).toBe(
        1,
      );
      expect(component.getProgressPercentageForDay(component.events, dia)).toBe(
        50,
      );

      vinculadoPendiente.meta.subBloque.realizado = true;
      component.events = [...component.events];
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

    it('un vinculado conserva su marca del calendario aunque no haya resumen físico', () => {
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

    it('actualiza de forma optimista y no duplica POSTs mientras guarda; revierte al fallar', () => {
      const vinculado = eventoTemario(dia, { vinculado: true });
      component.events = [vinculado];
      const peticion = new Subject<void>();
      const guardar = jest.fn(() => peticion.asObservable());
      component.planificacionesService = {
        actualizarProgresoSubBloque$: guardar,
      } as any;
      component.alternarModoProgreso();

      component.updateEventProgress(vinculado);
      component.updateEventProgress(vinculado);

      expect(vinculado.meta.subBloque.realizado).toBe(true);
      expect(guardar).toHaveBeenCalledTimes(1);
      expect(guardar).toHaveBeenCalledWith(
        expect.objectContaining({
          subBloqueId: 900,
          realizado: true,
        }),
      );

      peticion.error(new Error('offline'));
      expect(vinculado.meta.subBloque.realizado).toBe(false);
    });
  });

  describe('modo explícito «Marcar progreso»', () => {
    const dia = new Date(2026, 6, 15, 9, 0);
    const crearEvento = (
      id: number,
      {
        realizado = false,
        esPersonalizado = false,
        draggable = true,
        resizable = undefined as
          | { beforeStart: boolean; afterEnd: boolean }
          | undefined,
      } = {},
    ): any => ({
      title: `Evento ${id}`,
      start: dia,
      end: new Date(dia.getTime() + 60 * 60000),
      color: { primary: '#f59e0b', secondary: '#f59e0b' },
      draggable,
      resizable,
      meta: {
        esPersonalizado,
        subBloque: {
          id,
          nombre: `Evento ${id}`,
          duracion: 60,
          realizado,
          esPersonalizado,
          esEntrenamientoFisico: false,
        },
      },
    });
    const pointer = (props: Record<string, unknown> = {}) =>
      ({
        button: 0,
        pointerId: 1,
        clientX: 0,
        clientY: 0,
        ...props,
      }) as any;
    const click = (props: Record<string, unknown> = {}) =>
      ({
        target: null,
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
        ...props,
      }) as any;

    it('arranca en modo normal: el mutador directo no escribe ni cambia la marca', () => {
      const evento = crearEvento(101);
      component.events = [evento];
      const guardar = jest.fn();
      component.planificacionesService = {
        actualizarProgresoSubBloque$: guardar,
      } as any;

      expect(component.modoMarcadoProgreso).toBe(false);
      expect(component.puedeMarcarProgreso()).toBe(true);

      component.updateEventProgress(evento);

      expect(guardar).not.toHaveBeenCalled();
      expect(evento.meta.subBloque.realizado).toBe(false);
      expect(component.isEventSheetVisible).toBe(false);
    });

    it('sólo el alumno puede entrar en el modo; el admin conserva su comportamiento', () => {
      component.role = 'ADMIN';
      const evento = crearEvento(102);
      component.events = [evento];
      const guardar = jest.fn();
      component.planificacionesService = {
        actualizarProgresoSubBloque$: guardar,
      } as any;

      expect(component.puedeMarcarProgreso()).toBe(false);
      component.alternarModoProgreso(click());
      expect(component.modoMarcadoProgreso).toBe(false);

      component.updateEventProgress(evento);
      expect(guardar).not.toHaveBeenCalled();
      expect(evento.meta.subBloque.realizado).toBe(false);
    });

    it('entrar y salir no guarda nada ni deja el mutador desbloqueado', () => {
      component.events = [crearEvento(103)];
      const guardar = jest.fn();
      component.planificacionesService = {
        actualizarProgresoSubBloque$: guardar,
        actualizarEventoPersonalizadoRealizado$: guardar,
      } as any;

      component.alternarModoProgreso(click());
      expect(component.modoMarcadoProgreso).toBe(true);
      component.alternarModoProgreso(click());
      expect(component.modoMarcadoProgreso).toBe(false);

      expect(guardar).not.toHaveBeenCalled();
    });

    it('la tarjeta, la casilla y el teclado marcan una sola vez mientras el guardado está pendiente', () => {
      const evento = crearEvento(104);
      component.events = [evento];
      const peticion = new Subject<void>();
      const guardar = jest.fn(() => peticion.asObservable());
      component.planificacionesService = {
        actualizarProgresoSubBloque$: guardar,
      } as any;
      component.alternarModoProgreso(click());

      component.onCardClick(click(), evento);
      expect(guardar).toHaveBeenCalledTimes(1);
      expect(evento.meta.subBloque.realizado).toBe(true);

      component.onCompletionClick(click(), evento);
      expect(guardar).toHaveBeenCalledTimes(1);

      const tarjeta = document.createElement('div');
      tarjeta.tabIndex = 0;
      document.body.appendChild(tarjeta);
      tarjeta.focus();
      const teclado = {
        key: 'Enter',
        repeat: false,
        target: tarjeta,
        currentTarget: tarjeta,
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
      } as any;
      component.onCardKeydown(teclado, evento);
      expect(guardar).toHaveBeenCalledTimes(1);
      expect(document.activeElement).toBe(tarjeta);

      peticion.next();
      peticion.complete();
      expect(component.guardadosProgresoPendientes).toBe(false);
      component.onCompletionClick(click(), evento);
      expect(guardar).toHaveBeenCalledTimes(2);
      expect(evento.meta.subBloque.realizado).toBe(false);
      tarjeta.remove();
    });

    it('en modo marcar la tarjeta no abre el panel y la casilla no lo propaga al sheet', () => {
      const evento = crearEvento(105);
      component.events = [evento];
      component.planificacionesService = {
        actualizarProgresoSubBloque$: jest.fn(() =>
          new Subject().asObservable(),
        ),
      } as any;
      component.alternarModoProgreso(click());

      const sourceEvent = click();
      component.onCardClick(sourceEvent, evento);
      expect(component.isEventSheetVisible).toBe(false);
      expect(sourceEvent.preventDefault).toHaveBeenCalled();
      expect(sourceEvent.stopPropagation).toHaveBeenCalled();

      const casillaClick = click();
      component.onCompletionClick(casillaClick, evento);
      expect(casillaClick.stopPropagation).toHaveBeenCalled();
      expect(component.isEventSheetVisible).toBe(false);
    });

    it('un gesto por encima del umbral, cancelado o con scroll no marca al soltar', () => {
      const evento = crearEvento(106);
      component.events = [evento];
      const guardar = jest.fn(() => new Subject().asObservable());
      component.planificacionesService = {
        actualizarProgresoSubBloque$: guardar,
      } as any;
      component.alternarModoProgreso(click());

      component.onCardPointerDown(pointer({ clientX: 10, clientY: 10 }));
      component.onCardPointerMove(pointer({ clientX: 30, clientY: 10 }));
      component.onCardPointerUp(pointer({ clientX: 30, clientY: 10 }));
      component.onCardClick(click(), evento);

      component.onCardPointerDown(pointer({ clientX: 10, clientY: 10 }));
      component.onCardPointerCancel(pointer({ clientX: 10, clientY: 10 }));
      component.onCompletionClick(click(), evento);

      component.onCardPointerDown(pointer({ clientX: 10, clientY: 10 }));
      window.dispatchEvent(new Event('scroll'));
      component.onCardPointerUp(pointer({ clientX: 10, clientY: 10 }));
      component.onCardClick(click(), evento);

      expect(guardar).not.toHaveBeenCalled();
      expect(evento.meta.subBloque.realizado).toBe(false);
    });

    it('proyecta flags suspendidos sin mutar los eventos fuente', () => {
      component.mode = 'picker';
      const resizable = { beforeStart: true, afterEnd: true };
      const evento = crearEvento(107, { draggable: true, resizable });
      const noArrastrable = crearEvento(108, { draggable: false });
      component.events = [evento, noArrastrable];

      component.alternarModoProgreso(click());
      const proyeccion = component.eventsParaCalendario;
      expect(evento.draggable).toBe(true);
      expect(evento.resizable).toBe(resizable);
      expect(noArrastrable.draggable).toBe(false);
      expect(
        proyeccion.find((e) => e.meta.subBloque.id === 107)?.draggable,
      ).toBe(false);
      expect(
        proyeccion.find((e) => e.meta.subBloque.id === 107)?.resizable,
      ).toEqual({ beforeStart: false, afterEnd: false });
      expect(
        proyeccion.find((e) => e.meta.subBloque.id === 108)?.draggable,
      ).toBe(false);
      expect(proyeccion).not.toBe(component.events);

      component.alternarModoProgreso(click());
      expect(component.eventsParaCalendario).toBe(component.events);
      expect(evento.draggable).toBe(true);
      expect(evento.resizable).toBe(resizable);
      expect(noArrastrable.draggable).toBe(false);
    });

    it('al refrescar el input usa los flags vigentes y no restaura los antiguos', () => {
      component.mode = 'picker';
      const original = { beforeStart: true, afterEnd: true };
      component.events = [
        crearEvento(109, { draggable: true, resizable: original }),
      ];
      component.alternarModoProgreso(click());

      const refrescado = crearEvento(109, {
        draggable: false,
        resizable: { beforeStart: false, afterEnd: false },
      });
      const nuevo = crearEvento(110, { draggable: true });
      component.events = [refrescado, nuevo];

      expect(refrescado.draggable).toBe(false);
      expect(nuevo.draggable).toBe(true);
      const proyeccion = component.eventsParaCalendario;
      expect(
        proyeccion.find((e) => e.meta.subBloque.id === 109)?.draggable,
      ).toBe(false);
      expect(
        proyeccion.find((e) => e.meta.subBloque.id === 110)?.draggable,
      ).toBe(false);

      component.alternarModoProgreso(click());
      expect(component.eventsParaCalendario).toBe(component.events);
      expect(refrescado.draggable).toBe(false);
      expect(nuevo.draggable).toBe(true);
    });

    it('el ACK y el error actúan sobre la instancia actual del evento tras un refresco', () => {
      const evento = crearEvento(111);
      component.events = [evento];
      const peticion = new Subject<void>();
      const guardar = jest.fn(() => peticion.asObservable());
      component.planificacionesService = {
        actualizarProgresoSubBloque$: guardar,
      } as any;
      component.alternarModoProgreso(click());
      component.updateEventProgress(evento);

      const actualizado = crearEvento(111);
      component.events = [actualizado];
      // El refresco recibe el estado optimista pendiente, no la marca vieja.
      expect(actualizado.meta.subBloque.realizado).toBe(true);

      peticion.next();
      peticion.complete();
      expect(actualizado.meta.subBloque.realizado).toBe(true);
      expect(component.getCompletedSubBlocksForDay(component.events, dia)).toBe(
        1,
      );

      const base = crearEvento(111);
      component.events = [base];
      const segunda = new Subject<void>();
      component.planificacionesService = {
        actualizarProgresoSubBloque$: jest.fn(() => segunda.asObservable()),
      } as any;
      component.onCardClick(click(), base);
      const actualizado2 = crearEvento(111);
      component.events = [actualizado2];
      expect(actualizado2.meta.subBloque.realizado).toBe(true);

      segunda.error(new Error('offline'));
      expect(actualizado2.meta.subBloque.realizado).toBe(false);
      expect(component.guardadosProgresoPendientes).toBe(false);
    });

    it('Terminar queda bloqueado mientras hay guardados y no duplica el envío', () => {
      const evento = crearEvento(112);
      component.events = [evento];
      const peticion = new Subject<void>();
      const guardar = jest.fn(() => peticion.asObservable());
      component.planificacionesService = {
        actualizarProgresoSubBloque$: guardar,
      } as any;
      component.alternarModoProgreso(click());
      component.onCardClick(click(), evento);
      expect(component.guardadosProgresoPendientes).toBe(true);

      const terminar = click();
      component.alternarModoProgreso(terminar);
      component.alternarModoProgreso(terminar);

      expect(component.modoMarcadoProgreso).toBe(true);
      expect(terminar.preventDefault).toHaveBeenCalledTimes(2);
      expect(terminar.stopPropagation).toHaveBeenCalledTimes(2);
      expect(guardar).toHaveBeenCalledTimes(1);

      peticion.next();
      peticion.complete();
      expect(component.guardadosProgresoPendientes).toBe(false);
      component.alternarModoProgreso(click());
      expect(component.modoMarcadoProgreso).toBe(false);
    });

    it('un error revierte, permite reintentar y mantiene el modo hasta Terminar', () => {
      const evento = crearEvento(113);
      component.events = [evento];
      const primerError = new Subject<void>();
      const reintento = new Subject<void>();
      const guardar = jest
        .fn()
        .mockReturnValueOnce(primerError.asObservable())
        .mockReturnValueOnce(reintento.asObservable());
      component.planificacionesService = {
        actualizarProgresoSubBloque$: guardar,
      } as any;
      component.alternarModoProgreso(click());
      component.onCardClick(click(), evento);

      primerError.error(new Error('offline'));

      expect(component.modoMarcadoProgreso).toBe(true);
      expect(evento.meta.subBloque.realizado).toBe(false);
      expect(component.guardadosProgresoPendientes).toBe(false);

      component.onCardClick(click(), evento);
      expect(guardar).toHaveBeenCalledTimes(2);
      reintento.next();
      reintento.complete();
      expect(evento.meta.subBloque.realizado).toBe(true);
      component.alternarModoProgreso(click());
      expect(component.modoMarcadoProgreso).toBe(false);
    });

    it('editar un evento sin id ya presente lo reemplaza y no lo duplica', () => {
      component.mode = 'picker';
      const evento = crearEvento(117);
      evento.meta.subBloque.id = null;
      evento.title = 'Evento nuevo sin guardar';
      component.events = [evento];
      component.selectedEvent = evento;
      const emitir = jest.spyOn(component.eventsChange, 'emit');

      component.saveEvent({
        id: null,
        horaInicio: dia,
        nombre: 'Evento editado',
        color: '#ffffff',
        duracion: 90,
        comentarios: 'Nota editada',
        importante: false,
        tiempoAviso: undefined,
        esEntrenamientoFisico: false,
      });

      expect(component.events).toHaveLength(1);
      expect(component.events[0].title).toBe('Evento editado');
      expect(
        component.events[0].end!.getTime() -
          component.events[0].start.getTime(),
      ).toBe(90 * 60000);
      expect(emitir).toHaveBeenCalledTimes(1);
      expect(emitir.mock.calls[0][0]).toHaveLength(1);
    });

    it('el editor personal omite realizado del payload y conserva el estado vivo', async () => {
      const personal = crearEvento(116, {
        realizado: true,
        esPersonalizado: true,
      });
      component.events = [personal];
      const actualizar = jest.fn((_dto: Record<string, unknown>) => ({
        subscribe: ({ next }: any) => next({}),
      }));
      component.planificacionesService = {
        actualizarEventoPersonalizado$: actualizar,
      } as any;

      await component.saveEventoPersonalizado({
        id: 116,
        nombre: 'Personal editado',
        descripcion: 'Nota nueva',
        horaInicio: dia,
        duracion: 60,
        color: '#4caf50',
        importante: false,
        tiempoAviso: null,
        realizado: false,
      });

      expect(actualizar).toHaveBeenCalledTimes(1);
      const dto = actualizar.mock.calls[0][0];
      expect(dto).not.toHaveProperty('realizado');
      expect(component.events[0].title).toBe('Personal editado');
      expect(component.events[0].meta.subBloque.realizado).toBe(true);
    });

    it('guarda comentarios en normal sin tocar realizado ni requerir el modo', () => {
      const evento = crearEvento(114, { realizado: true });
      component.events = [evento];
      const guardar = jest.fn(() => new Subject().asObservable());
      component.planificacionesService = {
        actualizarProgresoSubBloque$: guardar,
      } as any;

      component.abrirEventSheet(evento);
      component.comentarioBorrador = 'Comentario sin modo';
      component.guardarComentarioSheet();

      expect(guardar).toHaveBeenCalledWith({
        subBloqueId: 114,
        planificacionId: Number(
          (component as any).activatedRoute.snapshot.params['id'],
        ),
        comentariosAlumno: 'Comentario sin modo',
      });
      expect(evento.meta.subBloque.realizado).toBe(true);
      expect(component.modoMarcadoProgreso).toBe(false);
    });

    it('en modo normal el click y el teclado abren el panel sin escribir progreso', () => {
      const evento = crearEvento(115);
      component.events = [evento];
      const guardar = jest.fn();
      component.planificacionesService = {
        actualizarProgresoSubBloque$: guardar,
      } as any;

      component.onCardClick(click(), evento);
      expect(component.isEventSheetVisible).toBe(true);

      component.cerrarEventSheet();
      component.onEventSheetHide();
      const tarjeta = document.createElement('div');
      document.body.appendChild(tarjeta);
      const teclado = {
        key: ' ',
        repeat: false,
        target: tarjeta,
        currentTarget: tarjeta,
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
      } as any;
      component.onCardKeydown(teclado, evento);

      expect(component.isEventSheetVisible).toBe(true);
      expect(guardar).not.toHaveBeenCalled();
      tarjeta.remove();
    });
  });

  describe('índices por día y su invalidación', () => {
    const dia = new Date(2026, 6, 15);
    const diaSiguiente = new Date(2026, 6, 16);

    const crearEvento = (
      id: number,
      fecha: Date,
      { realizado = false, esPersonalizado = false } = {},
    ): any => ({
      title: `Evento ${id}`,
      start: fecha,
      end: new Date(fecha.getTime() + 60 * 60000),
      color: { primary: '#fff', secondary: '#fff' },
      meta: {
        esPersonalizado,
        subBloque: {
          id,
          realizado,
          esPersonalizado,
          esEntrenamientoFisico: false,
        },
      },
    });

    it('resuelve el día por índice y lo invalida al mover el evento', () => {
      const evento = crearEvento(1, new Date(2026, 6, 15, 9, 0));
      component.events = [evento];

      expect(component.getEventsForDay(component.events, dia)).toEqual([
        evento,
      ]);
      expect(component.getEventsForDay(component.events, diaSiguiente)).toEqual(
        [],
      );

      component.eventDropped({
        event: evento,
        newStart: new Date(2026, 6, 16, 9, 0),
        newEnd: new Date(2026, 6, 16, 10, 0),
        allDay: false,
      } as any);

      expect(component.getEventsForDay(component.events, dia)).toEqual([]);
      expect(component.getEventsForDay(component.events, diaSiguiente)).toEqual(
        [evento],
      );
    });

    it('refleja la marca optimista en el progreso del día y revierte al fallar', () => {
      const primero = crearEvento(1, new Date(2026, 6, 15, 9, 0));
      const segundo = crearEvento(2, new Date(2026, 6, 15, 10, 0));
      component.events = [primero, segundo];
      const peticion = new Subject<void>();
      component.planificacionesService = {
        actualizarProgresoSubBloque$: jest.fn(() => peticion.asObservable()),
      } as any;
      component.alternarModoProgreso();

      component.updateEventProgress(primero);

      expect(component.getCompletedSubBlocksForDay(component.events, dia)).toBe(
        1,
      );
      expect(component.getProgressPercentageForDay(component.events, dia)).toBe(
        50,
      );
      expect(component.getProgressBarColor(component.events, dia)).toBe(
        '#ffc107',
      );

      peticion.error(new Error('offline'));

      expect(primero.meta.subBloque.realizado).toBe(false);
      expect(component.getCompletedSubBlocksForDay(component.events, dia)).toBe(
        0,
      );
      expect(component.getProgressPercentageForDay(component.events, dia)).toBe(
        0,
      );
      expect(component.getProgressBarColor(component.events, dia)).toBe(
        '#dc3545',
      );
    });

    it('recalcula los totales de física al recibir un nuevo resumen, sin recorrer el array en cada binding', () => {
      component.resumenFisica = [
        {
          fecha: '2026-07-15',
          bloqueId: 33,
          disciplinas: [
            {
              nombre: 'Cuerda',
              grupo: 'CUERDA',
              color: '#9fe2d0',
              realizado: false,
            },
            {
              nombre: 'Carrera',
              grupo: 'CARRERA',
              color: '#fdeaa8',
              realizado: false,
            },
          ],
        },
      ];

      expect(component.tieneFisica(dia)).toBe(true);
      expect(component.etiquetaFisica(dia)).toBe('Cuerda, Carrera');
      expect(component.progresoFisicaDia(dia)).toEqual({
        hechas: 0,
        total: 2,
      });

      component.resumenFisica = [
        {
          fecha: '2026-07-15',
          bloqueId: 33,
          disciplinas: [
            {
              nombre: 'Cuerda',
              grupo: 'CUERDA',
              color: '#9fe2d0',
              realizado: true,
            },
          ],
        },
      ];

      expect(component.progresoFisicaDia(dia)).toEqual({
        hechas: 1,
        total: 1,
      });
    });
  });

  describe('panel inferior de detalle del evento', () => {
    const dia = new Date(2026, 6, 15, 9, 0);
    const crearEvento = (
      id: number,
      {
        personal = false,
        titulo = `Evento ${id}`,
        comentario = '',
        comentariosAlumno = '',
        vinculado = false,
        realizado = false,
      } = {},
    ): any => ({
      title: titulo,
      start: dia,
      end: new Date(dia.getTime() + 60 * 60000),
      color: { primary: '#f59e0b', secondary: '#f59e0b' },
      draggable: true,
      meta: {
        esPersonalizado: personal,
        subBloque: {
          id,
          nombre: titulo,
          duracion: 60,
          comentarios: comentario,
          comentariosAlumno,
          esPersonalizado: personal,
          esEntrenamientoFisico: vinculado,
          realizado,
        },
      },
    });

    const pointer = (props: Record<string, unknown>) =>
      ({ button: 0, pointerId: 1, clientX: 0, clientY: 0, ...props }) as any;

    it('abre el panel sin iniciar la edición y devuelve el foco al activador', () => {
      const evento = crearEvento(1);
      const trigger = document.createElement('button');
      document.body.appendChild(trigger);

      component.abrirEventSheet(evento, {
        currentTarget: trigger,
      } as unknown as Event);

      expect(component.isEventSheetVisible).toBe(true);
      expect(component.eventoSheet).toBe(evento);
      expect(component.isDialogVisible).toBe(false);
      expect(component.isEventoPersonalizadoDialogVisible).toBe(false);
      expect(component.comentarioBorrador).toBe('');

      component.cerrarEventSheet();
      component.onEventSheetHide();

      expect(component.isEventSheetVisible).toBe(false);
      expect(document.activeElement).toBe(trigger);
      trigger.remove();
    });

    it('no abre el panel en un modo de sólo presentación', () => {
      component.role = 'ADMIN';
      component.mode = 'picker';
      const evento = crearEvento(7);

      component.onEventClicked(evento);

      expect(component.isEventSheetVisible).toBe(false);
      expect(component.eventoSheet).toBeNull();
    });

    it('el guard de gesto ignora el clic de un drag y abre en el gesto siguiente', () => {
      const evento = crearEvento(2);
      const click = { target: null } as unknown as MouseEvent;

      component.onCardPointerDown(pointer({ clientX: 10, clientY: 10 }));
      component.onCardPointerMove(pointer({ clientX: 30, clientY: 10 }));
      component.onCardPointerUp(pointer({ clientX: 30, clientY: 10 }));
      component.onCardClick(click, evento);
      expect(component.isEventSheetVisible).toBe(false);

      component.onCardPointerDown(pointer({ clientX: 10, clientY: 10 }));
      component.onCardPointerUp(pointer({ clientX: 10, clientY: 10 }));
      component.onCardClick(click, evento);
      expect(component.isEventSheetVisible).toBe(true);
    });

    it('un gesto cancelado no abre el panel con el click de cierre de la tarjeta', () => {
      const evento = crearEvento(4);
      const click = { target: null } as unknown as MouseEvent;

      component.onCardPointerDown(pointer({ clientX: 10, clientY: 10 }));
      component.onCardPointerMove(pointer({ clientX: 40, clientY: 10 }));
      component.onCardPointerCancel(pointer({ clientX: 40, clientY: 10 }));
      component.onCardClick(click, evento);
      expect(component.isEventSheetVisible).toBe(false);

      component.onCardPointerDown(pointer({ clientX: 10, clientY: 10 }));
      component.onCardPointerUp(pointer({ clientX: 10, clientY: 10 }));
      component.onCardClick(click, evento);
      expect(component.isEventSheetVisible).toBe(true);
    });

    it('un drag real consume el click de soltado una sola vez', () => {
      component.role = 'ADMIN';
      const evento = crearEvento(3);

      component.eventDropped({
        event: evento,
        newStart: new Date(2026, 6, 15, 10, 0),
        newEnd: new Date(2026, 6, 15, 11, 0),
        allDay: false,
      } as any);

      component.onCardClick({ target: null } as unknown as MouseEvent, evento);
      expect(component.isEventSheetVisible).toBe(false);

      component.onCardPointerDown(pointer({}));
      component.onCardPointerUp(pointer({}));
      component.onCardClick({ target: null } as unknown as MouseEvent, evento);
      expect(component.isEventSheetVisible).toBe(true);
    });

    it('guarda el comentario capturado sin contaminar otro evento abierto mientras está pendiente', () => {
      component.role = 'ALUMNO';
      const eventoA = crearEvento(11, { comentariosAlumno: 'previo A' });
      const eventoB = crearEvento(12);
      component.events = [eventoA, eventoB];

      const peticionA = new Subject<void>();
      const peticionB = new Subject<void>();
      const guardar = jest.fn(({ subBloqueId }: { subBloqueId: number }) =>
        subBloqueId === 11
          ? peticionA.asObservable()
          : peticionB.asObservable(),
      );
      component.planificacionesService = {
        actualizarProgresoSubBloque$: guardar,
      } as any;

      component.onEventClicked(eventoA);
      expect(component.comentarioBorrador).toBe('previo A');
      component.comentarioBorrador = 'Comentario A';
      component.guardarComentarioSheet();
      component.guardarComentarioSheet();
      expect(guardar).toHaveBeenCalledTimes(1);
      expect(eventoA.meta.subBloque.comentariosAlumno).toBe('previo A');

      component.cerrarEventSheet();
      component.onEventSheetHide();
      component.onEventClicked(eventoB);
      expect(component.comentarioBorrador).toBe('');
      component.comentarioBorrador = 'Comentario B';
      component.guardarComentarioSheet();
      expect(guardar).toHaveBeenCalledTimes(2);

      peticionA.next();
      expect(eventoA.meta.subBloque.comentariosAlumno).toBe('Comentario A');
      expect(eventoB.meta.subBloque.comentariosAlumno).toBe('');
      expect(component.comentarioBorrador).toBe('Comentario B');

      peticionB.next();
      expect(eventoB.meta.subBloque.comentariosAlumno).toBe('Comentario B');
      expect(component.comentarioFeedback).toBe(true);
    });

    it('un ACK tardío de A no sobrescribe el feedback ya mostrado para B', () => {
      component.role = 'ALUMNO';
      const eventoA = crearEvento(13);
      const eventoB = crearEvento(14);
      component.events = [eventoA, eventoB];

      const peticionA = new Subject<void>();
      const peticionB = new Subject<void>();
      const guardar = jest.fn(({ subBloqueId }: { subBloqueId: number }) =>
        subBloqueId === 13
          ? peticionA.asObservable()
          : peticionB.asObservable(),
      );
      component.planificacionesService = {
        actualizarProgresoSubBloque$: guardar,
      } as any;

      component.onEventClicked(eventoA);
      component.comentarioBorrador = 'Comentario A';
      component.guardarComentarioSheet();
      component.onEventClicked(eventoB);
      component.comentarioBorrador = 'Comentario B';
      component.guardarComentarioSheet();

      peticionB.next();
      expect(component.comentarioFeedback).toBe(true);
      expect(component.comentarioBorrador).toBe('Comentario B');

      peticionA.next();
      expect(component.comentarioFeedback).toBe(true);
      expect(component.comentarioBorrador).toBe('Comentario B');
      expect(eventoA.meta.subBloque.comentariosAlumno).toBe('Comentario A');
    });

    it('conserva el borrador local de B tras error de A y no lo resucita en A', () => {
      component.role = 'ALUMNO';
      const eventoA = crearEvento(15, { comentariosAlumno: 'previo A' });
      const eventoB = crearEvento(16, { comentariosAlumno: 'previo B' });
      component.events = [eventoA, eventoB];
      const errorA = new Subject<void>();
      component.planificacionesService = {
        actualizarProgresoSubBloque$: jest.fn(() => errorA.asObservable()),
      } as any;

      component.onEventClicked(eventoA);
      component.comentarioBorrador = 'borrador A fallido';
      component.guardarComentarioSheet();
      errorA.error(new Error('offline'));

      component.onEventClicked(eventoB);
      component.comentarioBorrador = 'borrador B';
      component.onComentarioInput();
      component.cerrarEventSheet();
      component.onEventSheetHide();
      component.onEventClicked(eventoB);
      expect(component.comentarioBorrador).toBe('borrador B');
      expect(component.comentarioError).toBe('');

      component.onEventClicked(eventoA);
      expect(component.comentarioBorrador).toBe('borrador A fallido');
      expect(component.comentarioError).toMatch(/No se pudo guardar/);
      expect(component.comentarioBorrador).not.toBe('borrador B');
    });

    it('aísla el DELETE personal pendiente por identidad y no cierra otro panel', () => {
      component.role = 'ALUMNO';
      const personal = crearEvento(51, { personal: true });
      const otra = crearEvento(52);
      component.events = [personal, otra];
      const peticion = new Subject<void>();
      const eliminar = jest.fn(() => peticion.asObservable());
      component.planificacionesService = {
        eliminarEventoPersonalizado$: eliminar,
      } as any;

      component.onEventClicked(personal);
      component.confirmarBorradoEventoSheet();
      expect(eliminar).toHaveBeenCalledTimes(1);
      expect(component.eliminandoEvento).toBe(true);

      component.cerrarEventSheet();
      component.onEventSheetHide();
      component.onEventClicked(personal);
      expect(component.eliminandoEvento).toBe(true);
      component.confirmarBorradoEventoSheet();
      expect(eliminar).toHaveBeenCalledTimes(1);

      component.cerrarEventSheet();
      component.onEventSheetHide();
      component.onEventClicked(otra);
      expect(component.isEventSheetVisible).toBe(true);
      peticion.next();
      expect(component.isEventSheetVisible).toBe(true);
      expect(component.eventoSheet).toBe(otra);
      expect(component.events.includes(personal)).toBe(false);
    });

    it('conserva el borrador al fallar y permite reintentar sin doble guardado', () => {
      component.role = 'ALUMNO';
      const evento = crearEvento(21, { comentariosAlumno: 'anterior' });
      component.events = [evento];

      const primerError = new Subject<void>();
      const reintento = new Subject<void>();
      const guardar = jest
        .fn()
        .mockReturnValueOnce(primerError.asObservable())
        .mockReturnValueOnce(reintento.asObservable());
      component.planificacionesService = {
        actualizarProgresoSubBloque$: guardar,
      } as any;

      component.onEventClicked(evento);
      component.comentarioBorrador = 'nuevo comentario';
      component.guardarComentarioSheet();
      component.guardarComentarioSheet();
      expect(guardar).toHaveBeenCalledTimes(1);

      primerError.error(new Error('offline'));
      expect(component.comentarioBorrador).toBe('nuevo comentario');
      expect(component.comentarioGuardando).toBe(false);
      expect(component.comentarioError).toMatch(/No se pudo guardar/);
      expect(evento.meta.subBloque.comentariosAlumno).toBe('anterior');

      component.guardarComentarioSheet();
      expect(guardar).toHaveBeenCalledTimes(2);
      reintento.next();
      expect(evento.meta.subBloque.comentariosAlumno).toBe('nuevo comentario');
      expect(component.comentarioError).toBe('');
    });

    it('respeta permisos por rol y tipo de evento', () => {
      component.role = 'ALUMNO';
      const asignado = crearEvento(31);
      component.onEventClicked(asignado);
      expect(component.puedeComentarEventoSheet()).toBe(true);
      expect(component.puedeEditarEventoSheet()).toBe(false);
      expect(component.puedeEliminarEventoSheet()).toBe(false);

      const personal = crearEvento(32, { personal: true });
      component.onEventClicked(personal);
      expect(component.puedeComentarEventoSheet()).toBe(false);
      expect(component.puedeEditarEventoSheet()).toBe(true);
      expect(component.puedeEliminarEventoSheet()).toBe(true);

      component.role = 'ADMIN';
      component.onEventClicked(asignado);
      expect(component.puedeComentarEventoSheet()).toBe(false);
      expect(component.puedeEditarEventoSheet()).toBe(true);
      expect(component.puedeEliminarEventoSheet()).toBe(true);
    });

    it('sólo ofrece el plan físico al evento vinculado con resumen del día', () => {
      component.role = 'ALUMNO';
      component.resumenFisica = [
        {
          fecha: '2026-07-15',
          bloqueId: 33,
          disciplinas: [
            {
              nombre: 'Cuerda',
              grupo: 'CUERDA',
              color: '#9fe2d0',
              realizado: false,
            },
          ],
        },
      ];
      const vinculado = crearEvento(41, { vinculado: true });
      const normal = crearEvento(42);

      component.onEventClicked(vinculado);
      expect(component.puedeVerFisicaSheet()).toBe(true);

      component.onEventClicked(normal);
      expect(component.puedeVerFisicaSheet()).toBe(false);
    });
  });
});
