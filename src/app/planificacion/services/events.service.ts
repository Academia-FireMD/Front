import { Injectable } from '@angular/core';
import { CalendarEvent } from 'angular-calendar';
import { cloneDeep } from 'lodash';
import { SubBloque } from '../../shared/models/planificacion.model';
import { colors } from '../vista-semanal/vista-semanal.component';

@Injectable({
  providedIn: 'root',
})
export class EventsService {
  constructor() {}

  public fromEventsToSubbloques(events: CalendarEvent[]): Partial<SubBloque>[] {
    events = cloneDeep(events);
    return events.map((event: any) => ({
      id: event.meta?.subBloque?.id,
      realizado: event.meta?.subBloque?.realizado ?? false,
      comentariosAlumno: event.meta?.subBloque?.comentariosAlumno ?? null,
      importante: event.meta?.subBloque?.importante ?? false,
      tiempoAviso: event.meta?.subBloque?.tiempoAviso ?? null,
      horaInicio: event.start, // Fecha y hora completa del evento
      duracion: event.meta?.subBloque?.duracion || event.duracion, // Duración del evento
      nombre: event.title, // Título del sub-bloque o evento
      comentarios: event.meta?.subBloque?.comentarios || event.comentarios, // Comentarios opcionales
      color: event.color?.primary || '', // Color del evento si está definido
    }));
  }

  public fromSubbloquesToEvents(subbloques: SubBloque[]): CalendarEvent[] {
    subbloques = cloneDeep(subbloques);
    return subbloques.map((subBloque) => ({
      title: subBloque.nombre,
      start: new Date(subBloque.horaInicio), // Convertir la hora de inicio a Date
      end: new Date(
        new Date(subBloque.horaInicio).getTime() + subBloque.duracion * 60000
      ), // Calcular la hora de finalización
      color: {
        primary: subBloque.color || colors.yellow.primary,
        secondary: subBloque.color || colors.yellow.secondary,
      },
      draggable: true, // Si los eventos pueden ser arrastrados
      meta: { subBloque }, // Adjuntar el subBloque original para referencia
    }));
  }

  public calculateMinDate(events: CalendarEvent[]) {
    events = cloneDeep(events);
    return events.reduce((earliest, event) => {
      return event.start < earliest ? event.start : earliest;
    }, events[0]?.start || new Date());
  }

  public getEventsForDay(events: CalendarEvent[], date: Date): any[] {
    events = cloneDeep(events);
    return events.filter((event) => {
      const eventDate = new Date(event.start);
      return (
        eventDate.getFullYear() === date.getFullYear() &&
        eventDate.getMonth() === date.getMonth() &&
        eventDate.getDate() === date.getDate()
      );
    });
  }

  getProgressBarColor(events: CalendarEvent[], date: Date): string {
    events = cloneDeep(events);
    const percentage = this.getProgressPercentageForDay(events, date);

    if (percentage === 100) {
      return '#28a745'; // Verde (completado)
    } else if (percentage >= 50) {
      return '#ffc107'; // Amarillo (intermedio)
    } else {
      return '#dc3545'; // Rojo (bajo progreso)
    }
  }

  getCompletedSubBlocksForDay(events: CalendarEvent[], date: Date): number {
    events = cloneDeep(events);
    const eventsForDay = this.getEventsForDay(events, date);
    return eventsForDay.filter((event) => event.meta?.subBloque?.realizado)
      .length;
  }

  getProgressPercentageForDay(events: CalendarEvent[], date: Date): number {
    events = cloneDeep(events);
    const eventsForDay = this.getEventsForDay(events, date);
    const completed = this.getCompletedSubBlocksForDay(events, date);
    return Number(
      (eventsForDay.length > 0
        ? (completed / eventsForDay.length) * 100
        : 0
      ).toFixed(2)
    );
  }
}
