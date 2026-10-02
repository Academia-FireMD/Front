import { Injectable } from '@angular/core';
import { CalendarEvent } from 'angular-calendar';
import { cloneDeep } from 'lodash';
import { SubBloque } from '../../shared/models/planificacion.model';
import { colors } from '../vista-semanal/calendar-colors';

@Injectable({
  providedIn: 'root',
})
export class EventsService {
  constructor() {}

  public fromEventsToSubbloques(events: CalendarEvent[]): Partial<SubBloque>[] {
    events = cloneDeep(events);
    return events.map((event: any) => {
      const esPersonalizado = event.meta?.esPersonalizado || false;

      return {
        id: event.meta?.subBloque?.id,
        realizado: event.meta?.subBloque?.realizado ?? false,
        comentariosAlumno: event.meta?.subBloque?.comentariosAlumno ?? null,
        importante: event.meta?.subBloque?.importante ?? false,
        tiempoAviso: event.meta?.subBloque?.tiempoAviso ?? null,
        esEntrenamientoFisico:
          event.meta?.subBloque?.esEntrenamientoFisico ?? false,
        catalogoContenidoId: event.meta?.subBloque?.catalogoContenidoId ?? null,
        tipoTrabajoPlanificacion:
          event.meta?.subBloque?.tipoTrabajoPlanificacion ?? null,
        horaInicio: event.start,
        duracion:
          event.meta?.subBloque?.duracion ||
          (event.end.getTime() - event.start.getTime()) / 60000,
        nombre: event.title,
        comentarios: event.meta?.subBloque?.comentarios || '',
        color: event.color?.primary || '',
        esPersonalizado: esPersonalizado,
        planificacionId: event.meta?.subBloque?.planificacionId || null,
      };
    });
  }

  public fromSubbloquesToEvents(
    subbloques: SubBloque[],
    eventosPersonalizados: any[] = [],
  ): CalendarEvent[] {
    const eventos = [];

    // Procesar subbloques normales
    if (subbloques && subbloques.length > 0) {
      subbloques = cloneDeep(subbloques);
      eventos.push(
        ...subbloques.map((subBloque) => ({
          title: subBloque.nombre,
          start: new Date(subBloque.horaInicio),
          end: new Date(
            new Date(subBloque.horaInicio).getTime() +
              subBloque.duracion * 60000,
          ),
          color: {
            primary: subBloque.color || colors.yellow.primary,
            secondary: subBloque.color || colors.yellow.secondary,
          },
          draggable: true,
          meta: {
            esPersonalizado: false,
            subBloque: {
              ...subBloque,
              esPersonalizado: false,
            },
          },
        })),
      );
    }

    // Procesar eventos personalizados
    if (eventosPersonalizados && eventosPersonalizados.length > 0) {
      eventosPersonalizados = cloneDeep(eventosPersonalizados);
      eventos.push(
        ...eventosPersonalizados.map((evento) => ({
          title: evento.nombre,
          start: new Date(evento.horaInicio),
          end: new Date(
            new Date(evento.horaInicio).getTime() + evento.duracion * 60000,
          ),
          color: {
            primary: evento.color || '#4caf50',
            secondary: evento.color || '#4caf50',
          },
          draggable: true,
          meta: {
            esPersonalizado: true,
            subBloque: {
              id: evento.id,
              nombre: evento.nombre,
              horaInicio: evento.horaInicio,
              duracion: evento.duracion,
              comentarios: evento.descripcion || '',
              color: evento.color || '#4caf50',
              importante: evento.importante || false,
              tiempoAviso: evento.tiempoAviso,
              realizado: evento.realizado || false,
              planificacionId: evento.planificacionId,
              esPersonalizado: true,
            },
          },
        })),
      );
    }

    return eventos;
  }

  public calculateMinDate(events: CalendarEvent[]) {
    return events.reduce((earliest, event) => {
      return event.start < earliest ? event.start : earliest;
    }, events[0]?.start || new Date());
  }

  public getEventsForDay(events: CalendarEvent[], date: Date): CalendarEvent[] {
    return events.filter((event) => {
      const eventDate = new Date(event.start);
      return (
        eventDate.getFullYear() === date.getFullYear() &&
        eventDate.getMonth() === date.getMonth() &&
        eventDate.getDate() === date.getDate()
      );
    });
  }

  /** Mantiene el plan completo para guardar, pero limita lo que procesa angular-calendar. */
  public getEventsForRange(
    events: CalendarEvent[],
    start: Date,
    endExclusive: Date,
  ): CalendarEvent[] {
    return events.filter(
      (event) =>
        event.start < endExclusive &&
        (event.end ? event.end > start : event.start >= start),
    );
  }

  /** Lectura pura: no clonar todos los eventos por cada celda del calendario. */
  getDayProgress(
    events: CalendarEvent[],
    date: Date,
  ): {
    total: number;
    completed: number;
    percentage: number;
    color: string;
  } {
    let total = 0;
    let completed = 0;
    for (const event of events) {
      const start = event.start;
      if (
        start.getFullYear() !== date.getFullYear() ||
        start.getMonth() !== date.getMonth() ||
        start.getDate() !== date.getDate()
      )
        continue;
      total++;
      if (event.meta?.subBloque?.realizado) completed++;
    }
    const percentage = total
      ? Number(((completed / total) * 100).toFixed(2))
      : 0;
    return {
      total,
      completed,
      percentage,
      color:
        percentage === 100
          ? '#28a745'
          : percentage >= 50
            ? '#ffc107'
            : '#dc3545',
    };
  }

  getProgressBarColor(events: CalendarEvent[], date: Date): string {
    return this.getDayProgress(events, date).color;
  }

  getCompletedSubBlocksForDay(events: CalendarEvent[], date: Date): number {
    return this.getDayProgress(events, date).completed;
  }

  getProgressPercentageForDay(events: CalendarEvent[], date: Date): number {
    return this.getDayProgress(events, date).percentage;
  }
}
